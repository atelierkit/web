import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TencentService } from './tencent.service';

describe('TencentService', () => {
  /** 被测服务 */
  let service: TencentService;
  /** HTTP 替身 */
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TencentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('证书列表按 POST 提交 Offset / Limit（Offset 从 0 起）', () => {
    service.sslList(3, 10, 10).subscribe();
    const req = http.expectOne('tencent/ssl/list/3');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ Offset: 10, Limit: 10 });
    req.flush({ RequestId: 'rid', Certificates: [], TotalCount: 0 });
  });

  it('证书部署提交证书ID、域名、站点与部署方式', () => {
    const payload = {
      CertificateId: 'cert-1',
      domain: ['example.com'],
      KongId: 1,
      update: 1,
      id: 'kong-cert-1',
    };
    service.sslDeploy(3, payload).subscribe();
    const req = http.expectOne('tencent/ssl/deploy/3');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ message: '证书更新成功', updated: true, certId: 'kong-cert-1' });
  });

  it('DNS 的六类请求各走各的路径（含单条记录 DescribeRecord）', () => {
    service.dnsList(3, 'example.com', 0, 20).subscribe();
    const list = http.expectOne('tencent/dns/list/3');
    expect(list.request.body).toEqual({ Domain: 'example.com', Offset: 0, Limit: 20 });
    list.flush({ RecordList: [], RecordCountInfo: { TotalCount: 0 } });

    service.dnsRecord(3, 'example.com', 8).subscribe();
    const record = http.expectOne('tencent/dns/record/3');
    expect(record.request.body).toEqual({ Domain: 'example.com', RecordId: 8 });
    record.flush({ RecordInfo: { Id: 8 } });

    service.dnsDelete(3, 'example.com', 8).subscribe();
    const removed = http.expectOne('tencent/dns/delete/3');
    expect(removed.request.body).toEqual({ Domain: 'example.com', RecordId: 8 });
    removed.flush({ RequestId: 'rid' });

    service.dnsType(3, 'D_FREE').subscribe();
    const type = http.expectOne('tencent/dns/type/3');
    expect(type.request.body).toEqual({ DomainGrade: 'D_FREE' });
    type.flush({ TypeList: ['A'] });

    service.dnsLine(3, 'example.com', 'D_FREE').subscribe();
    const line = http.expectOne('tencent/dns/line/3');
    expect(line.request.body).toEqual({ Domain: 'example.com', DomainGrade: 'D_FREE' });
    line.flush({ LineList: [{ Name: '默认' }] });
  });

  it('DNS 新增与修改共用一份字段名（与腾讯云 CreateRecord / ModifyRecord 逐字一致）', () => {
    /** 记录内容 */
    const payload = {
      Domain: 'example.com',
      RecordType: 'A',
      RecordLine: '默认',
      Value: '1.2.3.4',
      SubDomain: 'www',
      Status: 'ENABLE',
    };
    service.dnsCreate(3, payload).subscribe();
    const created = http.expectOne('tencent/dns/create/3');
    expect(created.request.method).toBe('POST');
    expect(created.request.body).toEqual(payload);
    created.flush({ RequestId: 'rid', RecordId: 9 });

    service.dnsModify(3, { ...payload, RecordId: 9 }).subscribe();
    const modified = http.expectOne('tencent/dns/modify/3');
    expect(modified.request.body).toEqual({ ...payload, RecordId: 9 });
    modified.flush({ RequestId: 'rid' });
  });

  it('实例操作拼在路径上（start / stop / reboot / delete）', () => {
    for (const action of ['start', 'stop', 'reboot', 'delete'] as const) {
      service.instanceAction(3, 'ap-guangzhou', action, 'lhins-1').subscribe();
      const req = http.expectOne(`tencent/lighthouse/${action}/3/ap-guangzhou`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ InstanceId: 'lhins-1' });
      req.flush({ RequestId: 'rid' });
    }
  });

  it('重置密码带上新密码', () => {
    service.resetPassword(3, 'ap-guangzhou', 'lhins-1', 'Passw0rd!').subscribe();
    const req = http.expectOne('tencent/lighthouse/reset-password/3/ap-guangzhou');
    expect(req.request.body).toEqual({ InstanceId: 'lhins-1', Password: 'Passw0rd!' });
    req.flush({ RequestId: 'rid' });
  });

  it('防火墙的增删改都提交 InstanceId 与 FirewallRules', () => {
    /** 规则 */
    const rules = [{ Protocol: 'TCP', Port: '22' }];
    for (const action of ['create', 'delete', 'modify'] as const) {
      const request =
        action === 'create'
          ? service.firewallCreate(3, 'ap-guangzhou', 'lhins-1', rules)
          : action === 'delete'
            ? service.firewallDelete(3, 'ap-guangzhou', 'lhins-1', rules)
            : service.firewallModify(3, 'ap-guangzhou', 'lhins-1', rules);
      request.subscribe();
      const req = http.expectOne(`tencent/firewall/${action}/3/ap-guangzhou`);
      expect(req.request.body).toEqual({ InstanceId: 'lhins-1', FirewallRules: rules });
      req.flush({ RequestId: 'rid' });
    }
  });

  it('地域清单只拉一次，第二次走缓存', () => {
    /** 第一次结果 */
    const first: unknown[] = [];
    service.loadRegions(3).subscribe((rows) => first.push(...rows));
    const req = http.expectOne('tencent/lighthouse/regions/3');
    expect(req.request.method).toBe('GET');
    req.flush({ RegionSet: [{ Region: 'ap-guangzhou', RegionName: '广州' }] });
    expect(first).toEqual([{ Region: 'ap-guangzhou', RegionName: '广州' }]);
    expect(service.regionName('ap-guangzhou')).toBe('广州');
    // 未登记的地域原样返回标识
    expect(service.regionName('ap-shanghai')).toBe('ap-shanghai');

    // 第二次不再发请求（`http.verify()` 会兜住多发的那一条）
    service.loadRegions(3).subscribe();

    // 换一个密钥（另一套账号）要重新拉，不能跨密钥复用缓存
    service.loadRegions(4).subscribe();
    const other = http.expectOne('tencent/lighthouse/regions/4');
    other.flush({ RegionSet: [{ Region: 'ap-shanghai', RegionName: '上海' }] });
    expect(service.regionName('ap-shanghai')).toBe('上海');
  });

  it('密钥信息与站点清单走云服务接口（布局与部署弹窗用）', () => {
    service.keyInfo(3).subscribe();
    const key = http.expectOne('cloud/key/show/3');
    expect(key.request.method).toBe('GET');
    key.flush({ id: 3, name: '腾讯云主账号', description: '部署 CDN 用' });

    service.kongs().subscribe();
    const kong = http.expectOne('cloud/kong/index');
    expect(kong.request.method).toBe('GET');
    kong.flush([{ id: 1, name: '本地网关' }]);
  });
});
