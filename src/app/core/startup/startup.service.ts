import { DOCUMENT } from '@angular/common';
import {
  EnvironmentProviders,
  Injectable,
  Provider,
  inject,
  provideAppInitializer,
} from '@angular/core';
import { Router } from '@angular/router';
import { ReuseTabService } from '@delon/abc/reuse-tab';
import { ACLService } from '@delon/acl';
import { DA_SERVICE_TOKEN, TokenService } from '@delon/auth';
import { _HttpClient, MenuService, SettingsService, TitleService } from '@delon/theme';
import type { NzSafeAny } from 'ng-zorro-antd/core/types';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { Observable, catchError, finalize, map, mergeMap, of, retry, timer } from 'rxjs';

import { normalizeToken } from '../net/helper';

/** 基础数据加载的重试次数，注：用于网络抖动、数据库连接被掐断等瞬时故障 */
const LOAD_RETRY = 2;
/** 基础数据加载的重试间隔基数（毫秒） */
const LOAD_RETRY_DELAY = 500;

/**
 * 判断异常是否属于登录态失效
 *
 * 注：拦截器抛出的是后端响应体（`{ statusCode, message }`），
 * 而框架自身抛出的才是 `HttpErrorResponse`（`{ status }`），故两者都要兼容
 *
 * @param err 异常对象
 * @returns 是否为登录态失效
 */
function isAuthError(err: NzSafeAny): boolean {
  return [401, 403].includes(Number(err?.status ?? err?.statusCode) || 0);
}

/**
 * Used for application startup
 * Generally used to get the basic data of the application, like: Menu Data, User Data, etc.
 */
export function provideStartup(): Array<Provider | EnvironmentProviders> {
  return [
    StartupService,
    provideAppInitializer(() => {
      const initializerFn = (
        (startupService: StartupService) => () =>
          startupService.load()
      )(inject(StartupService));
      return initializerFn();
    }),
  ];
}

/**
 * 用于应用启动时
 * 一般用来获取应用所需要的基础数据等
 */
@Injectable()
export class StartupService {
  private readonly router = inject(Router);
  private readonly http = inject(_HttpClient);
  private readonly doc = inject(DOCUMENT);
  private readonly settingsSrv = inject(SettingsService);
  private readonly aclSrv = inject(ACLService);
  private readonly titleSrv = inject(TitleService);
  private readonly menuSrv = inject(MenuService);
  private readonly notifySrv = inject(NzNotificationService);
  private readonly tokenSrv = inject<TokenService>(DA_SERVICE_TOKEN);
  private readonly reuseTabService = inject(ReuseTabService, { optional: true });

  /**
   * 应用启动加载
   *
   * 注：先读运行时配置 `assets/config.json` 拿到后端地址（部署时改这一个文件即可切换后端），
   * 再按是否有令牌决定是否加载用户信息；令牌续期属于附带动作，失败时不影响本次登录态
   *
   * @returns 启动完成的 Observable
   */
  load(): Observable<void> {
    return this.http.get('assets/config.json').pipe(
      mergeMap((config: NzSafeAny) => {
        if (typeof config?.baseUrl !== 'string') {
          throw new Error('未配置有效后端地址！');
        }
        // 后端地址注入到 SettingsService，由 defaultInterceptor 取用
        this.settingsSrv.setData('baseUrl', config.baseUrl);
        /** 站点名 */
        const name = config.name as string;
        this.settingsSrv.setApp({
          name: config.name ?? '个人工具平台',
          description: config.description ?? '',
        });
        this.titleSrv.suffix = name;
        // 菜单与权限外壳（菜单尚未接入后端，保持静态）
        this.setupShell();
        // 当不存在令牌时
        if (!this.tokenSrv.get()?.token) {
          // 清空路由复用信息、用户信息与授权，避免残留上一次登录态
          this.reuseTabService?.clear();
          this.settingsSrv.setUser({});
          this.aclSrv.setRole([]);
          return of(void 0);
        }
        // 当存在令牌时
        return this.http.get('user/startup').pipe(
          // 瞬时故障重试，避免因首次连接超时等原因以空授权进入系统
          retry({
            count: LOAD_RETRY,
            delay: (err: NzSafeAny, attempt: number) => {
              // 登录态失效重试无意义，直接抛出交由统一异常处理
              if (isAuthError(err)) {
                throw err;
              }
              console.warn(`加载用户信息失败，正在进行第${attempt}次重试：`, err);
              return timer(LOAD_RETRY_DELAY * attempt);
            },
          }),
          map((user: NzSafeAny) => {
            // 用户信息：包括姓名、头像、邮箱地址
            this.settingsSrv.setUser({
              name: user.name || user.username,
              avatar: user.avatar,
              email: user.email ?? '',
            });
            // 用户授权
            this.aclSrv.setRole(user.roles ?? []);
          }),
          mergeMap(() => this.refresh()),
        );
      }),
      catchError((err: NzSafeAny) => this.fail(err)),
      finalize(() => this.removeLoading()),
    );
  }

  /**
   * 续期登录令牌
   *
   * 注：有效期以用户在服务端的设置为准，客户端不再传值
   *
   * @returns 续期完成的 Observable
   */
  private refresh(): Observable<void> {
    return this.http.post('user/refresh').pipe(
      map((res: NzSafeAny) => {
        this.tokenSrv.set(normalizeToken(res));
      }),
      catchError((err: NzSafeAny) => {
        // 令牌已在服务端失效（换新失败或已被其它会话替换），仅能重新登录
        if (isAuthError(err)) {
          return this.fail(err);
        }
        // 瞬时故障时保留本地令牌，本次登录态与授权不受影响
        console.warn('令牌续期失败，本次登录态保持不变：', err);
        return of(void 0);
      }),
    );
  }

  /**
   * 统一异常处理
   *
   * 登录态失效时清空令牌并回到登录页，其余异常保留登录态并给出明确提示
   *
   * @param err 异常对象，注：拦截器抛出的是后端响应体
   * @returns 处理完成的 Observable
   */
  private fail(err: NzSafeAny): Observable<void> {
    console.warn('应用初始化失败：', err);
    // 清空路由复用信息
    this.reuseTabService?.clear();
    if (isAuthError(err)) {
      // 登录态失效：清空令牌与残留信息，回到登录页
      this.tokenSrv.clear();
      this.settingsSrv.setUser({});
      this.aclSrv.setRole([]);
      this.router.navigateByUrl(this.tokenSrv.login_url!);
      return of(void 0);
    }
    // 其余异常：登录态仍然有效，明确提示失败原因，避免以「已登录但无任何授权」的状态静默进入系统
    this.notifySrv.error(
      '应用初始化失败',
      err?.message ?? err?.msg ?? '请检查网络后刷新页面重试！',
      {
        nzDuration: 0,
      },
    );
    return of(void 0);
  }

  /**
   * 初始化应用外壳（菜单与权限）
   *
   * 注：菜单尚未接入后端，先沿用静态配置
   */
  private setupShell(): void {
    // Menu data, https://ng-alain.com/theme/menu
    this.menuSrv.add([
      {
        text: 'Main',
        group: true,
        children: [
          {
            text: 'Dashboard',
            link: '/dashboard',
            icon: { type: 'icon', value: 'appstore' },
          },
        ],
      },
    ]);
  }

  /**
   * 移除首屏加载动画
   */
  private removeLoading(): void {
    this.doc.querySelector('.preloader')?.remove();
  }
}
