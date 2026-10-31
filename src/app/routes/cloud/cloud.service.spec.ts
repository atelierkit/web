import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CloudService, KeyPayload, KongPayload } from './cloud.service';

describe('CloudService', () => {
  let service: CloudService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CloudService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  describe('密钥', () => {
    it('清单走 GET cloud/key/index，默认取全量（operateId=-1）', () => {
      service.keys().subscribe();
      const req = http.expectOne((item) => item.url === 'cloud/key/index');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('operateId')).toBe('-1');
      req.flush([]);
    });

    it('详情走 GET cloud/key/show/:id', () => {
      service.key(3).subscribe();
      const req = http.expectOne('cloud/key/show/3');
      expect(req.request.method).toBe('GET');
      req.flush({
        id: 3,
        name: '腾讯云主账号',
        description: '部署 CDN 用',
        provider: 'tencent',
        key: 'AKIDEXAMPLE',
        status: true,
      });
    });

    it('创建走 POST cloud/key/create，含 secret', () => {
      const value: KeyPayload = {
        name: '腾讯云主账号',
        description: '部署 CDN 用',
        provider: 'tencent',
        key: 'AKIDEXAMPLE',
        secret: 'SECRETEXAMPLE',
        status: true,
      };
      service.createKey(value).subscribe();
      const req = http.expectOne('cloud/key/create');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(value);
      req.flush({ statusCode: 201, message: '创建成功' });
    });

    it('更新走 POST cloud/key/update/:id', () => {
      const value: KeyPayload = {
        name: '腾讯云主账号',
        description: '部署 CDN 用',
        provider: 'tencent',
        key: 'AKIDEXAMPLE',
        status: false,
      };
      service.updateKey(3, value).subscribe();
      const req = http.expectOne('cloud/key/update/3');
      expect(req.request.method).toBe('POST');
      // 注：不带 secret 表示保持原值（后端 KeyUpdateDto 的 secret 可选）
      expect(Object.keys(req.request.body)).not.toContain('secret');
      expect(req.request.body).toEqual(value);
      req.flush({ statusCode: 200, message: '保存成功' });
    });
  });

  describe('KONG 网关站点', () => {
    it('清单走 GET cloud/kong/index，默认取全量', () => {
      service.kongs().subscribe();
      const req = http.expectOne((item) => item.url === 'cloud/kong/index');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('operateId')).toBe('-1');
      req.flush([]);
    });

    it('详情走 GET cloud/kong/show/:id', () => {
      service.kong(1).subscribe();
      const req = http.expectOne('cloud/kong/show/1');
      expect(req.request.method).toBe('GET');
      req.flush({
        id: 1,
        name: '本地网关',
        description: '家用服务器的 Kong',
        url: 'http://192.168.1.10:8001',
        status: true,
      });
    });

    it('变更历史走 GET cloud/kong/log/:id', () => {
      service.kongLog(1).subscribe();
      const req = http.expectOne('cloud/kong/log/1');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('创建与更新分别走 cloud/kong/create、cloud/kong/update/:id', () => {
      const value: KongPayload = {
        name: '本地网关',
        description: '家用服务器的 Kong',
        url: 'http://192.168.1.10:8001',
        status: true,
      };
      service.createKong(value).subscribe();
      const created = http.expectOne('cloud/kong/create');
      expect(created.request.method).toBe('POST');
      expect(created.request.body).toEqual(value);
      created.flush({ statusCode: 201, message: '创建成功' });

      service.updateKong(1, value).subscribe();
      const updated = http.expectOne('cloud/kong/update/1');
      expect(updated.request.method).toBe('POST');
      expect(updated.request.body).toEqual(value);
      updated.flush({ statusCode: 200, message: '保存成功' });
    });

    it('诊断接口走 GET cloud/kong/summary/:id 与 cloud/kong/plugin/:id', () => {
      service.kongSummary(1).subscribe();
      const summary = http.expectOne('cloud/kong/summary/1');
      expect(summary.request.method).toBe('GET');
      summary.flush({
        version: '3.9.4',
        edition: 'community',
        hostname: 'home-server',
        nodeId: 'node-1',
        luaVersion: 'LuaJIT',
        pluginCount: 45,
        enabledCount: 1,
        connectionsActive: 5,
        totalRequests: 49,
        dbReachable: true,
      });

      service.kongPlugin(1).subscribe();
      const plugin = http.expectOne('cloud/kong/plugin/1');
      expect(plugin.request.method).toBe('GET');
      plugin.flush(['cors']);
    });
  });
});
