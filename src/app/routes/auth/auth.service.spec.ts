import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  AuthService,
  AuthToken,
  RolePayload,
  UserCreatePayload,
  UserUpdatePayload,
} from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  describe('角色', () => {
    it('清单走 GET auth/role/index', () => {
      service.roles().subscribe();
      const req = http.expectOne('auth/role/index');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('详情走 GET auth/role/show/:id', () => {
      service.role('admin').subscribe();
      const req = http.expectOne('auth/role/show/admin');
      expect(req.request.method).toBe('GET');
      req.flush({ id: 'admin', name: '管理员', description: '', sort: 1, status: true });
    });

    it('创建走 POST auth/role/create，原样提交角色信息', () => {
      const value: RolePayload = {
        id: 'ops',
        name: '运维',
        description: '维护服务器',
        status: true,
      };
      service.createRole(value).subscribe();
      const req = http.expectOne('auth/role/create');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(value);
      req.flush({ statusCode: 201, message: '创建成功' });
    });

    it('更新走 POST auth/role/update/:id', () => {
      const value: RolePayload = {
        id: 'ops',
        name: '运维',
        description: '维护服务器',
        status: false,
      };
      service.updateRole('ops', value).subscribe();
      const req = http.expectOne('auth/role/update/ops');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(value);
      req.flush({ statusCode: 200, message: '保存成功' });
    });

    it('排序走 POST auth/role/sort，提交排序后的数组', () => {
      const values = [
        { id: 'admin', sort: 1 },
        { id: 'ops', sort: 2 },
      ];
      service.sortRoles(values).subscribe();
      const req = http.expectOne('auth/role/sort');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(values);
      req.flush({ statusCode: 200, message: '保存成功' });
    });
  });

  describe('用户', () => {
    it('清单走 GET auth/user/index，默认取全量（operateId=-1）', () => {
      service.users().subscribe();
      const req = http.expectOne((item) => item.url === 'auth/user/index');
      expect(req.request.method).toBe('GET');
      // 注：-1 表示取全量，服务端按 > operateId 增量返回
      expect(req.request.params.get('operateId')).toBe('-1');
      req.flush([]);
    });

    it('可指定操作序号做增量加载', () => {
      service.users(12).subscribe();
      const req = http.expectOne((item) => item.url === 'auth/user/index');
      expect(req.request.params.get('operateId')).toBe('12');
      req.flush([]);
    });

    it('详情走 GET auth/user/show/:id', () => {
      service.user(3).subscribe();
      const req = http.expectOne('auth/user/show/3');
      expect(req.request.method).toBe('GET');
      req.flush({
        id: 3,
        username: 'dev',
        name: '开发',
        avatar: '',
        email: null,
        status: true,
        roles: [],
      });
    });

    it('建号走 POST auth/user/create，含用户名与明文密码（服务端负责哈希）', () => {
      const value: UserCreatePayload = {
        username: 'dev_01',
        password: 'abc12345',
        name: '开发',
        avatar: '',
        email: '',
        status: true,
        roles: ['admin'],
      };
      service.createUser(value).subscribe();
      const req = http.expectOne('auth/user/create');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(value);
      req.flush({ statusCode: 201, message: '创建成功' });
    });

    it('更新走 POST auth/user/update/:id，且不含用户名与密码', () => {
      const value: UserUpdatePayload = {
        name: '开发',
        avatar: '',
        email: '',
        status: false,
        roles: ['ops'],
      };
      service.updateUser(3, value).subscribe();
      const req = http.expectOne('auth/user/update/3');
      expect(req.request.method).toBe('POST');
      // 注：管理端不改登录凭据，改密走用户自己的设置页或邮箱重置
      expect(Object.keys(req.request.body)).not.toContain('password');
      expect(Object.keys(req.request.body)).not.toContain('username');
      expect(req.request.body).toEqual(value);
      req.flush({ statusCode: 200, message: '保存成功' });
    });
  });

  describe('令牌', () => {
    it('清单走 GET auth/token/index', () => {
      service.tokens().subscribe();
      const req = http.expectOne('auth/token/index');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('作废走 DELETE auth/token/:id:code', () => {
      const token: AuthToken = {
        id: '3',
        code: 'abc',
        valid: '1440',
        expired: '0',
        createAt: '1',
        updateAt: '1',
      };
      service.destroyToken(token).subscribe();
      const req = http.expectOne('auth/token/3:abc');
      expect(req.request.method).toBe('DELETE');
      req.flush({ statusCode: 200, message: '已作废' });
    });
  });
});
