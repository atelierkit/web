import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ALLOW_ANONYMOUS } from '@delon/auth';
import { Observable, catchError, forkJoin, map, of, shareReplay } from 'rxjs';

import type { SiteApp, SiteIcp, SiteInfo } from './site.format';

/** 匿名请求上下文，注：登录页与创建管理员页要读站点信息，此时还没有令牌 */
function anonymous(): HttpContext {
  return new HttpContext().set(ALLOW_ANONYMOUS, true);
}

/**
 * 站点信息服务（应用配置与备案信息）
 *
 * 注：数据源是管理员在「配置 → 应用配置 / 备案配置」中维护的 `settings` 表记录，
 * 通过 `/passport` 前缀下的只读接口获取；未配置时后端会返回内置默认值
 */
@Injectable({ providedIn: 'root' })
export class SiteService {
  private readonly http = inject(HttpClient);
  /** 站点信息缓存，注：登录页、创建管理员页与页脚共用，同一会话内只请求一次 */
  private info$?: Observable<SiteInfo>;

  /**
   * 获取站点信息
   *
   * 注 1：`passport` 前缀在后端令牌守卫中直接放行，因此未登录也能读到管理员配置的
   * 应用名称与备案信息，登录页不需要为此外挂令牌
   * 注 2：任一接口失败只把该项置空，不打断另一个，页脚据此自行隐藏备案行
   *
   * @param force 是否强制重新获取，注：管理员改完配置后刷新页面即可，无需轮询
   * @returns 站点信息
   */
  info(force = false): Observable<SiteInfo> {
    if (force || !this.info$) {
      this.info$ = forkJoin({
        app: this.fetch<SiteApp>('passport/app'),
        icp: this.fetch<SiteIcp>('passport/icp'),
      }).pipe(
        // 后端返回空体时同样按「未配置」处理，避免模板取属性报错
        map(({ app, icp }): SiteInfo => ({ app: app ?? {}, icp: icp ?? {} })),
        shareReplay(1),
      );
    }
    return this.info$;
  }

  /**
   * 读取单个配置
   *
   * @param url 接口地址
   * @returns 配置内容，注：失败时返回空对象，兜底值由调用方决定
   */
  private fetch<T extends object>(url: string): Observable<Partial<T>> {
    return this.http.get<Partial<T>>(url, { context: anonymous() }).pipe(
      catchError((err: unknown) => {
        console.warn(`站点信息读取失败（${url}）：`, err);
        return of({} as Partial<T>);
      }),
    );
  }
}
