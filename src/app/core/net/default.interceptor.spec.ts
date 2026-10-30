import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ALLOW_ANONYMOUS } from '@delon/auth';
import { SettingsService } from '@delon/theme';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { defaultInterceptor } from './default.interceptor';

/** 运行时配置的后端地址 */
const BASE = '//localhost:3000/';

/**
 * 构造测试环境
 */
function setup(): { http: HttpClient; controller: HttpTestingController } {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([defaultInterceptor])),
      provideHttpClientTesting(),
      // 运行时的后端地址由 StartupService 写入 SettingsService
      {
        provide: SettingsService,
        useValue: { getData: (key: string) => (key === 'baseUrl' ? BASE : undefined) },
      },
    ],
  });
  return { http: TestBed.inject(HttpClient), controller: TestBed.inject(HttpTestingController) };
}

describe('defaultInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    ({ http, controller } = setup());
  });

  afterEach(() => controller.verify());

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
  });
});
