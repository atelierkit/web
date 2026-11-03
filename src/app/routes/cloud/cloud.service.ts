import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/** 云服务商标识，注：与后端 KEY_PROVIDERS 保持一致 */
export type CloudProvider = 'aws' | 'aliyun' | 'tencent';

/** 对象的创建 / 更新审计信息 */
export interface CloudAudit {
  /** 操作用户ID */
  userId: number;
  /** 操作类型 */
  operate: string;
  /** 操作序号 */
  operateId: number;
  /** 请求日志ID */
  reqId: number;
  /** 操作时间 */
  at: number;
}

/** 云服务密钥，注：后端不下发 secret，浏览器里永远拿不到访问密钥 */
export interface CloudKey {
  /** 密钥ID */
  id: number;
  /** 密钥名称 */
  name: string;
  /** 密钥说明 */
  description: string;
  /** 云服务商 */
  provider: CloudProvider;
  /** 访问密钥 ID */
  key: string;
  /** 状态，true表示启用 */
  status: boolean;
  /** 创建信息 */
  create?: Partial<CloudAudit>;
  /** 更新信息 */
  update?: Partial<CloudAudit>;
}

/** 密钥提交信息 */
export interface KeyPayload {
  /** 密钥名称 */
  name: string;
  /** 密钥说明 */
  description: string;
  /** 云服务商 */
  provider: CloudProvider;
  /** 访问密钥 ID */
  key: string;
  /** 状态，true表示启用 */
  status: boolean;
  /**
   * 访问密钥 Secret
   *
   * 注：新建必填；更新时留空表示**保持原值**（详情接口不回填 secret，故不提交即不改）
   */
  secret?: string;
}

/** KONG 网关站点 */
export interface CloudKong {
  /** 实例ID */
  id: number;
  /** 实例名称 */
  name: string;
  /** 实例说明 */
  description: string;
  /** Admin API 地址 */
  url: string;
  /** 状态，true表示启用 */
  status: boolean;
  /** 创建信息 */
  create?: Partial<CloudAudit>;
  /** 更新信息 */
  update?: Partial<CloudAudit>;
}

/** 网关概览，注：与后端 `KongSummary` 一一对应 */
export interface KongSummary {
  /** Kong 版本 */
  version: string;
  /** 版本类型，`community` 为社区版、`enterprise` 为企业版 */
  edition: string;
  /** 主机名 */
  hostname: string;
  /** 节点ID */
  nodeId: string;
  /** Lua 运行时版本 */
  luaVersion: string;
  /** 服务端可用插件数 */
  pluginCount: number;
  /** 集群内已启用的插件数 */
  enabledCount: number;
  /** 当前活跃连接数 */
  connectionsActive: number;
  /** 累计请求数 */
  totalRequests: number;
  /** 数据库是否可达，注：无数据库模式下为 `null`（不适用） */
  dbReachable: boolean | null;
}

/** 站点提交信息 */
export interface KongPayload {
  /** 实例名称 */
  name: string;
  /** 实例说明 */
  description: string;
  /** Admin API 地址 */
  url: string;
  /** 状态，true表示启用 */
  status: boolean;
}

/**
 * Docker 宿主机
 *
 * 注：`key`（客户端私钥）**永不下发**，详情只回 `hasKey` 告诉页面「已配置」；
 * 编辑时私钥留空即表示保持原值
 */
export interface CloudDocker {
  /** 实例ID */
  id: number;
  /** 实例名称 */
  name: string;
  /** 实例说明 */
  description: string;
  /** daemon 地址 */
  endpoint: string;
  /** 是否启用 TLS 客户端证书 */
  tls: boolean;
  /** CA 证书 PEM */
  ca: string;
  /** 客户端证书 PEM */
  cert: string;
  /** 是否校验证书链与主机名 */
  verify: boolean;
  /** 手工指定的 API 版本，空串表示自动探测 */
  apiVersion: string;
  /** 状态，true表示启用 */
  status: boolean;
  /** 是否已配置客户端私钥 */
  hasKey: boolean;
  /** 创建信息 */
  create?: Partial<CloudAudit>;
  /** 更新信息 */
  update?: Partial<CloudAudit>;
}

/** 宿主机提交信息 */
export interface DockerPayload {
  /** 实例名称 */
  name: string;
  /** 实例说明 */
  description: string;
  /** daemon 地址 */
  endpoint: string;
  /** 是否启用 TLS 客户端证书 */
  tls: boolean;
  /** CA 证书 PEM */
  ca?: string;
  /** 客户端证书 PEM */
  cert?: string;
  /**
   * 客户端私钥 PEM
   *
   * 注：新建时启用 TLS 必填；更新时留空表示保持原值（详情不回报文，故不提交即不改）
   */
  key?: string;
  /** 是否校验证书链与主机名 */
  verify: boolean;
  /** 手工指定的 API 版本 */
  apiVersion?: string;
  /** 是否允许明文连接，注：明文 daemon 没有鉴权，必须由用户显式确认 */
  allowInsecure?: boolean;
  /** 状态，true表示启用 */
  status: boolean;
}

/** 宿主机概览，注：与后端 `DockerSummary` 一一对应 */
export interface DockerSummary {
  /** daemon 版本 */
  version: string;
  /** API 版本 */
  apiVersion: string;
  /** 操作系统 */
  os: string;
  /** CPU 架构 */
  arch: string;
  /** 内核版本 */
  kernelVersion: string;
  /** 主机名 */
  name: string;
  /** 容器总数 */
  containers: number;
  /** 运行中的容器数 */
  containersRunning: number;
  /** 暂停的容器数 */
  containersPaused: number;
  /** 已停止的容器数 */
  containersStopped: number;
  /** 镜像总数 */
  images: number;
  /** CPU 核数 */
  cpus: number;
  /** 内存总量（字节） */
  memoryTotal: number;
  /** 存储驱动 */
  driver: string;
  /** 数据根目录 */
  dockerRootDir: string;
  /** 默认运行时 */
  defaultRuntime: string;
  /** swarm 是否启用 */
  swarmActive: boolean;
}

/** 宿主机诊断，注：与后端 `DockerDiagnose` 一一对应 */
export interface DockerDiagnose {
  /** `_ping` 往返耗时（毫秒） */
  latencyMs: number;
  /** `_ping` 的原始响应 */
  ping: string;
  /** daemon 版本 */
  version: string;
  /** daemon 的 API 版本 */
  apiVersion: string;
  /** 本次实际使用的 API 版本 */
  usedApiVersion: string;
  /** 实际使用的协议 */
  protocol: string;
  /** 是否启用了 TLS 客户端证书 */
  tls: boolean;
  /** 是否校验证书链 */
  verify: boolean;
  /** 风险提示 */
  warnings: string[];
}

/**
 * 远程主机（Linux / SSH）
 *
 * 注：`password` / `privateKey` / `passphrase` **永不下发**，详情只回 `hasXxx` 告诉页面「已配置」；
 * 编辑时留空即表示保持原值
 */
export interface CloudRemote {
  /** 主机ID */
  id: number;
  /** 主机名称 */
  name: string;
  /** 主机说明 */
  description: string;
  /** 主机名或 IP */
  host: string;
  /** SSH 端口 */
  port: number;
  /** 鉴权方式 */
  authType: 'password' | 'key';
  /** 登录用户 */
  username: string;
  /** 终端字符集 */
  charset: string;
  /** 主机公钥指纹，空串表示尚未信任（首连 TOFU） */
  fingerprint: string;
  /** SFTP 起始目录 */
  rootPath: string;
  /** 状态，true表示启用 */
  status: boolean;
  /** 是否已配置密码 */
  hasPassword: boolean;
  /** 是否已配置私钥 */
  hasKey: boolean;
  /** 是否已配置私钥口令 */
  hasPassphrase: boolean;
  /** 创建信息 */
  create?: Partial<CloudAudit>;
  /** 更新信息 */
  update?: Partial<CloudAudit>;
}

/** 远程主机提交信息 */
export interface RemotePayload {
  /** 主机名称 */
  name: string;
  /** 主机说明 */
  description: string;
  /** 主机名或 IP */
  host: string;
  /** SSH 端口 */
  port: number;
  /** 鉴权方式 */
  authType: 'password' | 'key';
  /** 登录用户 */
  username: string;
  /** 登录密码，注：留空表示保持原值（切换鉴权方式时由后端清空另一套） */
  password?: string;
  /** 客户端私钥，注：留空表示保持原值 */
  privateKey?: string;
  /** 私钥口令，注：留空表示保持原值 */
  passphrase?: string;
  /** 终端字符集 */
  charset: string;
  /** SFTP 起始目录 */
  rootPath: string;
  /** 状态，true表示启用 */
  status: boolean;
}

/** 远程主机概览，注：与后端 `RemoteSummary` 一一对应 */
export interface RemoteSummary {
  /** 发行版名称 */
  osName: string;
  /** 内核版本 */
  kernel: string;
  /** CPU 架构 */
  arch: string;
  /** 连续运行秒数 */
  uptime: number;
  /** CPU 核数 */
  cpus: number;
  /** 1 分钟平均负载 */
  load1: number;
  /** 5 分钟平均负载 */
  load5: number;
  /** 15 分钟平均负载 */
  load15: number;
  /** 内存总量（字节） */
  memoryTotal: number;
  /** 可用内存（字节） */
  memoryAvailable: number;
  /** 根分区总量（字节） */
  diskTotal: number;
  /** 根分区已用（字节） */
  diskUsed: number;
  /** 根分区使用率（百分比整数） */
  diskPercent: number;
  /** 当前登录用户 */
  user: string;
}

/** 诊断单阶段，注：后端按「网络可达 → 握手 → 认证 → 命令执行 → 主机身份」顺序下发 */
export interface RemoteDiagnoseStage {
  /** 阶段名 */
  name: string;
  /** 是否通过 */
  ok: boolean;
  /** 耗时（毫秒） */
  latencyMs: number;
  /** 附加信息 */
  detail: string;
}

/** 远程主机诊断，注：与后端 `RemoteDiagnose` 一一对应 */
export interface RemoteDiagnose {
  /** 是否全部通过 */
  ok: boolean;
  /** 各阶段结果 */
  stages: RemoteDiagnoseStage[];
  /** 已记录的指纹 */
  fingerprint: string;
  /** 当前握手到的指纹 */
  currentFingerprint: string;
  /** `uname -a` 输出 */
  uname: string;
  /** 风险提示 */
  warnings: string[];
}

/** 终端票据，注：一次性、60 秒有效，WS 用它换连接 */
export interface RemoteTicket {
  /** 票据串 */
  ticket: string;
  /** 失效时刻（Unix 毫秒） */
  expiresAt: number;
}

/**
 * Kubernetes 集群
 *
 * 注：`token` 与客户端私钥**永不下发**，详情只回 `hasToken` / `hasKey`；
 * 编辑时两者留空即表示保持原值（要清空得靠 `clearToken` / `clearCert` 开关）
 */
export interface CloudKubernetes {
  /** 集群ID */
  id: number;
  /** 集群名称 */
  name: string;
  /** 集群说明 */
  description: string;
  /** API Server 地址 */
  endpoint: string;
  /** CA 证书 PEM */
  ca: string;
  /** 客户端证书 PEM */
  cert: string;
  /** 是否校验证书链与主机名 */
  verify: boolean;
  /** 默认命名空间 */
  namespace: string;
  /** 状态，true表示启用 */
  status: boolean;
  /** 是否已配置 Token */
  hasToken: boolean;
  /** 是否已配置客户端私钥 */
  hasKey: boolean;
  /** 创建信息 */
  create?: Partial<CloudAudit>;
  /** 更新信息 */
  update?: Partial<CloudAudit>;
}

/** 集群提交信息 */
export interface KubernetesPayload {
  /** 集群名称 */
  name: string;
  /** 集群说明 */
  description: string;
  /** API Server 地址 */
  endpoint: string;
  /**
   * ServiceAccount Token
   *
   * 注：新建时与客户端证书二选一（至少给一个）；更新时留空表示保持原值
   */
  token?: string;
  /** CA 证书 PEM */
  ca?: string;
  /** 客户端证书 PEM */
  cert?: string;
  /** 客户端私钥 PEM，注：更新时留空表示保持原值 */
  key?: string;
  /** 是否校验证书链与主机名 */
  verify: boolean;
  /** 默认命名空间 */
  namespace: string;
  /** 是否清空 Token，注：只在「切换到客户端证书」时需要 */
  clearToken?: boolean;
  /** 是否清空客户端证书三件套 */
  clearCert?: boolean;
  /** 是否允许明文连接，注：明文会把 Token 暴露在链路上，必须由用户显式确认 */
  allowInsecure?: boolean;
  /** 状态，true表示启用 */
  status: boolean;
}

/** 集群概览，注：与后端 `KubernetesSummary` 一一对应 */
export interface KubernetesSummary {
  /** 集群版本 */
  version: string;
  /** 平台 */
  platform: string;
  /** Go 版本 */
  goVersion: string;
  /** 节点总数 */
  nodes: number;
  /** 就绪节点数 */
  nodesReady: number;
  /** 命名空间数 */
  namespaces: number;
  /** Pod 总数 */
  pods: number;
  /** 运行中的 Pod 数 */
  podsRunning: number;
  /** 等待中的 Pod 数 */
  podsPending: number;
  /** 失败的 Pod 数 */
  podsFailed: number;
  /** 已完成的 Pod 数 */
  podsSucceeded: number;
  /** 工作负载数 */
  deployments: number;
  /** Service 数 */
  services: number;
  /** 可分配 CPU 总核数 */
  cpuCapacity: number;
  /** 可分配内存总量（字节） */
  memoryCapacity: number;
}

/** 集群诊断，注：与后端 `KubernetesDiagnose` 一一对应 */
export interface KubernetesDiagnose {
  /** `/healthz` 往返耗时（毫秒） */
  latencyMs: number;
  /** `/healthz` 的原始响应 */
  ping: string;
  /** 集群版本 */
  version: string;
  /** 平台 */
  platform: string;
  /** 实际使用的鉴权方式，`token` / `cert` / `anonymous` */
  authMode: string;
  /** 实际使用的协议 */
  protocol: string;
  /** 是否校验证书链 */
  verify: boolean;
  /** 风险提示 */
  warnings: string[];
}

/**
 * 云服务（管理端接口）
 *
 * 注：密钥与 KONG 网关站点同属「云服务」一个导航区，接口前缀统一为 `cloud/`；
 * 所有接口都要求管理员角色，服务端由 `TokenGuard` 依据 `@Allow('admin')` 校验
 */
@Injectable({ providedIn: 'root' })
export class CloudService {
  private readonly http = inject(HttpClient);

  /**
   * 获取密钥清单
   *
   * @param operateId 操作序号，注：-1 表示取全量
   * @returns 密钥清单
   */
  keys(operateId = -1): Observable<CloudKey[]> {
    return this.http.get<CloudKey[]>('cloud/key/index', {
      params: { operateId },
    });
  }

  /**
   * 获取密钥详情
   *
   * @param id 密钥ID
   * @returns 密钥详情，注：不含 secret
   */
  key(id: number): Observable<CloudKey> {
    return this.http.get<CloudKey>(`cloud/key/show/${id}`);
  }

  /**
   * 创建密钥
   *
   * @param value 密钥信息（含 secret）
   * @returns 新密钥ID
   */
  createKey(value: KeyPayload): Observable<unknown> {
    return this.http.post('cloud/key/create', value);
  }

  /**
   * 更新密钥
   *
   * @param id 密钥ID
   * @param value 密钥信息，注：不传 secret 表示保持原值
   * @returns 密钥ID
   */
  updateKey(id: number, value: KeyPayload): Observable<unknown> {
    return this.http.post(`cloud/key/update/${id}`, value);
  }

  /**
   * 获取 KONG 网关站点清单
   *
   * @param operateId 操作序号，注：-1 表示取全量
   * @returns 站点清单
   */
  kongs(operateId = -1): Observable<CloudKong[]> {
    return this.http.get<CloudKong[]>('cloud/kong/index', {
      params: { operateId },
    });
  }

  /**
   * 获取站点详情
   *
   * @param id 站点ID
   * @returns 站点详情
   */
  kong(id: number): Observable<CloudKong> {
    return this.http.get<CloudKong>(`cloud/kong/show/${id}`);
  }

  /**
   * 获取站点变更历史
   *
   * @param id 站点ID
   * @returns 变更记录
   */
  kongLog(id: number): Observable<CloudKong[]> {
    return this.http.get<CloudKong[]>(`cloud/kong/log/${id}`);
  }

  /**
   * 创建站点
   *
   * @param value 站点信息
   * @returns 新站点ID
   */
  createKong(value: KongPayload): Observable<unknown> {
    return this.http.post('cloud/kong/create', value);
  }

  /**
   * 更新站点
   *
   * @param id 站点ID
   * @param value 站点信息
   * @returns 站点ID
   */
  updateKong(id: number, value: KongPayload): Observable<unknown> {
    return this.http.post(`cloud/kong/update/${id}`, value);
  }

  /**
   * 获取网关概览
   *
   * 注：后端把 Kong 的 `/`（版本、插件）与 `/status`（连接、数据库）合并成一份下发；
   * 旧私有项目读的 `/default/license/report` 是企业版专属接口，社区版恒为 404
   *
   * @param id 站点ID
   * @returns 概览
   */
  kongSummary(id: number): Observable<KongSummary> {
    return this.http.get<KongSummary>(`cloud/kong/summary/${id}`);
  }

  /**
   * 获取网关已启用的插件清单
   *
   * @param id 站点ID
   * @returns 插件名清单，注：后端已把 `{ enabled_plugins }` 拆成数组
   */
  kongPlugin(id: number): Observable<string[]> {
    return this.http.get<string[]>(`cloud/kong/plugin/${id}`);
  }

  /**
   * 获取 Docker 宿主机清单
   *
   * @param operateId 操作序号，注：-1 表示取全量
   * @returns 宿主机清单，注：不含客户端私钥
   */
  dockers(operateId = -1): Observable<CloudDocker[]> {
    return this.http.get<CloudDocker[]>('cloud/docker/index', {
      params: { operateId },
    });
  }

  /**
   * 获取宿主机详情
   *
   * @param id 宿主机ID
   * @returns 宿主机详情，注：不含客户端私钥，只有 `hasKey`
   */
  docker(id: number): Observable<CloudDocker> {
    return this.http.get<CloudDocker>(`cloud/docker/show/${id}`);
  }

  /**
   * 获取宿主机变更历史
   *
   * @param id 宿主机ID
   * @returns 变更记录
   */
  dockerLog(id: number): Observable<CloudDocker[]> {
    return this.http.get<CloudDocker[]>(`cloud/docker/log/${id}`);
  }

  /**
   * 创建宿主机
   *
   * @param value 宿主机信息
   * @returns 新宿主机ID
   */
  createDocker(value: DockerPayload): Observable<unknown> {
    return this.http.post('cloud/docker/create', value);
  }

  /**
   * 更新宿主机
   *
   * @param id 宿主机ID
   * @param value 宿主机信息，注：`key` 留空表示保持原值
   * @returns 宿主机ID
   */
  updateDocker(id: number, value: DockerPayload): Observable<unknown> {
    return this.http.post(`cloud/docker/update/${id}`, value);
  }

  /**
   * 获取宿主机概览
   *
   * 注：后端把 daemon 的 `/version` 与 `/info` 合并成一份下发，前端一次请求即可渲染仪表板
   *
   * @param id 宿主机ID
   * @returns 概览
   */
  dockerSummary(id: number): Observable<DockerSummary> {
    return this.http.get<DockerSummary>(`cloud/docker/summary/${id}`);
  }

  /**
   * 获取宿主机诊断
   *
   * @param id 宿主机ID
   * @returns 诊断结果，注：风险项由后端判定，前端原样展示
   */
  dockerDiagnose(id: number): Observable<DockerDiagnose> {
    return this.http.get<DockerDiagnose>(`cloud/docker/diagnose/${id}`);
  }

  /**
   * 获取远程主机清单
   *
   * @param operateId 操作序号，注：-1 表示取全量
   * @returns 主机清单，注：不含登录凭据
   */
  remotes(operateId = -1): Observable<CloudRemote[]> {
    return this.http.get<CloudRemote[]>('cloud/remote/index', {
      params: { operateId },
    });
  }

  /**
   * 获取远程主机详情
   *
   * @param id 主机ID
   * @returns 主机详情，注：不含凭据，只有 `hasXxx`
   */
  remote(id: number): Observable<CloudRemote> {
    return this.http.get<CloudRemote>(`cloud/remote/show/${id}`);
  }

  /**
   * 获取远程主机变更历史
   *
   * @param id 主机ID
   * @returns 变更记录
   */
  remoteLog(id: number): Observable<CloudRemote[]> {
    return this.http.get<CloudRemote[]>(`cloud/remote/log/${id}`);
  }

  /**
   * 创建远程主机
   *
   * @param value 主机信息
   * @returns 新主机ID
   */
  createRemote(value: RemotePayload): Observable<unknown> {
    return this.http.post('cloud/remote/create', value);
  }

  /**
   * 更新远程主机
   *
   * @param id 主机ID
   * @param value 主机信息，注：凭据留空表示保持原值
   * @returns 主机ID
   */
  updateRemote(id: number, value: RemotePayload): Observable<unknown> {
    return this.http.post(`cloud/remote/update/${id}`, value);
  }

  /**
   * 获取远程主机概览
   *
   * @param id 主机ID
   * @returns 概览
   */
  remoteSummary(id: number): Observable<RemoteSummary> {
    return this.http.get<RemoteSummary>(`cloud/remote/summary/${id}`);
  }

  /**
   * 获取远程主机诊断
   *
   * @param id 主机ID
   * @returns 分阶段诊断结果，注：风险项由后端判定，前端原样展示
   */
  remoteDiagnose(id: number): Observable<RemoteDiagnose> {
    return this.http.get<RemoteDiagnose>(`cloud/remote/diagnose/${id}`);
  }

  /**
   * 申请终端票据
   *
   * 注：WS 不受后端全局守卫保护，故终端连接必须先在这里拿到一次性票据 ——
   * 令牌与 admin 角色在这一步校验，WS 只认票据
   *
   * @param id 主机ID
   * @param cols 终端列数
   * @param rows 终端行数
   * @returns 票据
   */
  remoteTicket(id: number, cols: number, rows: number): Observable<RemoteTicket> {
    return this.http.post<RemoteTicket>('cloud/remote/ticket', { id, cols, rows });
  }

  /**
   * 信任主机的新指纹
   *
   * @param id 主机ID
   * @param fingerprint 当前握手到的指纹
   * @returns 主机ID
   */
  trustRemote(id: number, fingerprint: string): Observable<unknown> {
    return this.http.post('cloud/remote/trust', { id, fingerprint });
  }

  /**
   * 获取 Kubernetes 集群清单
   *
   * @param operateId 操作序号，注：-1 表示取全量
   * @returns 集群清单，注：不含凭据
   */
  kubernetesList(operateId = -1): Observable<CloudKubernetes[]> {
    return this.http.get<CloudKubernetes[]>('cloud/kubernetes/index', {
      params: { operateId },
    });
  }

  /**
   * 获取集群详情
   *
   * @param id 集群ID
   * @returns 集群详情，注：不含 Token / 私钥，只有 `hasToken` / `hasKey`
   */
  kubernetes(id: number): Observable<CloudKubernetes> {
    return this.http.get<CloudKubernetes>(`cloud/kubernetes/show/${id}`);
  }

  /**
   * 获取集群变更历史
   *
   * @param id 集群ID
   * @returns 变更记录
   */
  kubernetesLog(id: number): Observable<CloudKubernetes[]> {
    return this.http.get<CloudKubernetes[]>(`cloud/kubernetes/log/${id}`);
  }

  /**
   * 创建集群
   *
   * @param value 集群信息
   * @returns 新集群ID
   */
  createKubernetes(value: KubernetesPayload): Observable<unknown> {
    return this.http.post('cloud/kubernetes/create', value);
  }

  /**
   * 更新集群
   *
   * @param id 集群ID
   * @param value 集群信息，注：`token` / `key` 留空表示保持原值
   * @returns 集群ID
   */
  updateKubernetes(id: number, value: KubernetesPayload): Observable<unknown> {
    return this.http.post(`cloud/kubernetes/update/${id}`, value);
  }

  /**
   * 获取集群概览
   *
   * 注：后端把版本、节点、Pod、工作负载、Service 六次探测合并成一份下发
   *
   * @param id 集群ID
   * @returns 概览
   */
  kubernetesSummary(id: number): Observable<KubernetesSummary> {
    return this.http.get<KubernetesSummary>(`cloud/kubernetes/summary/${id}`);
  }

  /**
   * 获取集群诊断
   *
   * @param id 集群ID
   * @returns 诊断结果，注：风险项由后端判定，前端原样展示
   */
  kubernetesDiagnose(id: number): Observable<KubernetesDiagnose> {
    return this.http.get<KubernetesDiagnose>(`cloud/kubernetes/diagnose/${id}`);
  }
}
