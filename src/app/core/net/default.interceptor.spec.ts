import {
  HttpClient,
  HttpContext,
  HttpResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ALLOW_ANONYMOUS, DA_SERVICE_TOKEN } from '@delon/auth';
import { SettingsService } from '@delon/theme';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultInterceptor } from './default.interceptor';

/** 运行时配置的后端地址 */
const BASE = '//localhost:3000/';

/** 测试环境 */
interface Harness {
  http: HttpClient;
  controller: HttpTestingController;
  tokenSrv: { get: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn>; login_url: string };
  message: { error: ReturnType<typeof vi.fn> };
  router: { navigateByUrl: ReturnType<typeof vi.fn> };
}

/**
 * 构造测试环境
 */
function setup(): Harness {
  /** 令牌服务替身 */
  const tokenSrv = { get: vi.fn(() => undefined), clear: vi.fn(), login_url: '/passport/login' };
  /** 全局提示替身 */
  const message = { error: vi.fn() };
  /** 路由替身 */
  const router = { navigateByUrl: vi.fn(async () => true) };
  /** 通知替身 */
  const notify = { error: vi.fn() };

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([defaultInterceptor])),
      provideHttpClientTesting(),
      // 运行时的后端地址由 StartupService 写入 SettingsService
      {
        provide: SettingsService,
        useValue: { getData: (key: string) => (key === 'baseUrl' ? BASE : undefined) },
      },
      { provide: DA_SERVICE_TOKEN, useValue: tokenSrv },
      { provide: NzMessageService, useValue: message },
      { provide: Router, useValue: router },
      { provide: NzNotificationService, useValue: notify },
    ],
  });
  return {
    http: TestBed.inject(HttpClient),
    controller: TestBed.inject(HttpTestingController),
    tokenSrv,
    message,
    router,
  };
}

describe('defaultInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let tokenSrv: {
    get: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    login_url: string;
  };
  let message: { error: ReturnType<typeof vi.fn> };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    ({ http, controller, tokenSrv, message, router } = setup());
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    controller.verify();
    vi.restoreAllMocks();
  });

  it('业务接口按运行时配置拼上后端地址', () => {
    http.get('passport/init').subscribe();
    const req = controller.expectOne(`${BASE}passport/init`);
    expect(req.request.headers.get('Accept-Language')).toBe('zh-CN');
    req.flush({ initialized: false });
  });

  it('以 / 开头的业务路径不会出现双斜杠', () => {
    http.get('/user/startup').subscribe();
    controller.expectOne(`${BASE}user/startup`).flush({});
  });

  it('运行时配置文件本身不加前缀（否则启动阶段会陷入循环依赖）', () => {
    http.get('assets/config.json').subscribe();
    controller.expectOne('assets/config.json').flush({ baseUrl: BASE });
  });

  it('绝对地址与协议相对地址保持原样', () => {
    http.get('https://example.com/a').subscribe();
    controller.expectOne('https://example.com/a').flush({});
    http.get('//other:8080/b').subscribe();
    controller.expectOne('//other:8080/b').flush({});
  });

  it('匿名请求的 4xx 抛出后端响应体，不触发全局跳转', () => {
    let thrown: unknown;
    http
      .get('passport/login', {
        // 注：登录接口是匿名请求，401 属于业务错误
        context: new HttpContext().set(ALLOW_ANONYMOUS, true),
      })
      .subscribe({ error: (err) => (thrown = err) });
    controller
      .expectOne(`${BASE}passport/login`)
      .flush(
        { statusCode: 401, message: '用户名或密码不正确！' },
        { status: 401, statusText: 'Unauthorized' },
      );
    // 调用方可直接取 message 展示
    expect((thrown as { message?: string })?.message).toBe('用户名或密码不正确！');
    // 匿名请求不该被踢回登录页
    expect(tokenSrv.clear).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('登录态失效（非匿名 401）时清令牌并跳登录页', () => {
    vi.useFakeTimers();
    http.get('user/startup').subscribe({ error: () => undefined });
    controller
      .expectOne(`${BASE}user/startup`)
      .flush({ statusCode: 401, message: '令牌无效' }, { status: 401, statusText: 'Unauthorized' });

    expect(tokenSrv.clear).toHaveBeenCalled();
    vi.runAllTimers();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/passport/login');
    vi.useRealTimers();
  });

  it('5xx 抛出后端响应体，并给出全局提示', () => {
    let thrown: unknown;
    http.get('user/startup').subscribe({ error: (err) => (thrown = err) });
    controller
      .expectOne(`${BASE}user/startup`)
      .flush(
        { statusCode: 500, message: '数据库连接异常' },
        { status: 500, statusText: 'Server Error' },
      );

    // 抛出的是后端响应体，调用方直接取 message
    expect((thrown as { message?: string })?.message).toBe('数据库连接异常');
    expect(message.error).toHaveBeenCalledWith('数据库连接异常');
  });

  it('5xx 的全局提示对匿名请求关闭（避免与页面内联提示重复）', () => {
    http
      .get('passport/login', { context: new HttpContext().set(ALLOW_ANONYMOUS, true) })
      .subscribe({ error: () => undefined });
    controller
      .expectOne(`${BASE}passport/login`)
      .flush({ statusCode: 500 }, { status: 500, statusText: 'Server Error' });

    expect(message.error).not.toHaveBeenCalled();
  });

  it('未列入状态的响应原样返回', () => {
    let result: unknown;
    http.get('user/startup').subscribe((res) => (result = res));
    controller
      .expectOne(`${BASE}user/startup`)
      .flush(new HttpResponse({ status: 418, body: { a: 1 } }));

    expect((result as HttpResponse<unknown>).status).toBe(418);
  });
});
