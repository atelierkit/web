import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ALLOW_ANONYMOUS, DA_SERVICE_TOKEN } from '@delon/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PassportService } from './passport.service';

/** 令牌服务替身 */
interface TokenStub {
  set: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  login_url: string;
}

/**
 * 构造令牌服务替身
 */
function tokenServiceStub(): TokenStub {
  return {
    set: vi.fn(),
    get: vi.fn(() => undefined),
    clear: vi.fn(),
    login_url: '/passport/login',
  };
}

describe('PassportService', () => {
  let service: PassportService;
  let http: HttpTestingController;
  let tokenSrv: ReturnType<typeof tokenServiceStub>;

  beforeEach(() => {
    tokenSrv = tokenServiceStub();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DA_SERVICE_TOKEN, useValue: tokenSrv },
      ],
    });
    service = TestBed.inject(PassportService);
    http = TestBed.inject(HttpTestingController);
    // 失败分支会 warn，测试里静音避免刷屏
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  describe('init', () => {
    it('匿名请求探测初始化状态，且同一会话内只探测一次', () => {
      let initialized: boolean | undefined;
      service.init().subscribe((state) => (initialized = state.initialized));
      const req = http.expectOne('passport/init');
      // 注：未初始化时还没有令牌，必须走匿名上下文，否则会被踢回登录页
      expect(req.request.context.get(ALLOW_ANONYMOUS)).toBe(true);
      req.flush({ initialized: false });
      expect(initialized).toBe(false);

      // 第二次直接取缓存，不再打接口
      service.init().subscribe();
      http.expectNone('passport/init');
    });

    it('force 为 true 时重新探测', () => {
      service.init().subscribe();
      http.expectOne('passport/init').flush({ initialized: true });

      service.init(true).subscribe();
      http.expectOne('passport/init').flush({ initialized: true });
    });

    it('探测失败时按「已初始化」处理，并清掉缓存以便下次重试', () => {
      let initialized: boolean | undefined;
      service.init().subscribe((state) => (initialized = state.initialized));
      http
        .expectOne('passport/init')
        .flush({ statusCode: 500, message: 'boom' }, { status: 500, statusText: 'Server Error' });

      // fail-open：后端不可用时不该把用户锁在创建管理员页
      expect(initialized).toBe(true);
      expect(console.warn).toHaveBeenCalled();

      service.init().subscribe();
      http.expectOne('passport/init').flush({ initialized: true });
    });
  });

  describe('setup', () => {
    it('用户名转小写、可选字段去空白后为空则不发', () => {
      service.setup({ username: '  Admin ', password: 'abc12345', name: '  ' }).subscribe();
      const req = http.expectOne('passport/setup');
      expect(req.request.body).toEqual({
        username: 'admin',
        password: 'abc12345',
        name: undefined,
        email: undefined,
      });
      expect(req.request.context.get(ALLOW_ANONYMOUS)).toBe(true);
      req.flush({ id: 1, code: 'abc', valid: 1440, expired: 0 });
    });

    it('配置了初始化凭据时带 X-Setup-Token，未配置时不带', () => {
      service
        .setup({ username: 'admin', password: 'abc12345', setupToken: ' secret ' })
        .subscribe();
      const withToken = http.expectOne('passport/setup');
      expect(withToken.request.headers.get('X-Setup-Token')).toBe('secret');
      withToken.flush({ id: 1, code: 'abc', valid: 1440, expired: 0 });

      service.setup({ username: 'admin', password: 'abc12345', setupToken: '   ' }).subscribe();
      const withoutToken = http.expectOne('passport/setup');
      expect(withoutToken.request.headers.has('X-Setup-Token')).toBe(false);
      withoutToken.flush({ id: 1, code: 'abc', valid: 1440, expired: 0 });
    });

    it('成功后保存令牌，并立即把初始化状态翻转为已完成', () => {
      let token: { token?: string } | undefined;
      service.setup({ username: 'Admin', password: 'abc12345' }).subscribe((model) => {
        token = model as { token?: string };
      });
      http
        .expectOne('passport/setup')
        .flush({ id: 3, code: 'xyz', valid: 1440, expired: 0, createAt: 1, updateAt: 1 });

      // 后端令牌形如 <用户ID>:<随机码>
      expect(token?.token).toBe('3:xyz');
      expect(tokenSrv.set).toHaveBeenCalledWith(token);
      // 状态已翻转，守卫不会再把用户送回创建页
      service.init().subscribe();
      http.expectNone('passport/init');
    });
  });

  describe('login', () => {
    it('用户名只去空白不转小写（登录保持用户原输入），成功后保存令牌', () => {
      let token: { token?: string } | undefined;
      service.login({ username: ' Admin ', password: 'abc12345' }).subscribe((model) => {
        token = model as { token?: string };
      });
      const req = http.expectOne('passport/login');
      expect(req.request.body).toEqual({ username: 'Admin', password: 'abc12345' });
      expect(req.request.context.get(ALLOW_ANONYMOUS)).toBe(true);
      req.flush({ id: 7, code: 'code', valid: 60, expired: 0 });

      expect(token?.token).toBe('7:code');
      expect(tokenSrv.set).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('清除本地令牌', () => {
      service.logout();
      expect(tokenSrv.clear).toHaveBeenCalled();
    });
  });

  describe('重置密码', () => {
    it('发送验证码走匿名 POST passport/reset，邮箱去空白', () => {
      service.resetCode('  a@b.com ').subscribe();
      const req = http.expectOne('passport/reset');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'a@b.com' });
      // 注：忘记密码时一定没有有效登录态，必须走匿名上下文，否则 401 会被踢回登录页
      expect(req.request.context.get(ALLOW_ANONYMOUS)).toBe(true);
      req.flush({ code: 0, msg: '如果该邮箱已绑定账号，验证码已发送' });
    });

    it('重置走匿名 POST passport/reset/confirm，原样提交邮箱、验证码与新密码', () => {
      service.reset({ email: ' a@b.com ', code: '123456', password: 'abc12346' }).subscribe();
      const req = http.expectOne('passport/reset/confirm');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        email: 'a@b.com',
        code: '123456',
        password: 'abc12346',
      });
      expect(req.request.context.get(ALLOW_ANONYMOUS)).toBe(true);
      req.flush({ code: 0, msg: '密码已重置，请使用新密码登录！' });
    });
  });
});
