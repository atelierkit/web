import { HttpHeaders } from '@angular/common/http';
import { Injector } from '@angular/core';
import { Router } from '@angular/router';
import { DA_SERVICE_TOKEN, ITokenModel, TokenService } from '@delon/auth';
import type { NzSafeAny } from 'ng-zorro-antd/core/types';
import { NzNotificationService } from 'ng-zorro-antd/notification';

export interface ReThrowHttpError {
  body: unknown;
  _throw: true;
}

export const CODEMESSAGE: Record<number, string> = {
  200: '服务器成功返回请求的数据。',
  201: '新建或修改数据成功。',
  202: '一个请求已经进入后台排队（异步任务）。',
  204: '删除数据成功。',
  400: '发出的请求有错误，服务器没有进行新建或修改数据的操作。',
  401: '用户没有权限（令牌、用户名、密码错误）。',
  403: '用户得到授权，但是访问是被禁止的。',
  404: '发出的请求针对的是不存在的记录，服务器没有进行操作。',
  406: '请求的格式不可得。',
  410: '请求的资源被永久删除，且不会再得到的。',
  422: '当创建一个对象时，发生一个验证错误。',
  500: '服务器发生错误，请检查服务器。',
  502: '网关错误。',
  503: '服务不可用，服务器暂时过载或维护。',
  504: '网关超时。',
};

export function goTo(injector: Injector, url: string): void {
  setTimeout(() => injector.get(Router).navigateByUrl(url));
}

export function toLogin(injector: Injector): void {
  /** 令牌服务 */
  const tokenSrv = injector.get(DA_SERVICE_TOKEN);
  // 先清除无效令牌，避免带着过期令牌反复触发跳转
  tokenSrv.clear();
  injector.get(NzNotificationService).error(`未登录或登录已过期，请重新登录。`, ``);
  goTo(injector, injector.get<TokenService>(DA_SERVICE_TOKEN).login_url!);
}

/** 界面语言，注：本项目不做国际化，统一简体中文 */
const LANG = 'zh-CN';

export function getAdditionalHeaders(headers?: HttpHeaders): Record<string, string> {
  const res: Record<string, string> = {};
  if (!headers?.has('Accept-Language')) {
    res['Accept-Language'] = LANG;
  }

  return res;
}

/**
 * 提示后端返回的错误信息
 *
 * 注：拦截器仅对 5xx 弹全局提示，4xx 一律抛给调用方，
 * 故调用方需在 subscribe 的 error 分支里取 `message`，否则失败时界面没有任何反馈
 *
 * @param err 拦截器抛出的后端响应体
 * @param fallback 后端未给出业务错误信息时的兜底文案
 * @returns 可直接展示的文案
 */
export function apiErrorMessage(err: NzSafeAny, fallback = '请求失败，请稍后重试！'): string {
  // 参数校验失败时后端返回错误信息数组，业务异常为字符串
  const message = Array.isArray(err?.message) ? err.message.join('；') : err?.message;
  if (message) {
    return message;
  }
  if (err?.status === 0 || err?.status === undefined) {
    return fallback;
  }
  return `${fallback}（${err.status}）`;
}

/**
 * 归一化后端返回的令牌信息
 *
 * 注：后端返回的令牌同时包含 id/code/valid 等业务字段，本地存储统一拼出
 * `id:code` 形式的令牌，并把数字字段转为数值类型（长期有效令牌的 expired 为 0）
 *
 * @param res 后端返回的令牌信息
 * @returns 可供本地存储的令牌信息
 */
export function normalizeToken(res: NzSafeAny): ITokenModel {
  return {
    ...res,
    token: `${res.id}:${res.code}`,
    expired: Number(res.expired),
    id: Number(res.id),
    valid: Number(res.valid),
    createAt: Number(res.createAt),
    updateAt: Number(res.updateAt),
  } as ITokenModel;
}
