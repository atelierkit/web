import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { normalizeToken } from '@core';
import { DA_SERVICE_TOKEN, ITokenModel, ITokenService } from '@delon/auth';
import { SettingsService } from '@delon/theme';
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
  /** 头像，注：可选 —— 不传表示保持原值；头像单独走上传接口，这里一般只提交昵称 */
  avatar?: string;
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
  private readonly settingsSrv = inject(SettingsService);

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
   * 同步本地登录用户的资料
   *
   * 注 1：页头与侧栏都读 `SettingsService.user`（其背后是 signal），
   *      资料改完必须写回这里，相关组件才会当场刷新 ——
   *      只更新页面自己的 signal 的话，页头要等整页刷新才变
   * 注 2：合并而非覆盖，未传的字段保持原值（昵称与头像各自独立修改，谁也不该把对方清空）
   *
   * @param patch 变更的字段
   */
  syncProfile(patch: Partial<Pick<ProfileUser, 'name' | 'avatar' | 'email'>>): void {
    this.settingsSrv.setUser({ ...this.settingsSrv.user, ...patch });
  }

  /**
   * 上传头像
   *
   * 注 1：前端已裁成 256×256，后端按文件头校验格式（不信 mimetype）并返回新的头像地址
   * 注 2：字段名固定为 `file`，与后端 `FileInterceptor('file')` 对齐；
   *      不手动设 Content-Type —— 由浏览器补 multipart boundary，手写会把 boundary 写没
   *
   * @param file 裁剪后的图片数据
   * @returns 新的头像地址
   */
  uploadAvatar(file: Blob): Observable<{ avatar: string }> {
    /** 上传表单 */
    const body = new FormData();
    body.append('file', file, 'avatar.webp');
    return this.http.post<{ avatar: string }>('user/avatar', body);
  }

  /**
   * 申请更换绑定邮箱
   *
   * 注 1：验证码发到**新邮箱**，本接口只证明这个地址能收信，不会改绑
   * 注 2：拿到验证码后再调 `confirmEmail` 才真正落库；在此之前原邮箱一直有效
   *
   * @param email 新邮箱
   * @returns 业务操作结果
   */
  sendEmailCode(email: string): Observable<OperationResult> {
    return this.http.post<OperationResult>('user/email', { email });
  }

  /**
   * 确认更换绑定邮箱
   *
   * 注：验证码与邮箱必须与发送时一致 —— 期间改过邮箱就得重新取码
   *
   * @param email 新邮箱
   * @param code 邮箱验证码
   * @returns 业务操作结果
   */
  confirmEmail(email: string, code: string): Observable<OperationResult> {
    return this.http.post<OperationResult>('user/email/confirm', { email, code });
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
