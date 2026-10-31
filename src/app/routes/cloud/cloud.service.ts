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
}
