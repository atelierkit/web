# atelierkit · web

家用局域网服务器上的个人工具集合 —— Web 前端。

基于 [ng-alain](https://ng-alain.com) 构建，是 `atelierkit` 各工具的统一管理界面。

## 项目简介

`atelierkit` 是一套部署在家庭局域网服务器上的自托管工具集合，所有数据仅在内网流转。
`web` 是其中的前端入口，提供各工具的可视化操作界面。

## 功能

- 私有文件与数据管理：文件浏览、上传下载、分享链接生成
- 服务器运维：仪表盘、进程与服务管理
- 下载中心：下载任务列表、进度展示、暂停 / 限速操作
- 用户与权限：登录、角色与令牌管理界面（`/auth/user`、`/auth/role`、`/auth/token`，入口仅管理员可见）
- 云服务：云厂商访问密钥管理（`/cloud/key`）与 KONG 网关站点管理 / 诊断（`/cloud/kong`），入口仅管理员可见
- 腾讯云：SSL 证书（申请 / 续期 / 部署到 KONG / 吊销）、域名与解析记录、轻量服务器（启停 / 重置密码）
  与防火墙规则（`/tencent/:id`，入口是密钥列表里「服务商为腾讯云」那条的「管理」），入口仅管理员可见
- 管理员：系统配置（`/admin/list`、`/admin/app`、`/admin/icp`）、操作日志（`/admin/operate`）与
  请求日志（`/admin/req`），入口仅管理员可见
- （规划中）家庭物联网：设备管理界面

## 技术栈

- [Angular](https://angular.dev) 22 · [ng-alain](https://ng-alain.com) 22
- [ng-zorro-antd](https://ng.ant.design) · Less
- 界面语言：**仅简体中文**（不做国际化，未引入 i18n 词典、`I18nPipe` 与语言切换；
  `app.config.ts` 里的 `defaultLang` 只提供 zh_CN 的地区数据供日期/数字管道使用）

## 部署

### 部署形态速览

| # | 方式 | 适用场景 | 需要的工具 |
| --- | --- | --- | --- |
| [1](#1-直接部署nginx-托管静态文件) | 直接部署 | 已有 nginx / 宿主机环境（最轻） | Node 24 + yarn，运行期只要 nginx |
| [2](#2-单容器部署) | 单容器部署 | 只想要「一个容器托住前端」 | Docker |
| [3](#3-直接多容器部署docker-run) | 直接多容器部署 | 前端与后端全部容器化、不用编排 | Docker |
| [4](#4-docker-compose-部署) | Docker Compose | 单机自托管（**推荐**） | Docker Compose v2 |
| [5](#5-kubernetes-部署) | Kubernetes | 已有集群、要声明式发布 | kubectl + Ingress 控制器 |
| [6](#6-配置项说明) | 配置项说明 | 以上任意方式 | — |

**三条前置约定**（与本项目「构建期不含环境信息」的设计直接相关，先读再选）：

1. **前端没有运行时环境变量。** 后端地址只由构建产物里的 `assets/config.json` 决定，镜像与构建产物可以跨环境复用。
   想「同一份产物切到另一个后端」，改那个 JSON 即可；不要指望 `yarn build` 时传什么变量。
2. **前端是纯静态站点，运行期没有 Node。** `Dockerfile` 只做 `nginx + dist` 的打包，构建发生在它之前（CI 或本地 `yarn build`）。
3. **连后端只有两条路线**：直连（`baseUrl` 填绝对地址，后端已 `enableCors`）或同源反代（`baseUrl` 填 `/api/`，反代层必须同时提供 `/api/` 与 `/socket.io/`）。
   选错的表现分别是「页面能开、接口全挂」与「实时通道静默退化为 5 秒轮询」，两种都不报错（详见 §1.3）。

### 1. 直接部署（nginx 托管静态文件）

最轻的形态：构建好把目录拷到 Web 服务器，运行期只需要 nginx。

#### 1.1 构建

```bash
yarn install --frozen-lockfile
yarn build          # 产物：dist/web/browser
```

- Node **24**（仓库 `.nvmrc` 为 `24.20.0`；Angular CLI 要求 ≥ 22.22.3）、yarn **1.22**。
- 开发态用 `yarn start`（默认 http://localhost:4200），需先启动后端 `atelierkit/api`（默认 3000 端口），
  否则初始化状态与登录接口都会连接失败。

#### 1.2 nginx 站点

把 `dist/web/browser` 整个目录拷到服务器（例如 `/var/www/atelierkit/web`），然后：

```nginx
# 放在 http {} 块里（与 server 同级）：只在真正升级时才发 Connection: upgrade
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
  listen 80;
  server_name _;
  root /var/www/atelierkit/web;
  index index.html;

  # 上传文件上限（下载中心 / 文件管理用得到）
  client_max_body_size 500m;

  gzip on;
  gzip_min_length 1k;
  gzip_comp_level 5;
  gzip_types text/plain text/css application/javascript application/json image/svg+xml;

  # SPA 兜底：前端用 hash 路由，刷新任意地址都要回 index.html
  location / {
    try_files $uri $uri/ /index.html;
  }

  # 运行时配置不要缓存，改完立即生效
  location = /assets/config.json {
    add_header Cache-Control 'no-store';
  }

  # 入口页同样不缓存，避免发版后仍指向旧的哈希资源
  location = /index.html {
    add_header Cache-Control 'no-store';
  }

  # 带内容哈希的构建产物可以长缓存
  location ~* \.(?:js|css|woff2?|ttf|eot|svg|png|jpe?g|gif|ico)$ {
    expires 30d;
    add_header Cache-Control 'public, immutable';
  }

  # 仅「同源反代」路线需要下面两段；直连路线可以删掉
  location /api/ {
    proxy_pass http://127.0.0.1:3000/;      # 末尾带 /：用前缀换掉 URL 前缀
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  location /socket.io/ {
    proxy_pass http://127.0.0.1:3000;       # ⚠ 末尾不能带 /：带斜杠会剥掉 /socket.io/ 前缀，握手 404
    proxy_http_version 1.1;                 # WebSocket 升级要求 1.1（默认 1.0 只能走长轮询）
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_buffering off;                    # 长轮询的响应要及时送出，不能被缓冲攒着
    proxy_read_timeout 600s;                # 默认 60s 对空闲的 WebSocket 偏短
    proxy_send_timeout 600s;
  }
}
```

#### 1.3 后端地址（运行时配置，无需重新构建）

```jsonc
// dist/web/browser/assets/config.json（源文件在 src/assets/config.json）
{
  "baseUrl": "//localhost:3000/"
}
```

`baseUrl` 由 `StartupService` 启动时读入并写入 `SettingsService`，`defaultInterceptor` 给所有相对路径请求补前缀；
`assets/*`、`//host/`、`http(s)://` 开头的地址不加前缀。

| 场景 | `baseUrl` 写法 | 反代层要求 |
| --- | --- | --- |
| 同机反代 | `/api/` | nginx 必须同时提供 `/api/`（末尾带 `/`）与 `/socket.io/`（末尾不带 `/`），见 §1.2 |
| 跨机直连 | `//192.168.1.3:3000/` | 无（后端已 `enableCors`，浏览器直连） |
| 独立域名 | `https://api.example.com/` | 无 |

- **应用名称与说明不在这个文件里**：由管理员在后台「配置 → 应用配置」（`/admin/app`）维护，
  经 `GET passport/app` 读取后写入页头与浏览器标题；未配置时前端退回内置名称「管理平台」。
- ⚠️ **走反代时必须在后端配 `SETUP_TOKEN`**：反代下后端看到的来源恒为 nginx（`127.0.0.1`），
  「内网 IP」闸门等于放行所有人，初始化接口会敞开（见 `atelierkit/api` README 的环境变量参考）。
- ⚠️ **`/api/` 与 `/socket.io/` 必须成对出现**：实时通道（行情页的 `data:changed` 信号）不走 HTTP 拦截器，
  按 socket.io 默认路径 `/socket.io/` 打到**页面所在的同一台 nginx**；漏掉它不会报错，只会落到 SPA 兜底返回 `index.html`，
  同步页顶部常驻「实时通道未连接，页面已改为每 5 秒自动刷新。」。
- 开发态 `proxy.conf.js` 默认留空（就是跨域直连），需要走代理时再放开示例；走代理时同样要给 `/socket.io`
  加一条带 `ws: true` 的规则（socket 的地址由 `baseUrl` 推导，不认代理表）。

#### 1.4 自检

```bash
# 页面与运行时配置可访问
curl -sI http://127.0.0.1/ | head -3
curl -s  http://127.0.0.1/assets/config.json

# 反代路线：先 200（polling 握手），再 101（升级为 WebSocket）
curl -si 'http://127.0.0.1/socket.io/?EIO=4&transport=polling' | head -3
```

浏览器 Network 里应依次出现 `/socket.io/?EIO=4&transport=polling` 的 `200` 与 `transport=websocket` 的 `101`。

### 2. 单容器部署

镜像只负责托管静态文件（`nginx:alpine` + `dist/web/browser`），**构建在镜像外完成**。

```bash
yarn build                                         # 产物必须在 docker build 之前存在
docker build -t atelierkit/web .
# 或直接用 CI 产出的镜像 ghcr.io/atelierkit/web:latest

# 运行时配置：把 src/assets/config.json 复制到仓库根再按环境改（别直接挂 dist/ 里那份，yarn build 会覆盖它）
cp src/assets/config.json config.json

docker run -d --name atelierkit-web --restart always \
  -p 8080:80 \
  -v "$PWD/config.json:/usr/share/nginx/html/assets/config.json:ro" \
  atelierkit/web
```

镜像内置的 `nginx.conf` 含 SPA 兜底、gzip、`index.html` 与 `assets/config.json` 不缓存、带哈希静态资源长缓存
（与 §1.2 同源，但没有 `/api/` 与 `/socket.io/` 两段反代）。

三个必须知道的点：

1. **镜像不含 `/api/` 与 `/socket.io/` 反代。** 它只托管静态文件，后端通常在后端容器里。要么把 `baseUrl` 填成完整后端地址（直连），
   要么在**宿主** nginx 上做那两条反代、再指到本容器（§3 给了网关容器的写法）。
2. **漏写 `-v` 不会报错，但后端地址会变回镜像里那份。** 镜像内打包的是 `assets/config.json`（`baseUrl=//localhost:3000/`），
   页面能打开、接口全打到访问者本机，极易被误判为后端故障。
3. **宿主机文件缺失时 Docker 会建一个同名目录**，`/assets/config.json` 变成 404，前端直接提示「未配置有效后端地址」。
   部署前先确认文件存在：`docker exec atelierkit-web cat /usr/share/nginx/html/assets/config.json`。

容器内 nginx 固定监听 **80**（见仓库根 `nginx.conf`），改端口只能改宿主机侧的 `-p`。镜像自带 `HEALTHCHECK`
（探测首页），`docker ps` 的 `STATUS` 会显示 `healthy`：

```bash
docker inspect -f '{{.State.Health.Status}}' atelierkit-web
```

### 3. 直接多容器部署（docker run）

前端与后端全部容器化但不引入编排时的最小组合：**一个自定义网络 + 前端容器 + 后端容器（含其 PG / Redis）**。
后端的容器化命令见 `atelierkit/api` README 的 §3，这里只补前端侧与「同源反代」的可选网关。

#### 3.1 直连方案（最简单，推荐先跑通）

```bash
docker network create atelierkit

# 前端：baseUrl 必须是「浏览器能访问」的后端地址（域名，或宿主机 IP:端口），不能写容器名
docker run -d --name atelierkit-web --network atelierkit --restart always \
  -p 8080:80 \
  -v "$PWD/config.json:/usr/share/nginx/html/assets/config.json:ro" \
  atelierkit/web
```

`config.json` 里的 `baseUrl` 填后端的可达地址，例如 `{"baseUrl":"//192.168.1.3:3000/"}`（后端容器需把 3000 映射到宿主机）。
前端与后端不同源，靠后端的 `enableCors({ origin: true })` 放行；socket.io 的连接地址由 `baseUrl` 推导，同样跨域，
后端 `DataGateway` 已开 `cors`。

#### 3.2 同源反代方案（可选网关容器）

需要「一个域名同时提供页面与接口」时，用 nginx 做网关，把 `config.json` 的 `baseUrl` 填成 `/api/`：

```bash
docker run -d --name atelierkit-gateway --network atelierkit --restart always \
  -p 80:80 \
  -v "$PWD/gateway.conf:/etc/nginx/nginx.conf:ro" \
  nginx:alpine
```

`gateway.conf` 必须是**整份 `nginx.conf`**（`map` 只能放在 `http {}` 层；塞进 `conf.d/default.conf` 会让 nginx 启动失败）：

```nginx
worker_processes auto;
events { worker_connections 1024; }

http {
  # WebSocket 升级：只在真正升级时才发 Connection: upgrade
  map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
  }

  server {
    listen 80;
    server_name _;

    location / {
      proxy_pass http://atelierkit-web:80;
      proxy_set_header Host $host;
    }

    location /api/ {
      proxy_pass http://atelierkit-api:3000/;   # 服务名按 api README 里的容器名改；末尾带 /
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /socket.io/ {
      proxy_pass http://atelierkit-api:3000;    # 末尾不带 /：保留 /socket.io/ 前缀
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection $connection_upgrade;
      proxy_set_header Host $host;
      proxy_buffering off;
      proxy_read_timeout 600s;
    }
  }
}
```

### 4. Docker Compose 部署

把下面内容存为**仓库根目录**的 `docker-compose.yml`，与 `config.json` 同层。前端只依赖「后端地址」，所以它既能和
`atelierkit/api` 的 compose 合并成一套完整栈，也能单独起一份指向已有的后端。

```yaml
name: atelierkit-web

services:
  web:
    image: ghcr.io/atelierkit/web:latest
    # 本地构建时改用下面一行（需先 yarn build，产物在 dist/web/browser）
    # build: { context: . }
    restart: unless-stopped
    ports:
      - '8080:80'
    environment:
      TZ: Asia/Shanghai
    volumes:
      # 后端地址走挂载：改完 docker compose up -d 即可生效，不必重建镜像
      - ./config.json:/usr/share/nginx/html/assets/config.json:ro
    healthcheck:
      test: ['CMD-SHELL', 'wget -qO- http://127.0.0.1/ >/dev/null || exit 1']
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s
```

常用的三条命令：

```bash
docker compose up -d
docker compose logs -f web
docker compose down            # 只有静态文件与一个只读挂载，加不加 -v 都不影响数据
```

两个容易出问题的点：

1. **`config.json` 的相对路径是相对 compose 文件**，不是相对当前目录。`./config.json` 即仓库根的 `config.json`
   （`src/assets/config.json` 的副本，部署时按环境改 `baseUrl`；**不要**直接挂 `dist/` 里的那份，`yarn build` 会覆盖它）。
2. **完整栈建议把 `web` 并入 `atelierkit/api` 的 compose**（同一 `name:` 下加一个 `web` 服务，`baseUrl` 填 `/api/`，
   并在网关或 `web` 容器前加 `/api/` 反代），否则前后端在两个 compose 项目里，网络与服务名不互通。

### 5. Kubernetes 部署

前提：镜像已推到集群可拉的仓库（CI 推 `ghcr.io/atelierkit/web`，私有仓库需配 `imagePullSecrets`）；
`config.json` 用 ConfigMap 提供，Ingress 负责把 `/api` 与 `/socket.io` 转发给后端（规则见 `atelierkit/api` README 的 §5.3）。

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: atelierkit-web-config
  namespace: atelierkit
data:
  config.json: |
    { "baseUrl": "/api/" }
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: atelierkit
spec:
  replicas: 2                     # 纯静态，可以多副本；与前端的单实例约束无关
  selector:
    matchLabels: { app: atelierkit-web }
  template:
    metadata:
      labels: { app: atelierkit-web }
    spec:
      containers:
        - name: web
          image: ghcr.io/atelierkit/web:latest
          ports:
            - { name: http, containerPort: 80 }
          volumeMounts:
            # subPath 挂载单个文件：覆盖镜像内打包的那份 config.json
            - name: web-config
              mountPath: /usr/share/nginx/html/assets/config.json
              subPath: config.json
              readOnly: true
          readinessProbe:
            httpGet: { path: /assets/config.json, port: http }
            initialDelaySeconds: 3
            periodSeconds: 10
          livenessProbe:
            httpGet: { path: /, port: http }
            initialDelaySeconds: 10
            periodSeconds: 20
          resources:
            requests: { cpu: 20m, memory: 32Mi }
            limits: { memory: 128Mi }
      volumes:
        - name: web-config
          configMap: { name: atelierkit-web-config }
---
apiVersion: v1
kind: Service
metadata:
  name: web
  namespace: atelierkit
spec:
  selector: { app: atelierkit-web }
  ports:
    - { name: http, port: 80, targetPort: http }
```

两个必须注意的点：

1. **`subPath` 挂载的 ConfigMap 不会热更新**：改完 ConfigMap 必须 `kubectl -n atelierkit rollout restart deploy/web`，
   否则容器里仍是旧文件（现象是「改完后端地址没生效」）。若要热更新，改成挂目录（`emptyDir` + initContainer 拷贝）
   或直接省掉这一步 —— 用域名切后端时根本不需要改它。
2. **`replicas` 可以大于 1**：前端无状态。但 §1.2 的 nginx 内建 SPA 兜底与缓存头在镜像里，多副本行为一致；
   `baseUrl` 用相对路径 `/api/` 时，反代（Ingress）必须与后端 routing 配套，否则接口 404。

### 6. 配置项说明

前端没有运行时环境变量 —— 下表就是全部可配置项。

| 配置 | 位置 | 生效时机 | 说明 |
| --- | --- | --- | --- |
| `baseUrl` | `assets/config.json` | 打入产物，运行期读取 | 后端地址。`/api/`（同源反代）、`//host:port/`（跨机直连）、`https://host/` 三种写法；**末尾 `/` 不能省**（拦截器直接拼接） |
| 应用名称 / 说明 | 后端「系统设置 → 应用配置」`/admin/app` | 运行时 `GET passport/app` | **不在 config.json 里**；未配置时退回内置名称「管理平台」 |
| ICP 备案信息 | 后端「系统设置 → 备案配置」`/admin/icp` | 运行时 `GET passport/icp` | 同上，与构建产物无关 |
| 监听端口 | 镜像内 `nginx.conf`（固定 `80`） | 构建镜像时 | 改端口只能改宿主机 `-p` / k8s `containerPort`，不要改容器内监听（`HEALTHCHECK` 与探针都按 80 写） |
| 上传上限 | 镜像内 `nginx.conf`（`client_max_body_size 500m`） | 构建镜像时 | 需要更大时改 `nginx.conf` 后重建镜像，或在反代层放大 |
| `TZ` | 容器环境变量 | 启动时 | 镜像已设 `Asia/Shanghai`；影响 nginx 访问日志时间戳 |
| 构建参数 | `angular.json` / `yarn build` | 构建时 | **没有任何后端地址相关的构建变量**：切换环境只改 `config.json`，不要重新构建 |

> 后端侧的全部环境变量（`POSTGRES_*`、`REDIS_*`、`SETUP_TOKEN`、`SETTING_KEY` 等）见 `atelierkit/api` README 的「环境变量参考」，
> 与本仓库无关 —— web 只需要知道「后端地址是什么」。

## 首次使用：创建管理员

刚部署好、后端还没建号时，**打不开登录页，会直接停在「创建管理员账号」页**：

1. 前端启动先 `GET /passport/init`；未初始化时除该页之外的所有路由都被重定向回这里，登录入口也不显示。
2. 填用户名 / 密码 / 确认密码（邮箱可选），如后端配了 `SETUP_TOKEN`，还要在「初始化凭据」里填同一个值。
3. 提交 `POST /passport/setup`，**成功即返回令牌并自动登录进首页**，不需要再输一次密码。
4. 初始化完成后该页永久关闭，再访问会被送回登录页。

日常登录只有**用户名 + 密码**（已移除邮箱验证码、手机验证码与自助注册入口；账号由管理员创建）。
令牌以 `token: <用户ID>:<随机码>` 请求头传递，失效时自动跳回登录页。

## 访问控制（管理员）

侧边栏「访问控制」分组只在当前账号带 `admin` 角色时出现（菜单项带 `acl: 'admin'`）。
**隐藏入口不等于鉴权**：后端 `@Allow('admin')` 会独立校验，非管理员直接打接口仍然是 403。

| 页面 | 路由 | 后端接口 |
| --- | --- | --- |
| 用户管理 | `/auth/user` | `GET auth/user/index`、`GET auth/user/show/:id`、`POST auth/user/create`、`POST auth/user/update/:id` |
| 角色管理 | `/auth/role` | `GET auth/role/index`、`GET auth/role/show/:id`、`POST auth/role/create`、`POST auth/role/update/:id`、`POST auth/role/sort` |
| 令牌管理 | `/auth/token` | `GET auth/token/index`、`DELETE auth/token/:id:code` |

- **建号必须带用户名与初始密码**：用户名 3-20 位字母 / 数字 / 下划线 / 短横线（提交前转小写，编辑态不可改）；
  密码 8-64 位且同时含字母和数字（与后端同一套策略）。账号建好后由用户自行改密。
- **管理端不改密码**：改密走用户自己的 `/user/password`，忘记密码走邮箱重置 —— 所以编辑弹窗里没有密码框。
- 邮箱是可选资料，留空即清空（后端把空串转 `NULL`，否则第二个不填邮箱的账号会撞唯一索引）。
- 角色列表支持**行拖拽排序**，`保存排序` 按当前行顺序重排 `sort`（从 1 递增），不用手填数字。
- 令牌存在后端 Redis 里，字段值都是字符串；`作废` 会让对应会话立即掉线，`过期时间` 为 0 表示长期有效。

## 腾讯云页面（`/tencent/:id`）

`id` 是**云服务密钥ID**（`cloud/key` 里的记录），页面数据全部由后端代取，浏览器不接触访问密钥。
旧私有项目（`marbleqi/web`）的同一模块已整体迁入，**与旧实现的差异是有意为之**：

1. **不再依赖 `@brand`**：旧布局用了 `service-layout`（侧边二级导航 + 地域子菜单）与 `page-bar`，
   本仓库没有这套组件 —— 现在布局是 `page-header` + 标签页（与 `/cloud/kong/:id` 一致），
   地域改成轻量服务器页头右侧的下拉（地址仍是 `lighthouse/:region`）。
2. **接口收在一个服务里**：旧的 `_HttpClient` 直接拼 URL、散落在各页面；现在统一走
   `routes/tencent/tencent.service.ts`（`HttpClient` + 明确的响应类型）。
3. **弹窗用 `NzModalService` + `NZ_MODAL_DATA`**：旧的 `ModalHelper.createStatic` 与 `modal-header/footer`
   模板块不再使用，按钮放在表单底部（`text-right pt-md`）。
4. **分页总数按接口实际字段取**（旧代码一律读顶层 `TotalCount`，DNS 与域名两页的分页器因此恒为 0）：
   证书 / 实例 / 防火墙用 `TotalCount`，域名用 `DomainCountInfo.DomainTotal`，解析记录用 `RecordCountInfo.TotalCount`。
5. **证书有效期不再在前端解 PEM**：KONG 证书对象的 `start` / `end` 由后端用 `crypto.X509Certificate`
   解析补上（秒级时间戳），前端用 `formatDateTime(at, 's')` 直接格式化。
6. **纯逻辑抽到 `tencent.format.ts`**（状态标签、续期判定 `canRenew`、规则转换 `rulePayload`、标签页下标 `tabIndexOf`）：
   覆盖率口径只统计「被 spec 加载过的文件」，从 `*.component.ts` 导入测试会把整片页面模块拖进分母（见 `vitest.config.ts` 注释）。

## 管理员页面（`/admin/*`）

侧边栏「管理员」分组同样带 `acl: 'admin'`，后端三个控制器（`admin/setting`、`admin/operate`、`admin/req`）全部 `@Allow('admin')`。

| 页面 | 路由 | 后端接口 |
| --- | --- | --- |
| 配置列表 | `/admin/list` | `GET admin/setting/index` |
| 应用配置 | `/admin/app` | `GET admin/setting/show/app`、`POST admin/setting/create`、`POST admin/setting/update/app` |
| 备案配置 | `/admin/icp` | 同上，编码换成 `icp` |
| 操作日志 | `/admin/operate` | `POST admin/operate/index`、`GET admin/operate/options` |
| 请求日志 | `/admin/req` | `POST admin/req/index`、`GET admin/req/{url,user,controller}`、`GET admin/req/action/:controller` |

迁移自旧私有项目（`marbleqi/web` 的 `routes/admin`），与旧实现的差异**是有意为之**：

1. **`admin/task` 与 `admin/dashboard` 不迁移**：前者表格列是用户字段（id / 邮箱 / 昵称 / 头像 / 角色），却调
   `kong/index`、`kong/show/:id`、`kong/create`（站点接口），后端也没有任务接口 —— 是从 Kong 页面复制的残骸；
   后者（`AdminKongDashboardComponent`）根本没挂在路由里，功能已被 `/cloud/kong/:id/dashboard` 取代。
2. **不再依赖 `@brand`**：旧布局用的 `service-layout` / `page-bar` / `ListComponent` / `PageListComponent` 本仓库都没有，
   现在是 `page-header` + `nz-card` + `sf` + `st`，服务端分页由页面自己管（`pi` / `ps` / `total` 三个 signal +
   `[page]="{ front: false }"` —— `front` 忘了关就会变成「只在当前页数据里翻页」，第 2 页永远是空的）。
3. **接口收在 `admin.service.ts`**：旧页面用 `_HttpClient` 直接拼 URL；现在统一 `HttpClient` + 明确的响应类型。
   两个日志接口在服务内先过 `cleanQuery`：剔除 `undefined` / `null` / 空串，但**保留 `0` 与 `false`** ——
   `userId=0` 是「系统操作」、`success=false` 是「只看异常请求」，按真值剔除就等于没筛选。
4. **纯逻辑抽到 `admin.format.ts`**（标签映射、`resultFilter`、`cleanQuery`、`isSlow`、`buildReqQuery`、两个详情字段组装），
   原因与 `tencent.format.ts` 相同：覆盖率只统计被 spec 加载过的文件，从 `*.component.ts` 导入测试会把整片页面模块拖进分母。
5. **重置查询条件要连回写变量一起清**：`sf` 的 `formData` 是单向输入，用户输入靠 `(formChange)` 回写进 signal；
   只调 `sf.reset()` 而不清 signal，重置后仍按上一次的条件查。
6. **配置未创建时按 404 判「新建」**：旧实现把任何加载失败都当成新建，网络抖动时会拿一份空表单去覆盖已有配置
   （只靠后端「主键已使用」兜底）；现在只有 404 才转新建态，其它错误只提示。

## 行情数据页面（`/data/*`）

侧边栏「行情数据」分组，仪表板排组第一、登录即可看（**不加 `acl`**，写操作由后端 `@Allow('admin')` 拦）。

| 页面 | 路由 | 后端接口 |
| --- | --- | --- |
| 仪表板（默认落地页） | `/data/dashboard` | `GET data/sync/snapshot` |
| 数据同步 | `/data/sync` | `GET data/sync/snapshot`、`POST data/sync/{start,pause}` |
| 数据浏览 | `/data/browser` | `GET data/{security,calendar,bar}` |

照 almanac 桌面端（WinUI 3）的语义重实现，**与桌面端共用卡片组件与状态源**是硬约束：

1. **四张同步卡只有一份实现**（`data/shared/sync-card/`），`showActions` 用 `input.required<boolean>()`（漏传编译报错）；
   仪表板传 `false`（连按钮都不渲染）、同步页传 `true`。**不许**仪表板另抄一份简化版卡片。
2. **两页共用同一个 `data.store.ts`**（`providedIn: 'root'` 的 signal store），页面里**不得**各自调 `data/sync/snapshot`
   —— 那会得到「第二份镜像」，两页迟早显示不同的数。
3. **实时进度走 socket.io 信号式**（`data.realtime.ts`）：WS 只收 `data:changed`（载荷只有 reason + at），
   数值一律走 HTTP 快照；前端频率闸门 1s、终态无条件刷新。依赖 `socket.io-client`。
   - ⚠ **建连地址必须显式传后端 origin**（`apiOriginOf(baseUrl, location.href)`）：socket 不走 HTTP 拦截器，
     `io()` 空参连的是**前端页面源**（dev 的 `:4200` / 生产 nginx 的 `:80`），握手必然 404 且静默失败。
     后端 `DataGateway` 相应开了 `cors`，否则跨域 polling 仍会被浏览器拦掉。
     ⇒ 生产用 `/api/` 同机反代时，nginx 必须补一条 `/socket.io/`（含 WebSocket 升级），写法见上文「部署 → 1.2 nginx 站点」。
   - ⚠ **必须有兜底轮询**：通道连不上（地址 / CORS / 代理任一处不对）时每 5s 拉一次快照，并在同步页给出提示；
     只靠实时信号的话，界面会永远停在首屏那一次快照上（「后端在跑、页面不动」）。
   - 节流是 **leading + trailing**（被挡下的那一次在窗口结束时补拉），且只接受最后发起的响应（旧响应后到即丢弃）。
4. **纯逻辑抽到 `data.format.ts` / `browser/browser.format.ts`**（量纲、预计完成时间四档格式、涨跌三色、
   日历网格三态、证券标签映射），原因与 `admin.format.ts` 相同：从组件导入测试会把整片页面模块拖进覆盖率分母。
5. **界面用 ng-zorro/ng-alain 组件**：四卡照 `kong/dashboard` 的 `nz-row + nz-col + nz-card` 写法（不引 `nz-statistic`）；
   列表用 `st`；日历 12 月卡 × 42 格**自绘**（`nz-date-picker` 分不清「休市」与「日历没同步」的三态）。
6. **涨跌色走 `theme.less` 的 `@market-up/@market-down/@market-flat` 变量**（涨红跌绿，A 股约定），
   组件通过 `market-up/market-down/market-flat` class 引用，不在组件里写死色值。
7. **日历接口只返回存在的行、不补空行**：三态（开市 / 有记录休市 / 无记录=未同步）靠这个保证。
   K 线的 `truncated`（超 5000 根只保留最近 5000）由服务端给出，不是前端硬编码。

## 常见状态码

| 状态码 | 含义 | 处理 |
| --- | --- | --- |
| `428` | 系统尚未初始化 | 正常会自动跳创建页；若没跳，检查 `config.json` 的 `baseUrl` 是否指向正确后端 |
| `403` | 初始化凭据无效或来源不被允许 | 核对后端 `SETUP_TOKEN` 与表单里的「初始化凭据」是否一致 |
| `409` | 已完成初始化 / 用户名已被占用 | 前者直接去登录；后者换用户名 |
| `401` | 用户名或密码不正确 | 页面内联提示，不会跳转 |
| `410` | 自助注册已关闭 | 账号需由管理员创建 |
| 网络错误（`status 0`） | 后端未启动 / `baseUrl` 写错 / 跨域被拦 | 先在浏览器直接访问 `baseUrl + passport/init` 验证 |

> 顶栏的「清理本地缓存」会清掉本地令牌与本地设置，登录状态异常时可先用它再刷新。

## 测试与提交门禁

```bash
# 单元测试（浏览器模式，Chromium 由 Playwright 驱动）
yarn test

# 覆盖率
yarn test-coverage
```

仓库用 [husky](https://typicode.github.io/husky/) 挂了 `pre-commit` 钩子，**测试不通过就提交不了**，顺序为：

1. `tsc -p tsconfig.app.json --noEmit`（类型检查）
2. `lint-staged`（对暂存文件跑 eslint / stylelint）
3. `ng test --watch=false`（单元测试）

- 钩子由 `yarn install` 自动装好（`prepare: husky`，定义在 `.husky/pre-commit`），新克隆的仓库无需额外操作。
- 单元测试跑在真实 Chromium 里：新机器若报找不到浏览器，先执行一次 `npx playwright install chromium`。
- 应急绕过用 `git commit --no-verify`。

### 覆盖率

`yarn test-coverage`（= `ng test -c coverage --coverage --watch=false`）会跑覆盖率并校验 `vitest.config.ts` 里的
`coverage.thresholds`（当前 92/90/78/88：行/语句/分支/函数），不达标直接失败（CI 跑的就是这条）。

当前承诺的是 **core 层**：`passport.service`、`refresh-token`、`helper`、`setup.guard`、`start-page.guard` 为 100%，
`startup.service` 约 95%、`default.interceptor` 约 82%，整体约 **95% 行 / 98% 函数 / 85% 分支**。
访问控制部分的 `auth.service`（含接口路径 / 方法 / 提交体）与 `utils/token` 为 100%。
页面组件尚未补 TestBed 用例，`@angular/build:unit-test` 只统计被用例加载过的文件，所以它们在报告里不出现
（注：在该配置里写 `coverage.include` 会与 builder 冲突、覆盖率被算成 0%，不要加）。

## 目录结构

```
src/app/
├── core/     # 核心服务与拦截器
├── layout/   # 布局
├── routes/   # 各功能路由页（auth = 用户 / 角色 / 令牌；cloud = 密钥 / KONG；tencent = 腾讯云；admin = 配置 / 日志）
└── shared/   # 共享组件与模块、工具函数（utils/token 为令牌档位）
```

## License

[MIT](./LICENSE)
