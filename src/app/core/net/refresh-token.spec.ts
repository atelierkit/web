import {
  HttpEvent,
  HttpRequest,
  HttpResponse,
  HttpResponseBase,
  provideHttpClient,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { DA_SERVICE_TOKEN, ITokenModel } from '@delon/auth';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { Observable, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { tryRefreshToken } from './refresh-token';

/** 重发请求的处理器签名 */
type Handler = (req: HttpRequest<unknown>) => Observable<HttpEvent<unknown>>;

/** 后端刷新后返回的令牌 */
const TOKEN = { id: 2, code: 'new', valid: 1440, expired: 0, createAt: 1, updateAt: 1 };

describe('tryRefreshToken', () => {
  let injector: Injector;
  let http: HttpTestingController;
  let tokenSrv: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    login_url: string;
  };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };
  let notify: { error: ReturnType<typeof vi.fn> };
  /** 重发请求用的处理器 */
  let next: Mock<Handler>;

  beforeEach(() => {
    /** 当前令牌，set 之后要能被 get 读到（重发请求会重新附加请求头） */
    let current: ITokenModel | undefined = { token: '2:old' } as ITokenModel;
    tokenSrv = {
      get: vi.fn(() => current),
      set: vi.fn((model: ITokenModel) => {
        current = model;
      }),
      clear: vi.fn(),
      login_url: '/passport/login',
    };
    router = { navigateByUrl: vi.fn(async () => true) };
    notify = { error: vi.fn() };
    next = vi.fn<Handler>(() => of(new HttpResponse({ status: 200 })));

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DA_SERVICE_TOKEN, useValue: tokenSrv },
        { provide: Router, useValue: router },
        { provide: NzNotificationService, useValue: notify },
      ],
    });
    injector = TestBed.inject(Injector);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('刷新接口自身返回 401 时直接回登录页，不再递归刷新', () => {
    vi.useFakeTimers();
    /** 原始响应 */
    const ev = new HttpResponse({ status: 401 }) as HttpResponseBase;
    /** 抛出的错误 */
    let thrown: unknown;
    tryRefreshToken(injector, ev, new HttpRequest('POST', '/user/refresh', null), next).subscribe({
      error: (err) => (thrown = err),
    });

    expect(thrown).toBe(ev);
    expect(tokenSrv.clear).toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalled();
    vi.runAllTimers();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/passport/login');
    // 一个刷新请求都不该发出
    http.expectNone('/user/refresh');
    expect(next).not.toHaveBeenCalled();
  });

  it('普通接口 401 时换发新令牌，并用新令牌重发原请求', () => {
    /** 原请求 */
    const req = new HttpRequest('GET', 'user/startup');
    /** 重发结果 */
    let status: number | undefined;
    tryRefreshToken(injector, new HttpResponse({ status: 401 }), req, next).subscribe((event) => {
      status = (event as HttpResponse<unknown>).status;
    });

    http.expectOne('/user/refresh').flush(TOKEN);
    // 新令牌写回本地（后端令牌形如 <用户ID>:<随机码>）
    expect(tokenSrv.set).toHaveBeenCalledWith({ token: '2:new', id: 2, expired: 0 });
    expect(next).toHaveBeenCalledTimes(1);
    /** 重发用的请求 */
    const resent = next.mock.calls[0][0] as HttpRequest<unknown>;
    expect(resent.url).toBe('user/startup');
    // 后端只认 token 头，且必须是刷新后的新值
    expect(resent.headers.get('token')).toBe('2:new');
    expect(status).toBe(200);
  });

  it('刷新失败时回登录页并抛出错误', () => {
    vi.useFakeTimers();
    /** 抛出的错误 */
    let thrown: unknown;
    tryRefreshToken(
      injector,
      new HttpResponse({ status: 401 }),
      new HttpRequest('GET', 'user/startup'),
      next,
    ).subscribe({ error: (err) => (thrown = err) });

    http
      .expectOne('/user/refresh')
      .flush(
        { statusCode: 401, message: '令牌已失效' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(thrown).toBeTruthy();
    expect(tokenSrv.clear).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('并发 401 只发一次刷新请求，其余请求等新令牌到达后再重发', () => {
    /** 第一个请求的结果 */
    let first = 0;
    /** 第二个请求的结果 */
    let second = 0;
    tryRefreshToken(
      injector,
      new HttpResponse({ status: 401 }),
      new HttpRequest('GET', 'user/startup'),
      next,
    ).subscribe(() => first++);

    // 第二个请求进入时刷新尚未完成，应挂起等待而不是再发一次刷新
    tryRefreshToken(
      injector,
      new HttpResponse({ status: 401 }),
      new HttpRequest('GET', 'req/index'),
      next,
    ).subscribe(() => second++);

    http.expectOne('/user/refresh').flush(TOKEN);
    // 只发了一次刷新请求（expectOne 已保证），两个原请求都重发了
    expect(first).toBe(1);
    expect(second).toBe(1);
    expect(next).toHaveBeenCalledTimes(2);
    // 注：挂起中的请求会在 refreshToken$ 发出时立即重发，先于首个请求的 switchMap 返回，
    // 所以这里按 URL 查而不是按调用顺序断言
    /** 待重发请求的 URL */
    const urls = next.mock.calls.map(([req]) => (req as HttpRequest<unknown>).url);
    expect(urls.sort()).toEqual(['req/index', 'user/startup']);
    /** 第二个重发请求 */
    const resent = next.mock.calls.find(
      ([req]) => (req as HttpRequest<unknown>).url === 'req/index',
    )![0] as HttpRequest<unknown>;
    expect(resent.headers.get('token')).toBe('2:new');
  });
});
