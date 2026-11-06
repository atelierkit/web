import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AliyunService } from './aliyun.service';

describe('AliyunService', () => {
  /** 被测服务 */
  let service: AliyunService;
  /** HTTP 替身 */
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AliyunService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('证书列表按 POST 提交分页条件', () => {
    service.sslList(3, { CurrentPage: 2, ShowSize: 20 }).subscribe();
    /** 请求 */
    const req = http.expectOne('aliyun/ssl/list/3');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ CurrentPage: 2, ShowSize: 20 });
    req.flush({ total: 0, items: [] });
  });

  it('证书详情与私钥分开取（私钥不随详情下发）', () => {
    service.sslDetail(3, 28334622).subscribe();
    http.expectOne('aliyun/ssl/show/3').flush({ certId: 28334622 });

    service.sslPem(3, 28334622).subscribe();
    /** 私钥请求 */
    const pem = http.expectOne('aliyun/ssl/pem/3');
    expect(pem.request.body).toEqual({ CertId: 28334622 });
    pem.flush({ cert: 'CERT', key: 'KEY' });
  });

  it('订单列表走独立的 orders 路由', () => {
    service.orderList(3, { Status: 'PAYED' }).subscribe();
    /** 请求 */
    const req = http.expectOne('aliyun/ssl/orders/3');
    expect(req.request.body).toEqual({ Status: 'PAYED' });
    req.flush({ total: 0, items: [] });
  });

  it('申请提交带齐八个字段', () => {
    /** 申请入参 */
    const payload = {
      InstanceId: 'cas-cn-1',
      Domain: 'a.com',
      DomainVerifyType: 'DNS',
      Username: 'u',
      Mobile: '13600000000',
      Email: 'e@x.com',
      Province: 'zhejiang',
      City: 'hangzhou',
    };
    service.audit(3, payload).subscribe();
    /** 请求 */
    const req = http.expectOne('aliyun/ssl/audit/3');
    expect(req.request.body).toEqual(payload);
    req.flush({ submitted: true });
  });

  it('取消申请只提交订单ID', () => {
    service.cancel(3, 1851806).subscribe();
    /** 请求 */
    const req = http.expectOne('aliyun/ssl/cancel/3');
    expect(req.request.body).toEqual({ OrderId: 1851806 });
    req.flush({ canceled: true });
  });

  it('DNS 探测带上域名（用于查 NS）', () => {
    service.verify(3, 1851806, 'a.com').subscribe();
    /** 请求 */
    const req = http.expectOne('aliyun/ssl/verify/3');
    expect(req.request.body).toEqual({ OrderId: 1851806, Domain: 'a.com' });
    req.flush({ status: 'pending', record: null, existing: [], ns: [] });
  });

  it('部署提交证书ID、站点、方式与目标 KONG 证书', () => {
    service.deploy(3, { CertId: 1, KongId: 2, update: 1, id: 'kong-9' }).subscribe();
    /** 请求 */
    const req = http.expectOne('aliyun/ssl/deploy/3');
    expect(req.request.body).toEqual({
      CertId: 1,
      KongId: 2,
      update: 1,
      id: 'kong-9',
    });
    req.flush({ message: 'ok', certId: 'kong-9' });
  });

  it('联系人清单用 GET + operateId 查询参数', () => {
    service.contacts().subscribe();
    /** 请求 */
    const req = http.expectOne((item) => item.url === 'aliyun/contact/index');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('operateId')).toBe('-1');
    req.flush([]);
  });

  it('联系人新增与更新走不同路由', () => {
    service
      .createContact({
        username: 'u',
        email: 'e@x.com',
        phone: '13600000000',
        province: 'zhejiang',
        city: 'hangzhou',
      })
      .subscribe();
    http.expectOne('aliyun/contact/create').flush(1);

    service.updateContact(1, { isDefault: true }).subscribe();
    /** 更新请求 */
    const req = http.expectOne('aliyun/contact/update/1');
    expect(req.request.body).toEqual({ isDefault: true });
    req.flush(1);
  });
});
