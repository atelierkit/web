import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/** 证书列表项，注：字段名由后端归一化，与阿里云原始字段名无关 */
export interface SslCertItem {
  /** 证书ID */
  certId: number;
  /** 实例ID */
  instanceId: string;
  /** 证书名称 */
  name: string;
  /** 主域名 */
  domain: string;
  /** 全部域名 */
  sans: string[];
  /** 颁发机构 */
  issuer: string;
  /** 签发时间（ISO） */
  startAt: string;
  /** 到期时间（ISO） */
  endAt: string;
  /** 是否过期 */
  expired: boolean;
  /** 是否外部上传 */
  uploaded: boolean;
}

/** 订单列表项 */
export interface SslOrderItem {
  /** 实例ID，申请时作为 `InstanceId` */
  instanceId: string;
  /** 订单ID，查状态时作为 `OrderId` */
  orderId: number;
  /** 资源状态 */
  status: string;
  /** 证书类型 */
  certType: string;
  /** 产品名 */
  product: string;
  /** 主域名，空串表示额度未使用 */
  domain: string;
  /** 购买时间（ISO） */
  boughtAt: string;
  /** 到期时间（ISO） */
  endAt: string;
}

/** 列表响应 */
export interface SslListResult<T> {
  /** 总数 */
  total: number;
  /** 条目 */
  items: T[];
}

/** 证书概览 */
export interface SslCertDetail {
  /** 证书ID */
  certId: number;
  /** 证书名称 */
  name: string;
  /** 主域名 */
  commonName: string;
  /** 全部域名 */
  sans: string[];
  /** 颁发机构 */
  issuer: string;
  /** 算法 */
  algorithm: string;
  /** 密钥长度 */
  keySize: number;
  /** 序列号 */
  serial: string;
  /** 指纹 */
  fingerprint: string;
  /** 证书状态 */
  status: string;
  /** 实例ID */
  instanceId: string;
  /** 全局证书标识 */
  certIdentifier: string;
  /** 是否存在私钥 */
  existPrivateKey: boolean;
  /** 签发时间 */
  startAt: string;
  /** 到期时间 */
  endAt: string;
  /** 证书链 */
  chain: string[];
}

/** 证书公私钥 */
export interface SslCertPem {
  /** 证书内容（PEM） */
  cert: string;
  /** 私钥内容（PEM） */
  key: string;
}

/** DNS 验证记录 */
export interface SslDnsRecord {
  /** 记录类型 */
  type: string;
  /** 记录名 */
  domain: string;
  /** 记录值 */
  value: string;
}

/** 申请状态 */
export interface SslState {
  /** 状态：payed / domain_verify / process / certificate / verify_fail / unknow */
  type: string;
  /** 验证记录 */
  record: SslDnsRecord | null;
  /** 签发的证书ID */
  certId: number;
  /** 证书内容 */
  cert: string;
  /** 私钥内容 */
  key: string;
}

/** DNS 探测结果 */
export interface SslVerify {
  /** 申请状态 */
  type: string;
  /** 验证记录 */
  record: SslDnsRecord | null;
  /** DNS 状态 */
  status: 'pending' | 'matched' | 'mismatched' | 'unknown';
  /** DNS 中已存在的同类记录 */
  existing: string[];
  /** 域名 NS */
  ns: string[];
  /** 探测时间 */
  checkedAt: string;
}

/** 申请联系人 */
export interface ContactItem {
  /** 联系人ID */
  id: number;
  /** 备注名 */
  name: string;
  /** 申请人姓名 */
  username: string;
  /** 邮箱 */
  email: string;
  /** 手机号 */
  phone: string;
  /** 省份 */
  province: string;
  /** 城市 */
  city: string;
  /** 是否默认 */
  isDefault: boolean;
  /** 启用状态 */
  status: boolean;
  /** 更新时间 */
  update?: { at: number };
}

/** 联系人创建/更新入参 */
export interface ContactPayload {
  /** 备注名 */
  name?: string;
  /** 申请人姓名 */
  username: string;
  /** 邮箱 */
  email: string;
  /** 手机号 */
  phone: string;
  /** 省份 */
  province: string;
  /** 城市 */
  city: string;
  /** 是否默认 */
  isDefault?: boolean;
  /** 启用状态 */
  status?: boolean;
}

/** 申请证书入参 */
export interface SslAuditPayload {
  /** 订单实例ID */
  InstanceId: string;
  /** 申请域名 */
  Domain: string;
  /** 验证方式 */
  DomainVerifyType: string;
  /** 申请人姓名 */
  Username: string;
  /** 手机号 */
  Mobile: string;
  /** 邮箱 */
  Email: string;
  /** 省份 */
  Province: string;
  /** 城市 */
  City: string;
}

/** 部署入参 */
export interface SslDeployPayload {
  /** 证书ID */
  CertId: number;
  /** KONG 站点ID */
  KongId: number;
  /** 部署方式：0 新建、1 更新 */
  update: number;
  /** 待更新的 KONG 证书ID */
  id?: string;
}

/** 部署结果 */
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

/** 密钥信息 */
export interface AliyunKeyInfo {
  /** 密钥名称 */
  name: string;
  /** 密钥说明 */
  description: string;
}

/** 阿里云服务，注：所有接口都是 POST + 请求体，与后端 `aliyun/` 前缀一一对应 */
@Injectable({ providedIn: 'root' })
export class AliyunService {
  private readonly http = inject(HttpClient);

  /**
   * 获取密钥信息（布局页头用）
   *
   * @param id 密钥ID
   * @returns 密钥信息
   */
  keyInfo(id: number): Observable<AliyunKeyInfo> {
    return this.http.get<AliyunKeyInfo>(`cloud/key/show/${id}`);
  }

  /**
   * 获取 KONG 站点清单（部署弹窗用）
   *
   * @returns 站点清单
   */
  kongs(): Observable<Array<{ id: number; name: string }>> {
    return this.http.get<Array<{ id: number; name: string }>>('cloud/kong/index');
  }

  /**
   * 获取证书列表
   *
   * @param id 密钥ID
   * @param query 查询条件
   * @returns 证书列表
   */
  sslList(
    id: number,
    query: { CurrentPage?: number; ShowSize?: number; Keyword?: string; Status?: string },
  ): Observable<SslListResult<SslCertItem>> {
    return this.http.post<SslListResult<SslCertItem>>(`aliyun/ssl/list/${id}`, query);
  }

  /**
   * 获取证书概览
   *
   * @param id 密钥ID
   * @param certId 证书ID
   * @returns 证书概览
   */
  sslDetail(id: number, certId: number): Observable<SslCertDetail> {
    return this.http.post<SslCertDetail>(`aliyun/ssl/show/${id}`, { CertId: certId });
  }

  /**
   * 获取证书公私钥
   *
   * @param id 密钥ID
   * @param certId 证书ID
   * @returns PEM 证书与私钥
   */
  sslPem(id: number, certId: number): Observable<SslCertPem> {
    return this.http.post<SslCertPem>(`aliyun/ssl/pem/${id}`, { CertId: certId });
  }

  /**
   * 上传证书
   *
   * @param id 密钥ID
   * @param payload 上传参数
   * @returns 新证书ID
   */
  sslImport(
    id: number,
    payload: { Name: string; Cert: string; Key: string },
  ): Observable<{ certId: number }> {
    return this.http.post<{ certId: number }>(`aliyun/ssl/import/${id}`, payload);
  }

  /**
   * 删除证书
   *
   * @param id 密钥ID
   * @param certId 证书ID
   * @returns 删除结果
   */
  sslDelete(id: number, certId: number): Observable<{ deleted: boolean }> {
    return this.http.post<{ deleted: boolean }>(`aliyun/ssl/delete/${id}`, { CertId: certId });
  }

  /**
   * 获取订单列表
   *
   * @param id 密钥ID
   * @param query 查询条件
   * @returns 订单列表
   */
  orderList(
    id: number,
    query: { CurrentPage?: number; ShowSize?: number; Keyword?: string; Status?: string },
  ): Observable<SslListResult<SslOrderItem>> {
    return this.http.post<SslListResult<SslOrderItem>>(`aliyun/ssl/orders/${id}`, query);
  }

  /**
   * 提交 DV 申请
   *
   * @param id 密钥ID
   * @param payload 申请参数
   * @returns 提交结果
   */
  audit(id: number, payload: SslAuditPayload): Observable<{ submitted: boolean }> {
    return this.http.post<{ submitted: boolean }>(`aliyun/ssl/audit/${id}`, payload);
  }

  /**
   * 取消申请
   *
   * @param id 密钥ID
   * @param orderId 订单ID
   * @returns 取消结果
   */
  cancel(id: number, orderId: number): Observable<{ canceled: boolean }> {
    return this.http.post<{ canceled: boolean }>(`aliyun/ssl/cancel/${id}`, { OrderId: orderId });
  }

  /**
   * 查询申请状态
   *
   * @param id 密钥ID
   * @param orderId 订单ID
   * @returns 申请状态
   */
  state(id: number, orderId: number): Observable<SslState> {
    return this.http.post<SslState>(`aliyun/ssl/state/${id}`, { OrderId: orderId });
  }

  /**
   * 探测 DNS 验证信息
   *
   * @param id 密钥ID
   * @param orderId 订单ID
   * @param domain 申请域名
   * @returns 探测结果
   */
  verify(id: number, orderId: number, domain?: string): Observable<SslVerify> {
    return this.http.post<SslVerify>(`aliyun/ssl/verify/${id}`, {
      OrderId: orderId,
      Domain: domain,
    });
  }

  /**
   * 部署证书到 KONG
   *
   * @param id 密钥ID
   * @param payload 部署参数
   * @returns 部署结果
   */
  deploy(id: number, payload: SslDeployPayload): Observable<SslDeployResult> {
    return this.http.post<SslDeployResult>(`aliyun/ssl/deploy/${id}`, payload);
  }

  /**
   * 获取联系人清单
   *
   * @param operateId 操作序号，注：-1 表示全量
   * @returns 联系人清单
   */
  contacts(operateId: number = -1): Observable<ContactItem[]> {
    return this.http.get<ContactItem[]>('aliyun/contact/index', { params: { operateId } });
  }

  /**
   * 获取联系人详情
   *
   * @param id 联系人ID
   * @returns 联系人详情
   */
  contact(id: number): Observable<ContactItem> {
    return this.http.get<ContactItem>(`aliyun/contact/show/${id}`);
  }

  /**
   * 创建联系人
   *
   * @param payload 联系人信息
   * @returns 新联系人ID
   */
  createContact(payload: ContactPayload): Observable<number> {
    return this.http.post<number>('aliyun/contact/create', payload);
  }

  /**
   * 更新联系人
   *
   * @param id 联系人ID
   * @param payload 联系人信息
   * @returns 联系人ID
   */
  updateContact(id: number, payload: Partial<ContactPayload>): Observable<number> {
    return this.http.post<number>(`aliyun/contact/update/${id}`, payload);
  }
}
