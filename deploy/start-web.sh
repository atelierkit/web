#!/usr/bin/env bash
#
# atelierkit/web —— 生产环境启动脚本（通用模板）
#
# 用途：拉镜像（nginx + 静态产物）→ 挂运行时配置重建容器 → 校验配置真的生效。
#
# 用法：
#   bash deploy/start-web.sh                 # 拉取 latest 并重建容器
#   bash deploy/start-web.sh sha-1a2b3c4     # 拉取指定标签（回滚 / 灰度用）
#   TAG=v1.2.0 bash deploy/start-web.sh      # 同上，用环境变量传
#
# 站点相关参数全部外部化，默认值只是通用占位。两种覆盖方式（后者优先）：
#   1. 写进 deploy/deploy.env（已在 .gitignore 里，不进版本库）；
#   2. 直接当环境变量传：IP=172.20.0.9 NETWORK=my-net bash deploy/start-web.sh
#
# 可覆盖的变量：
#   CONTAINER      容器名（默认 atelierkit-web）
#   NETWORK        自定义网络名（默认 atelierkit-net；置空则用默认 bridge）
#   IP             固定 IPv4（默认空 = 不固定；反代按 IP 转发时才需要）
#   PORT           容器内监听端口（镜像固定 80，一般不用改）
#   PUBLISH        宿主机端口映射（默认 8080 → 容器 80；显式置空则不映射）
#   CONFIG_FILE    运行时配置（默认 ./config.json，作为 assets/config.json 只读挂载）
#   GHCR_USER / GHCR_PAT_FILE   私有包的登录凭据（默认空，公开包不需要）
#
# 三条设计取舍（都是踩过的坑）：
#   1. 先 pull 成功、再删旧容器：pull 失败时站点不受影响。
#   2. 启动前校验 CONFIG_FILE 存在且是合法 JSON。两种隐蔽失效都不报错：
#      a. 宿主机文件缺失时 docker 会在挂载点建一个同名目录 ⇒ 请求 assets/config.json 变 404，
#         前端提示「未配置有效后端地址」；
#      b. 漏写 -v 时容器不报错，用的是镜像内打包的那份（baseUrl=//localhost:3000/）
#         ⇒ 页面能开、接口全打到访问者本机，极易被误判成后端故障。
#   3. 启动后把容器内 /assets/config.json 读出来回显，确认挂载真正生效。
#
# 依赖：docker；可选 python3（校验 JSON 合法性）

set -euo pipefail

# ---------- 站点参数（可被 deploy.env / 环境变量覆盖） ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/deploy.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$SCRIPT_DIR/deploy.env"
  set +a
fi

IMAGE_REPO="${IMAGE_REPO:-ghcr.io/atelierkit/web}"
CONTAINER="${CONTAINER:-atelierkit-web}"
NETWORK="${NETWORK:-atelierkit-net}"
IP="${IP:-}"
PORT=80
PUBLISH="${PUBLISH-8080}"
CONFIG_FILE="${CONFIG_FILE:-config.json}"
CONFIG_TARGET='/usr/share/nginx/html/assets/config.json'
GHCR_USER="${GHCR_USER:-}"
GHCR_PAT_FILE="${GHCR_PAT_FILE:-}"

# 镜像标签：命令行参数 > 环境变量 TAG > latest
TAG="${1:-${TAG:-latest}}"
IMAGE="${IMAGE_REPO}:${TAG}"

log() { printf '\033[36m→\033[0m %s\n' "$*"; }
warn() { printf '\033[33m⚠\033[0m %s\n' "$*" >&2; }
die() { printf '\033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# ---------- 前置检查 ----------
command -v docker >/dev/null 2>&1 || die '未找到 docker，请确认本机已安装 Docker Engine'
docker info >/dev/null 2>&1 || die 'docker 守护进程不可用（systemctl status docker）'

[[ -f "$CONFIG_FILE" ]] || die "运行时配置不存在：$CONFIG_FILE
  前端依赖它取后端地址（baseUrl），缺失时页面会报「未配置有效后端地址」"
[[ -r "$CONFIG_FILE" ]] || die "运行时配置不可读：$CONFIG_FILE"

# JSON 必须合法：nginx 只会原样返回，坏掉的 JSON 只会表现为前端启动即失败
if command -v python3 >/dev/null 2>&1; then
  python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$CONFIG_FILE" \
    || die "$CONFIG_FILE 不是合法 JSON，请先修正"
else
  warn '本机缺少 python3，跳过 config.json 的 JSON 合法性校验'
fi

# baseUrl 指向 localhost 时线上前端会去请求「访问者自己的机器」，页面正常但接口全挂；
# 开发栈确实可能这么写，故只告警不阻断
if grep -qE '"baseUrl"[[:space:]]*:[[:space:]]*"[^"]*localhost' "$CONFIG_FILE"; then
  warn "$CONFIG_FILE 的 baseUrl 指向 localhost，线上会请求访问者本机（预期应为主机域名）"
fi

# 网络不存在时补建（不指定子网，交给 docker 自动分配；需要固定 IP 时再显式给 --subnet）
if [[ -n "$NETWORK" ]] && ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
  log "网络 $NETWORK 不存在，创建"
  docker network create "$NETWORK" >/dev/null
fi

# ---------- 拉取镜像 ----------
# 私有包直接 pull 会 401/denied，此时用 PAT 登录后重试；包若已公开则全程无需凭据
pull_image() {
  local image="$1"
  if docker pull "$image"; then
    return 0
  fi
  if [[ -z "$GHCR_PAT_FILE" || ! -f "$GHCR_PAT_FILE" ]]; then
    die "拉取 $image 失败，且未配置 GHCR_PAT_FILE（私有包需先 docker login ghcr.io）"
  fi
  log "拉取失败，尝试用 PAT 登录 ghcr.io（${GHCR_USER:-<未指定用户>}）"
  tr -d '\r\n' <"$GHCR_PAT_FILE" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
  docker pull "$image"
}

log "拉取镜像 $IMAGE"
pull_image "$IMAGE" || die "拉取 $IMAGE 失败，旧容器保持运行（未做任何删除）"

# ---------- 重建容器 ----------
if docker inspect "$CONTAINER" >/dev/null 2>&1; then
  log "移除旧容器 $CONTAINER"
  docker rm -f "$CONTAINER" >/dev/null
fi

run_args=(
  -dit
  --restart always
  --name "$CONTAINER"
  --hostname "$CONTAINER"
  -e TZ=Asia/Shanghai
  -v "$CONFIG_FILE:$CONFIG_TARGET:ro"
)
[[ -n "$NETWORK" ]] && run_args+=(--network "$NETWORK")
# web 镜像内 nginx 固定监听 80；PUBLISH 为空表示不映射宿主机端口（仅由反代按 IP/容器名访问）
[[ -n "$PUBLISH" ]] && run_args+=(-p "${PUBLISH}:80")
if [[ -n "$IP" ]]; then
  run_args+=(--ip "$IP")
  log "启动 $CONTAINER（固定 IP $IP:80，网络 $NETWORK，配置 $CONFIG_FILE）"
else
  log "启动 $CONTAINER（网络 ${NETWORK:-bridge}，宿主端口 ${PUBLISH:-未映射}，配置 $CONFIG_FILE）"
fi

docker run "${run_args[@]}" "$IMAGE" >/dev/null

# ---------- 启动校验 ----------
sleep 2
if [[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER")" != 'true' ]]; then
  printf '\033[31m✗\033[0m %s\n' "$CONTAINER 已退出，最近日志：" >&2
  docker logs --tail 50 "$CONTAINER" >&2 || true
  exit 1
fi

# 直接从容器内取一次运行时配置：既证明 nginx 已起来，也证明挂载点落在了正确位置
served=''
for _ in $(seq 1 10); do
  served="$(docker exec "$CONTAINER" wget -qO- "http://127.0.0.1/assets/config.json" 2>/dev/null || true)"
  if [[ -n "$served" ]]; then
    break
  fi
  sleep 1
done
if [[ -z "$served" ]]; then
  warn "容器内取不到 /assets/config.json，请抽查：
  docker exec $CONTAINER ls -l /usr/share/nginx/html/assets/
  docker logs --tail 80 $CONTAINER"
else
  log '容器内 assets/config.json 读取正常：'
  printf '%s\n' "$served" | sed 's/^/    /'
fi

# 镜像自带 HEALTHCHECK（nginx 首页探测），跑完第一轮后看结果
health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$CONTAINER")"
log "健康检查状态：$health（starting 属正常，30 秒后转 healthy）"

docker ps --filter "name=^${CONTAINER}$" --format '  {{.Names}}  {{.Image}}  {{.Status}}'
log "访问地址：http://<本机地址>:${PUBLISH:-<未映射>}/；反代与后端 baseUrl 的配合见 README 部署章节"
