import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ReuseTabService } from '@delon/abc/reuse-tab';
import { ACLService } from '@delon/acl';
import { DA_SERVICE_TOKEN } from '@delon/auth';
import { _HttpClient, MenuService, SettingsService, TitleService } from '@delon/theme';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { Observable, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StartupService } from './startup.service';

/** 运行时配置 */
const CONFIG = { baseUrl: '//localhost:3000/', name: '个人工具平台', description: '工具集' };

/** 后端令牌 */
const TOKEN = { id: 2, code: 'new', valid: 1440, expired: 0, createAt: 1, updateAt: 1 };

/**
 * 后端异常形态（拦截器抛出的是响应体）
 *
 * @param status 状态码
 * @param message 业务错误信息
 */
function apiError(status: number, message: string): { statusCode: number; message: string } {
  return { statusCode: status, message };
}

describe('StartupService', () => {
  let service: StartupService;
  let http: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };
  let settings: {
    setData: ReturnType<typeof vi.fn>;
    setApp: ReturnType<typeof vi.fn>;
    setUser: ReturnType<typeof vi.fn>;
  };
  let acl: { setRole: ReturnType<typeof vi.fn> };
  let title: { suffix?: string };
  let menu: { add: ReturnType<typeof vi.fn> };
  let notify: { error: ReturnType<typeof vi.fn> };
  let tokenSrv: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    login_url: string;
  };
  let reuseTab: { clear: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    http = { get: vi.fn(), post: vi.fn() };
    router = { navigateByUrl: vi.fn(async () => true) };
    settings = { setData: vi.fn(), setApp: vi.fn(), setUser: vi.fn() };
    acl = { setRole: vi.fn() };
    title = {};
    menu = { add: vi.fn() };
    notify = { error: vi.fn() };
    tokenSrv = { get: vi.fn(), set: vi.fn(), clear: vi.fn(), login_url: '/passport/login' };
    reuseTab = { clear: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        // 注：StartupService 的 @Injectable() 没有 providedIn，需显式登记
        StartupService,
        { provide: _HttpClient, useValue: http },
        { provide: Router, useValue: router },
        { provide: SettingsService, useValue: settings },
        { provide: ACLService, useValue: acl },
        { provide: TitleService, useValue: title },
        { provide: MenuService, useValue: menu },
        { provide: NzNotificationService, useValue: notify },
        { provide: DA_SERVICE_TOKEN, useValue: tokenSrv },
        { provide: ReuseTabService, useValue: reuseTab },
      ],
    });
    service = TestBed.inject(StartupService);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  /**
   * 执行启动加载
   *
   * @returns 是否正常结束（未抛错）
   */
  async function run(): Promise<boolean> {
    let done = false;
    await new Promise<void>((resolve) => {
      (service.load() as Observable<void>).subscribe({
        next: () => undefined,
        error: () => resolve(),
        complete: () => {
          done = true;
          resolve();
        },
      });
    });
    return done;
  }

  it('无令牌时只注入运行时配置，并清空上一次的残留登录态', async () => {
    http.get.mockReturnValue(of(CONFIG));
    tokenSrv.get.mockReturnValue(undefined);

    expect(await run()).toBe(true);
    expect(settings.setData).toHaveBeenCalledWith('baseUrl', CONFIG.baseUrl);
    expect(settings.setApp).toHaveBeenCalledWith({
      name: CONFIG.name,
      description: CONFIG.description,
    });
    expect(title.suffix).toBe(CONFIG.name);
    expect(menu.add).toHaveBeenCalled();
    // 无令牌：清空路由复用、用户信息与授权
    expect(reuseTab.clear).toHaveBeenCalled();
    expect(settings.setUser).toHaveBeenCalledWith({});
    expect(acl.setRole).toHaveBeenCalledWith([]);
    // 不应该去打用户信息接口
    expect(http.get).toHaveBeenCalledTimes(1);
  });

  it('有令牌时加载用户信息并按服务端设置续期令牌', async () => {
    http.get.mockImplementation((url: string) =>
      url === 'assets/config.json'
        ? of(CONFIG)
        : of({ username: 'admin', name: '', avatar: 'a.png', email: null, roles: ['admin'] }),
    );
    http.post.mockReturnValue(of(TOKEN));
    tokenSrv.get.mockReturnValue({ token: '2:old' });

    expect(await run()).toBe(true);
    // 昵称为空时退回用户名，避免页头空白
    expect(settings.setUser).toHaveBeenCalledWith({
      name: 'admin',
      avatar: 'a.png',
      email: '',
    });
    expect(acl.setRole).toHaveBeenCalledWith(['admin']);
    expect(http.post).toHaveBeenCalledWith('user/refresh');
    // 续期后回写本地令牌
    expect(tokenSrv.set).toHaveBeenCalledWith(
      expect.objectContaining({ token: '2:new', expired: 0 }),
    );
  });

  it('运行时配置缺少后端地址时给出明确提示，而不是静默进入系统', async () => {
    http.get.mockReturnValue(of({ name: 'x' }));

    expect(await run()).toBe(true);
    expect(notify.error).toHaveBeenCalledWith(
      '应用初始化失败',
      '未配置有效后端地址！',
      expect.anything(),
    );
  });

  it('登录态失效时清空令牌并跳登录页，且不再尝试重试', async () => {
    http.get.mockImplementation((url: string) =>
      url === 'assets/config.json' ? of(CONFIG) : throwError(() => apiError(401, '令牌无效')),
    );
    tokenSrv.get.mockReturnValue({ token: '2:old' });

    expect(await run()).toBe(true);
    expect(tokenSrv.clear).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/passport/login');
    expect(settings.setUser).toHaveBeenCalledWith({});
    expect(acl.setRole).toHaveBeenCalledWith([]);
    // 401 重试没有意义，只请求一次
    expect(http.get).toHaveBeenCalledTimes(2);
    // 鉴权失效走跳转，不再弹「初始化失败」
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('续期遇到非鉴权故障时保留本地令牌与授权，不打断本次登录态', async () => {
    http.get.mockImplementation((url: string) =>
      url === 'assets/config.json' ? of(CONFIG) : of({ username: 'admin', roles: ['admin'] }),
    );
    http.post.mockReturnValue(throwError(() => apiError(500, '数据库连接异常')));
    tokenSrv.get.mockReturnValue({ token: '2:old' });

    expect(await run()).toBe(true);
    expect(acl.setRole).toHaveBeenCalledWith(['admin']);
    // 令牌仍在有效期内，不能因为续期失败就踢人
    expect(tokenSrv.clear).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(notify.error).not.toHaveBeenCalled();
  });
});
