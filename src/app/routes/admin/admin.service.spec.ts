import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AdminService, SettingPayload } from './admin.service';

describe('AdminService', () => {
  let service: AdminService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  describe('系统配置', () => {
    it('清单走 GET admin/setting/index，默认取全量（operateId=-1）', () => {
      service.settings().subscribe();
      const req = http.expectOne((item) => item.url === 'admin/setting/index');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('operateId')).toBe('-1');
      req.flush([]);
    });

    it('详情走 GET admin/setting/show/:code', () => {
      service.setting('icp').subscribe();
      const req = http.expectOne('admin/setting/show/icp');
      expect(req.request.method).toBe('GET');
      req.flush({ code: 'icp', value: { owner: 'x' }, status: true });
    });

    it('创建与更新分别走 admin/setting/create、admin/setting/update/:code', () => {
      const value: SettingPayload = { code: 'app', value: { name: 'x' }, status: true };
      service.createSetting(value).subscribe();
      const created = http.expectOne('admin/setting/create');
      expect(created.request.method).toBe('POST');
      expect(created.request.body).toEqual(value);
      created.flush({ code: 'app' });

      service.updateSetting('app', value).subscribe();
      const updated = http.expectOne('admin/setting/update/app');
      expect(updated.request.method).toBe('POST');
      expect(updated.request.body).toEqual(value);
      updated.flush({ code: 'app' });
    });
  });

  describe('操作日志', () => {
    it('清单走 POST admin/operate/index，并剔除空条件、保留有意义的 0', () => {
      service.operates({ pi: 1, ps: 20, name: '', userId: 0 }).subscribe();
      const req = http.expectOne('admin/operate/index');
      expect(req.request.method).toBe('POST');
      // 注：name 空串被剔除；userId=0 表示「系统/未登录」，必须保留，否则筛选不出系统操作
      expect(req.request.body).toEqual({ pi: 1, ps: 20, userId: 0 });
      req.flush({ data: [], total: 0 });
    });

    it('字典走 GET admin/operate/options', () => {
      service.operateOptions().subscribe();
      const req = http.expectOne('admin/operate/options');
      expect(req.request.method).toBe('GET');
      req.flush({ users: [], names: [], operates: [] });
    });
  });

  describe('请求日志', () => {
    it('清单走 POST admin/req/index，false 作为有效条件保留', () => {
      service.reqs({ pi: 2, success: false, path: '', status: 500 }).subscribe();
      const req = http.expectOne('admin/req/index');
      expect(req.request.method).toBe('POST');
      // 注：success=false 是「只看异常请求」，被真值判断剔除就变成「不筛选」，结果集完全不同
      expect(req.request.body).toEqual({ pi: 2, success: false, status: 500 });
      req.flush({ data: [], total: 0 });
    });

    it('三个字典接口走 GET admin/req/url、admin/req/user、admin/req/controller', () => {
      service.reqPaths().subscribe();
      http.expectOne('admin/req/url').flush([]);

      service.reqUsers().subscribe();
      http.expectOne('admin/req/user').flush([]);

      service.reqControllers().subscribe();
      http.expectOne('admin/req/controller').flush([]);
    });

    it('方法名字典把控制器名放进路径', () => {
      service.reqActions('AdminReqController').subscribe();
      const req = http.expectOne('admin/req/action/AdminReqController');
      expect(req.request.method).toBe('GET');
      req.flush(['index']);
    });
  });
});
