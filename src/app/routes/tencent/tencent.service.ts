import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of, tap } from 'rxjs';

/** 腾讯云业务错误 */
export interface TencentError {
  /** 错误码，如 `AuthFailure.SignatureFailure` */
  Code?: string;
  /** 错误说明 */
  Message?: string;
}

/**
 * 腾讯云响应的公共字段
 *
 * 注：腾讯云的**业务错误也是 HTTP 200**，错误在 `Error` 里，所以每个页面都要先看它再取数据
 */
interface TencentBase {
  /** 请求 ID */
  RequestId?: string;
  /** 业务错误 */
  Error?: TencentError;
}

/** SSL 证书 */
export interface SslCertificate {
  /** 证书ID */
  CertificateId: string;
  /** 备注别名 */
  Alias?: string;
  /** 主域名 */
  Domain?: string;
  /** 申请域名（含 SAN） */
  CertSANs?: string[];
  /** 生效时间 */
  CertBeginTime?: string;
  /** 到期时间 */
  CertEndTime?: string;
  /** 申请时间 */
  InsertTime?: string;
  /** 认证截止时间 */
  DVAuthDeadline?: string;
  /** 认证通过时间 */
  ValidationPassedTime?: string;
  /** 状态码 */
  Status?: number;
  /** 状态说明 */
  StatusName?: string;
}

/** 证书列表响应 */
export interface SslListResponse extends TencentBase {
  /** 证书列表 */
  Certificates?: SslCertificate[];
  /** 总数 */
  TotalCount?: number;
}

/** 证书详情响应 */
export interface SslDetailResponse extends TencentBase {
  /** 证书公钥（PEM） */
  CertificatePublicKey?: string;
  /** 证书私钥（PEM） */
  CertificatePrivateKey?: string;
}

/** 证书申请响应 */
export interface SslApplyResponse extends TencentBase {
  /** 新证书ID */
  CertificateId?: string;
}

/** 证书申请入参 */
export interface SslApplyPayload {
  /** 域名 */
  DomainName: string;
  /** 验证方式 */
  DvAuthMethod: string;
  /** 原证书ID，注：续期时传入以建立续期关系 */
  OldCertificateId?: string;
}

/** 证书部署入参 */
export interface SslDeployPayload {
  /** 证书ID */
  CertificateId: string;
  /** 证书域名列表 */
  domain: string[];
  /** KONG 站点ID */
  KongId: number;
  /** 部署方式：0 新建、1 更新 */
  update: number;
  /** 待更新的 KONG 证书ID */
  id?: string;
}

/** 证书部署结果，注：后端自定义的响应，不是腾讯云原样返回 */
export interface SslDeployResult {
  /** 提示文案 */
  message: string;
  /** 是否新建 */
  created?: boolean;
  /** 是否更新 */
  updated?: boolean;
  /** KONG 证书ID */
  certId: string;
}

/** 域名 */
export interface TencentDomain {
  /** 域名ID */
  DomainId?: number;
  /** 域名 */
  Name?: string;
  /** 状态，`ENABLE` / `PAUSE` / `SPAM` */
  Status?: string;
  /** 套餐等级，如 `D_FREE` */
  Grade?: string;
  /** 套餐名称 */
  GradeTitle?: string;
  /** 解析记录数 */
  RecordCount?: number;
  /** 创建时间 */
  CreatedOn?: string;
  /** 更新时间 */
  UpdatedOn?: string;
  /** 备注 */
  Remark?: string;
}

/** 域名列表响应 */
export interface DomainListResponse extends TencentBase {
  /** 域名列表 */
  DomainList?: TencentDomain[];
  /** 列表页统计，注：腾讯云这里**不给 TotalCount**，总数在 `DomainCountInfo.DomainTotal` */
  DomainCountInfo?: {
    /** 符合条件的域名数量 */
    DomainTotal?: number;
    /** 所有域名数量 */
    AllTotal?: number;
  };
}

/** 解析记录 */
export interface DnsRecord {
  /** 记录ID */
  RecordId?: number;
  /** 主机记录 */
  Name?: string;
  /** 记录类型 */
  Type?: string;
  /** 记录值 */
  Value?: string;
  /** 状态 */
  Status?: string;
  /** 线路 */
  Line?: string;
  /** TTL */
  TTL?: number;
  /** MX 优先级 */
  MX?: number;
  /** 更新时间 */
  UpdatedOn?: string;
  /** 备注 */
  Remark?: string;
}

/** 解析记录列表响应 */
export interface DnsListResponse extends TencentBase {
  /** 记录列表 */
  RecordList?: DnsRecord[];
  /** 数量统计，注：总数在 `RecordCountInfo.TotalCount`，顶层没有 TotalCount */
  RecordCountInfo?: {
    /** 总数 */
    TotalCount?: number;
    /** 当页条数 */
    ListCount?: number;
  };
}

/** 单条解析记录响应 */
export interface DnsRecordResponse extends TencentBase {
  /** 记录详情，注：`Enabled` 是 1 / 0，与列表里的 `Status`（ENABLE / DISABLE）不同口径 */
  RecordInfo?: {
    /** 记录ID */
    Id?: number;
    /** 主机记录 */
    SubDomain?: string;
    /** 记录类型 */
    RecordType?: string;
    /** 线路 */
    RecordLine?: string;
    /** 记录值 */
    Value?: string;
    /** TTL */
    TTL?: number;
    /** MX 优先级 */
    MX?: number;
    /** 是否启用，1 启用 / 0 禁用 */
    Enabled?: number;
    /** 备注 */
    Remark?: string;
  };
}

/** 记录类型响应 */
export interface DnsTypeResponse extends TencentBase {
  /** 记录类型清单 */
  TypeList?: string[];
}

/** 记录线路响应 */
export interface DnsLineResponse extends TencentBase {
  /** 线路清单 */
  LineList?: Array<{ Name?: string; LineId?: string }>;
}

/** 解析记录提交入参 */
export interface DnsPayload {
  /** 域名 */
  Domain: string;
  /** 记录类型 */
  RecordType: string;
  /** 线路 */
  RecordLine: string;
  /** 记录值 */
  Value: string;
  /** 主机记录 */
  SubDomain?: string;
  /** TTL */
  TTL?: number;
  /** MX 优先级 */
  MX?: number;
  /** 状态 */
  Status?: string;
  /** 备注 */
  Remark?: string;
}

/** 地域 */
export interface TencentRegion {
  /** 地域标识，如 `ap-guangzhou` */
  Region: string;
  /** 地域名 */
  RegionName: string;
}

/** 地域列表响应 */
export interface RegionListResponse extends TencentBase {
  /** 地域列表 */
  RegionSet?: TencentRegion[];
}

/** 轻量服务器实例 */
export interface LighthouseInstance {
  /** 实例ID */
  InstanceId?: string;
  /** 实例名称 */
  InstanceName?: string;
  /** 实例状态 */
  InstanceState?: string;
  /** 公网IP */
  IPAddress?: string;
  /** 端口 */
  Port?: number;
  /** CPU 核数 */
  CPU?: number;
  /** 内存（GB） */
  Memory?: number;
  /** 流量包（GB） */
  TrafficQuota?: number;
  /** 付费模式 */
  PayMode?: string;
  /** 创建时间 */
  CreatedTime?: string;
  /** 到期时间 */
  ExpireTime?: string;
}

/** 实例列表响应 */
export interface InstanceListResponse extends TencentBase {
  /** 实例列表 */
  InstanceSet?: LighthouseInstance[];
  /** 总数 */
  TotalCount?: number;
}

/** 实例操作 */
export type InstanceAction = 'start' | 'stop' | 'reboot' | 'delete';

/** 防火墙规则 */
export interface FirewallRule {
  /** 协议 */
  Protocol?: string;
  /** 端口 */
  Port?: string;
  /** 来源 IPv4 */
  CidrBlock?: string;
  /** 来源 IPv6 */
  Ipv6CidrBlock?: string;
  /** 处理动作 */
  Action?: string;
  /** 应用类型 */
  AppType?: string;
  /** 备注 */
  FirewallRuleDescription?: string;
}

/** 防火墙规则列表响应 */
export interface FirewallListResponse extends TencentBase {
  /** 规则列表 */
  FirewallRuleSet?: FirewallRule[];
  /** 总数 */
  TotalCount?: number;
}

/** 云服务密钥（仅取标题所需的字段） */
export interface TencentKeyInfo {
  /** 密钥ID */
  id: number;
  /** 密钥名称 */
  name: string;
  /** 密钥说明 */
  description: string;
}

/** KONG 网关站点（仅取标题所需的字段） */
export interface TencentKong {
  /** 站点ID */
  id: number;
  /** 站点名称 */
  name: string;
}

/**
 * 腾讯云（管理端接口）
 *
 * 注 1：接口前缀统一为 `tencent/`，全部要求管理员角色（后端 `@Allow('admin')`）
 * 注 2：`id` 一律是**云服务密钥ID**（页面路由里的 `:id`），不是腾讯云的资源 ID
 * 注 3：旧私有项目用 `_HttpClient` 直接拼 URL，这里把接口收在一个服务里，
 * 页面只关心入参与响应类型
 */
@Injectable({ providedIn: 'root' })
export class TencentService {
  private readonly http = inject(HttpClient);

  /** 地域缓存：地域标识 → 地域名 */
  private readonly regions = new Map<string, string>();
  /** 已加载地域的密钥ID，注：换一个密钥（另一套账号）要重新拉，不能跨密钥复用 */
  private regionKeyId = 0;

  /**
   * 查询地域名
   *
   * @param region 地域标识
   * @returns 地域名，未加载到时原样返回标识
   */
  regionName(region: string): string {
    return this.regions.get(region) ?? region;
  }

  /**
   * 加载地域清单
   *
   * 注：同一密钥只拉一次，其余页面走缓存
   *
   * @param id 密钥ID
   * @returns 地域清单
   */
  loadRegions(id: number): Observable<TencentRegion[]> {
    if (this.regionKeyId === id && this.regions.size > 0) {
      /** 已缓存的地域 */
      const cached = [...this.regions].map(([Region, RegionName]) => ({
        Region,
        RegionName,
      }));
      return of(cached);
    }
    return this.regionsOf(id).pipe(
      tap((rows) => {
        this.regionKeyId = id;
        this.regions.clear();
        for (const row of rows) {
          this.regions.set(row.Region, row.RegionName);
        }
      }),
    );
  }

  /**
   * 拉取地域清单（不走缓存）
   *
   * @param id 密钥ID
   * @returns 地域清单
   */
  regionsOf(id: number): Observable<TencentRegion[]> {
    return this.http
      .get<RegionListResponse>(`tencent/lighthouse/regions/${id}`)
      .pipe(map((res) => res.RegionSet ?? []));
  }

  /**
   * 获取密钥信息
   *
   * @param id 密钥ID
   * @returns 密钥信息
   */
  keyInfo(id: number): Observable<TencentKeyInfo> {
    return this.http.get<TencentKeyInfo>(`cloud/key/show/${id}`);
  }

  /**
   * 获取 KONG 站点清单
   *
   * @returns 站点清单
   */
  kongs(): Observable<TencentKong[]> {
    return this.http.get<TencentKong[]>('cloud/kong/index');
  }

  /**
   * 获取本机公网 IP（防火墙规则里「填写本地IP」用）
   *
   * @returns IP 地址
   */
  clientIp(): Observable<{ ip: string }> {
    return this.http.get<{ ip: string }>('user/ip');
  }

  // ---------------------------------------------------------------- 证书

  /**
   * 获取证书列表
   *
   * @param id 密钥ID
   * @param offset 偏移量（从 0 起）
   * @param limit 每页数量
   * @returns 证书列表
   */
  sslList(id: number, offset: number, limit: number): Observable<SslListResponse> {
    return this.http.post<SslListResponse>(`tencent/ssl/list/${id}`, {
      Offset: offset,
      Limit: limit,
    });
  }

  /**
   * 获取证书详情
   *
   * @param id 密钥ID
   * @param certificateId 证书ID
   * @returns 证书详情
   */
  sslDetail(id: number, certificateId: string): Observable<SslDetailResponse> {
    return this.http.post<SslDetailResponse>(`tencent/ssl/detail/${id}`, {
      CertificateId: certificateId,
    });
  }

  /**
   * 申请免费证书
   *
   * @param id 密钥ID
   * @param payload 申请参数
   * @returns 申请结果
   */
  sslApply(id: number, payload: SslApplyPayload): Observable<SslApplyResponse> {
    return this.http.post<SslApplyResponse>(`tencent/ssl/apply/${id}`, payload);
  }

  /**
   * 修改证书备注
   *
   * @param id 密钥ID
   * @param certificateId 证书ID
   * @param alias 备注名称，注：空串表示清空
   * @returns 修改结果
   */
  sslAlias(id: number, certificateId: string, alias: string): Observable<TencentBase> {
    return this.http.post<TencentBase>(`tencent/ssl/alias/${id}`, {
      CertificateId: certificateId,
      Alias: alias,
    });
  }

  /**
   * 吊销证书
   *
   * @param id 密钥ID
   * @param certificateId 证书ID
   * @returns 吊销结果
   */
  sslRevoke(id: number, certificateId: string): Observable<TencentBase> {
    return this.http.post<TencentBase>(`tencent/ssl/revoke/${id}`, {
      CertificateId: certificateId,
    });
  }

  /**
   * 删除证书
   *
   * @param id 密钥ID
   * @param certificateId 证书ID
   * @returns 删除结果
   */
  sslDelete(id: number, certificateId: string): Observable<TencentBase> {
    return this.http.post<TencentBase>(`tencent/ssl/delete/${id}`, {
      CertificateId: certificateId,
    });
  }

  /**
   * 把证书部署到 KONG 站点
   *
   * @param id 密钥ID
   * @param payload 部署参数
   * @returns 部署结果
   */
  sslDeploy(id: number, payload: SslDeployPayload): Observable<SslDeployResult> {
    return this.http.post<SslDeployResult>(`tencent/ssl/deploy/${id}`, payload);
  }

  // ---------------------------------------------------------------- 域名

  /**
   * 获取域名列表
   *
   * @param id 密钥ID
   * @param offset 偏移量（从 0 起）
   * @param limit 每页数量
   * @returns 域名列表
   */
  domainList(id: number, offset: number, limit: number): Observable<DomainListResponse> {
    return this.http.post<DomainListResponse>(`tencent/domain/list/${id}`, {
      Offset: offset,
      Limit: limit,
    });
  }

  /**
   * 修改域名备注
   *
   * @param id 密钥ID
   * @param domain 域名
   * @param remark 备注，注：空串表示删除备注
   * @returns 修改结果
   */
  domainRemark(id: number, domain: string, remark: string): Observable<TencentBase> {
    return this.http.post<TencentBase>(`tencent/domain/remark/${id}`, {
      Domain: domain,
      Remark: remark,
    });
  }

  // ---------------------------------------------------------------- 解析记录

  /**
   * 获取解析记录列表
   *
   * @param id 密钥ID
   * @param domain 域名
   * @param offset 偏移量（从 0 起）
   * @param limit 每页数量
   * @returns 记录列表
   */
  dnsList(id: number, domain: string, offset: number, limit: number): Observable<DnsListResponse> {
    return this.http.post<DnsListResponse>(`tencent/dns/list/${id}`, {
      Domain: domain,
      Offset: offset,
      Limit: limit,
    });
  }

  /**
   * 获取单条解析记录
   *
   * @param id 密钥ID
   * @param domain 域名
   * @param recordId 记录ID
   * @returns 记录详情
   */
  dnsRecord(id: number, domain: string, recordId: number): Observable<DnsRecordResponse> {
    return this.http.post<DnsRecordResponse>(`tencent/dns/record/${id}`, {
      Domain: domain,
      RecordId: recordId,
    });
  }

  /**
   * 创建解析记录
   *
   * @param id 密钥ID
   * @param payload 记录内容
   * @returns 创建结果，含新记录ID
   */
  dnsCreate(id: number, payload: DnsPayload): Observable<TencentBase & { RecordId?: number }> {
    return this.http.post<TencentBase & { RecordId?: number }>(`tencent/dns/create/${id}`, payload);
  }

  /**
   * 修改解析记录
   *
   * @param id 密钥ID
   * @param payload 记录内容（含 RecordId）
   * @returns 修改结果
   */
  dnsModify(id: number, payload: DnsPayload & { RecordId: number }): Observable<TencentBase> {
    return this.http.post<TencentBase>(`tencent/dns/modify/${id}`, payload);
  }

  /**
   * 删除解析记录
   *
   * @param id 密钥ID
   * @param domain 域名
   * @param recordId 记录ID
   * @returns 删除结果
   */
  dnsDelete(id: number, domain: string, recordId: number): Observable<TencentBase> {
    return this.http.post<TencentBase>(`tencent/dns/delete/${id}`, {
      Domain: domain,
      RecordId: recordId,
    });
  }

  /**
   * 获取记录类型清单
   *
   * @param id 密钥ID
   * @param grade 域名套餐等级
   * @returns 记录类型清单
   */
  dnsType(id: number, grade: string): Observable<DnsTypeResponse> {
    return this.http.post<DnsTypeResponse>(`tencent/dns/type/${id}`, {
      DomainGrade: grade,
    });
  }

  /**
   * 获取记录线路清单
   *
   * @param id 密钥ID
   * @param domain 域名
   * @param grade 域名套餐等级
   * @returns 线路清单
   */
  dnsLine(id: number, domain: string, grade: string): Observable<DnsLineResponse> {
    return this.http.post<DnsLineResponse>(`tencent/dns/line/${id}`, {
      Domain: domain,
      DomainGrade: grade,
    });
  }

  // ---------------------------------------------------------------- 轻量服务器

  /**
   * 获取实例列表
   *
   * @param id 密钥ID
   * @param region 地域
   * @param offset 偏移量（从 0 起）
   * @param limit 每页数量
   * @returns 实例列表
   */
  instances(
    id: number,
    region: string,
    offset: number,
    limit: number,
  ): Observable<InstanceListResponse> {
    return this.http.post<InstanceListResponse>(`tencent/lighthouse/list/${id}/${region}`, {
      Offset: offset,
      Limit: limit,
    });
  }

  /**
   * 实例启停 / 重启 / 删除
   *
   * @param id 密钥ID
   * @param region 地域
   * @param action 动作
   * @param instanceId 实例ID
   * @returns 操作结果
   */
  instanceAction(
    id: number,
    region: string,
    action: InstanceAction,
    instanceId: string,
  ): Observable<TencentBase> {
    return this.http.post<TencentBase>(`tencent/lighthouse/${action}/${id}/${region}`, {
      InstanceId: instanceId,
    });
  }

  /**
   * 重置实例密码
   *
   * @param id 密钥ID
   * @param region 地域
   * @param instanceId 实例ID
   * @param password 新密码
   * @returns 操作结果
   */
  resetPassword(
    id: number,
    region: string,
    instanceId: string,
    password: string,
  ): Observable<TencentBase> {
    return this.http.post<TencentBase>(`tencent/lighthouse/reset-password/${id}/${region}`, {
      InstanceId: instanceId,
      Password: password,
    });
  }

  // ---------------------------------------------------------------- 防火墙

  /**
   * 查询防火墙规则
   *
   * @param id 密钥ID
   * @param region 地域
   * @param instanceId 实例ID
   * @param offset 偏移量（从 0 起）
   * @param limit 每页数量
   * @returns 规则列表
   */
  firewallList(
    id: number,
    region: string,
    instanceId: string,
    offset: number,
    limit: number,
  ): Observable<FirewallListResponse> {
    return this.http.post<FirewallListResponse>(`tencent/firewall/list/${id}/${region}`, {
      InstanceId: instanceId,
      Offset: offset,
      Limit: limit,
    });
  }

  /**
   * 新增防火墙规则
   *
   * @param id 密钥ID
   * @param region 地域
   * @param instanceId 实例ID
   * @param rules 规则清单
   * @returns 操作结果
   */
  firewallCreate(
    id: number,
    region: string,
    instanceId: string,
    rules: FirewallRule[],
  ): Observable<TencentBase> {
    return this.http.post<TencentBase>(`tencent/firewall/create/${id}/${region}`, {
      InstanceId: instanceId,
      FirewallRules: rules,
    });
  }

  /**
   * 删除防火墙规则
   *
   * @param id 密钥ID
   * @param region 地域
   * @param instanceId 实例ID
   * @param rules 规则清单
   * @returns 操作结果
   */
  firewallDelete(
    id: number,
    region: string,
    instanceId: string,
    rules: FirewallRule[],
  ): Observable<TencentBase> {
    return this.http.post<TencentBase>(`tencent/firewall/delete/${id}/${region}`, {
      InstanceId: instanceId,
      FirewallRules: rules,
    });
  }

  /**
   * 修改防火墙规则
   *
   * @param id 密钥ID
   * @param region 地域
   * @param instanceId 实例ID
   * @param rules 规则清单
   * @returns 操作结果
   */
  firewallModify(
    id: number,
    region: string,
    instanceId: string,
    rules: FirewallRule[],
  ): Observable<TencentBase> {
    return this.http.post<TencentBase>(`tencent/firewall/modify/${id}/${region}`, {
      InstanceId: instanceId,
      FirewallRules: rules,
    });
  }
}
