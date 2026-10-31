import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { normalizeToken } from '@core';
import { DA_SERVICE_TOKEN, ITokenModel, ITokenService } from '@delon/auth';
import { OperationResult } from '@shared';
import { Observable, map } from 'rxjs';

/** 当前登录用户的资料，注：对应后端 `user/show` 的返回（`UserService.show` 的 all 口径） */
export interface ProfileUser {
  /** 用户ID */
  id: number;
  /** 登录用户名 */
  username: string;
  /** 昵称 */
  name: string;
  /** 头像URL */
  avatar: string;
  /** 电子邮箱，注：可选资料，未填写时为 null */
  email: string | null;
  /** 状态，true表示启用 */
  status: boolean;
  /** 授权角色 */
  roles: string[];
  /** 登录令牌有效期（分钟），0 表示长期有效 */
  tokenValid: number;
  /** 登录次数 */
  loginTimes: number;
  /** 首次登录时间戳 */
  firstLoginAt: number;
  /** 最后登录IP */
  lastLoginIp: string;
  /** 最后登录时间戳 */
  lastLoginAt: number;
  /** 最后会话时间戳 */
  lastSessionAt: number;
}

/** 个人资料修改信息，注：后端 DTO 只接收昵称与头像，状态与权限归管理端 */
export interface ProfileUpdatePayload {
  /** 昵称 */
  name: string;
  /** 头像URL */
  avatar: string;
}

/** 修改密码信息，注：后端要求先校验原密码，避免拿到登录态就能直接改密 */
export interface PasswordPayload {
  /** 原密码 */
  oldPassword: string;
  /** 新密码 */
  newPassword: string;
}

/**
 * 个人中心服务
 *
 * 注：接口挂在 `user/*` 下，用户ID一律由后端从令牌里取，前端不传 —— 传了也不认，
 * 避免越权改他人资料
 */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly tokenSrv = inject<ITokenService>(DA_SERVICE_TOKEN);

  /**
   * 获取当前登录用户的资料
   *
   * @returns 用户资料
   */
  show(): Observable<ProfileUser> {
    return this.http.get<ProfileUser>('user/show');
  }

  /**
   * 修改昵称与头像
   *
   * @param value 修改信息
   * @returns 用户ID
   */
  update(value: ProfileUpdatePayload): Observable<unknown> {
    return this.http.post('user/update', value);
  }

  /**
   * 申请更换绑定邮箱
   *
   * 注：后端只发送激活邮件，新邮箱在点击邮件链接（`passport/activate`）后才生效
   *
   * @param email 新邮箱
   * @returns 用户ID
   */
  changeEmail(email: string): Observable<unknown> {
    return this.http.post('user/email', { email });
  }

  /**
   * 修改登录密码
   *
   * 注 1：后端会校验原密码、复杂度与「新旧不能相同」，并作废该用户的其它会话（保留当前令牌），
   * 因此成功文案里会带上踢掉了几个会话，直接展示后端 `msg` 即可
   * 注 2：从未设置过密码的历史账号会返回 409「该账号尚未设置密码，请先通过邮箱重置密码」，
   * 这种情况要走登录页的「忘记密码」用邮箱验证码设置
   *
   * @param value 改密信息
   * @returns 业务操作结果
   */
  changePassword(value: PasswordPayload): Observable<OperationResult> {
    return this.http.post<OperationResult>('user/password', value);
  }

  /**
   * 屏幕锁定解锁
   *
   * 注：用户ID由后端从令牌里取，前端只传密码；密码错误时后端返回 400 而非 401，
   * 避免被拦截器当成登录过期踢回登录页。成功后令牌保持不变，直接跳回首页即可
   *
   * @param password 登录密码
   * @returns 业务操作结果
   */
  unlock(password: string): Observable<OperationResult> {
    return this.http.post<OperationResult>('user/unlock', { password });
  }

  /**
   * 设置登录有效期
   *
   * 注：后端会先落库为默认有效期、再按新有效期重新签发令牌，
   * 因此成功后必须用返回的令牌覆盖本地登录态，否则页面显示的过期时间与实际不符
   *
   * @param valid 有效期（单位：分钟），注：0 表示长期有效
   * @returns 新的令牌信息
   */
  setValid(valid: number): Observable<ITokenModel> {
    return this.http.post('user/valid', { valid }).pipe(
      map((res: unknown) => {
        /** 新的令牌信息 */
        const token = normalizeToken(res);
        this.tokenSrv.set(token);
        return token;
      }),
    );
  }

  /**
   * 本地令牌
   *
   * @returns 令牌信息，未登录时为 null
   */
  get token(): ITokenModel | null {
    return this.tokenSrv.get() ?? null;
  }
}
