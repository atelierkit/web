import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ALLOW_ANONYMOUS, DA_SERVICE_TOKEN, ITokenModel } from '@delon/auth';
import { Observable, catchError, map, of, shareReplay, tap } from 'rxjs';

import { normalizeToken } from '../net/helper';

/** 后端签发的令牌对象 */
export interface ApiToken {
  /** 令牌随机码 */
  code: string;
  /** 用户ID */
  id: number;
  /** 有效期（分钟），0 表示长期有效 */
  valid: number;
  /** 过期时间戳（毫秒），0 表示长期有效 */
  expired: number;
  /** 创建时间 */
  createAt: number;
  /** 更新时间 */
  updateAt: number;
}

/** 初始化状态 */
export interface PassportState {
  /** 是否已完成初始化 */
  initialized: boolean;
}

/** 创建管理员账号入参 */
export interface SetupPayload {
  /** 用户名 */
  username: string;
  /** 密码 */
  password: string;
  /** 昵称 */
  name?: string;
  /** 电子邮箱 */
  email?: string;
  /** 初始化凭据，注：仅当服务端配置了 SETUP_TOKEN 时需要 */
  setupToken?: string;
}

/** 登录入参 */
export interface LoginPayload {
  /** 用户名 */
  username: string;
  /** 密码 */
  password: string;
}

/** 匿名请求上下文，注：登录/初始化请求不能带令牌，也不会因 401 被踢回登录页 */
function anonymous(): HttpContext {
  return new HttpContext().set(ALLOW_ANONYMOUS, true);
}

/** 登录与初始化服务 */
@Injectable({ providedIn: 'root' })
export class PassportService {
  private readonly http = inject(HttpClient);
  private readonly tokenSrv = inject(DA_SERVICE_TOKEN);
  /** 初始化状态缓存，注：同一会话内只探测一次，避免每次路由切换都打接口 */
  private state$?: Observable<PassportState>;

  /**
   * 获取初始化状态
   *
   * 注：探测失败时按「已初始化」处理（fail-open）—— 后端不可用时把用户锁在创建管理员页面
   * 只会让人以为系统坏了；真正的初始化闸门在服务端，客户端这里不该拦截
   *
   * @param force 是否强制重新探测
   * @returns 初始化状态
   */
  init(force = false): Observable<PassportState> {
    if (force || !this.state$) {
      this.state$ = this.http.get<PassportState>('passport/init', { context: anonymous() }).pipe(
        catchError((error) => {
          console.warn('PassportService.init: 初始化状态查询失败，按已初始化处理', error);
          // 清掉缓存，下次导航再试一次
          this.state$ = undefined;
          return of({ initialized: true } as PassportState);
        }),
        shareReplay(1),
      );
    }
    return this.state$;
  }

  /**
   * 创建管理员账号（仅系统未初始化时可用）
   *
   * @param payload 管理员信息
   * @returns 令牌模型
   */
  setup(payload: SetupPayload): Observable<ITokenModel> {
    /** 初始化凭据请求头 */
    const headers: Record<string, string> = {};
    /** 去掉空白的凭据 */
    const setupToken = (payload.setupToken ?? '').trim();
    if (setupToken) {
      headers['X-Setup-Token'] = setupToken;
    }
    return this.http
      .post<ApiToken>(
        'passport/setup',
        {
          username: payload.username.trim().toLowerCase(),
          password: payload.password,
          name: payload.name?.trim() || undefined,
          email: payload.email?.trim() || undefined,
        },
        { context: anonymous(), headers },
      )
      .pipe(
        // 初始化成功后状态立即翻转，避免守卫再把用户送回创建页
        tap(() => {
          this.state$ = of({ initialized: true } as PassportState);
        }),
        map((token) => this.save(token, payload.username)),
      );
  }

  /**
   * 用户名密码登录
   *
   * @param payload 登录信息
   * @returns 令牌模型
   */
  login(payload: LoginPayload): Observable<ITokenModel> {
    return this.http
      .post<ApiToken>(
        'passport/login',
        { username: payload.username.trim(), password: payload.password },
        { context: anonymous() },
      )
      .pipe(map((token) => this.save(token, payload.username)));
  }

  /**
   * 清除登录态
   */
  logout(): void {
    this.tokenSrv.clear();
  }

  /**
   * 保存令牌
   *
   * 注：后端令牌形如 `<用户ID>:<随机码>`，请求头由 `@delon/auth` 按
   * `token` 键发送（默认配置即为 `token: ${token}`），无需额外拦截器
   *
   * @param token 后端令牌对象
   * @param username 用户名，注：用于页头展示，随后会由 `user/startup` 覆盖为昵称
   * @returns 令牌模型
   */
  private save(token: ApiToken, username: string): ITokenModel {
    /** 令牌模型 */
    const model = normalizeToken({ ...token, name: username });
    this.tokenSrv.set(model);
    return model;
  }
}
