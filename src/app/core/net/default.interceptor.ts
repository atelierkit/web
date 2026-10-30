import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponseBase,
} from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { ALLOW_ANONYMOUS } from '@delon/auth';
import { IGNORE_BASE_URL, SettingsService } from '@delon/theme';
import { environment } from '@env/environment';
import type { NzSafeAny } from 'ng-zorro-antd/core/types';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Observable, of, throwError, mergeMap, catchError } from 'rxjs';

import { ReThrowHttpError, getAdditionalHeaders, toLogin } from './helper';
import { tryRefreshToken } from './refresh-token';

function handleData(
  injector: Injector,
  ev: HttpResponseBase,
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
  /** 是否为匿名请求，注：登录、初始化这类接口的 401/403 属于业务错误，应交给页面处理 */
  const anonymous = req.context.get(ALLOW_ANONYMOUS);
  // 业务处理：一些通用操作
  switch (ev.status) {
    case 200:
      break;
    case 401:
      // 匿名请求（登录页等）的 401 属于业务错误，交给调用方处理，不触发全局登录态失效
      if (anonymous) {
        break;
      }
      if (
        environment.api.refreshTokenEnabled &&
        environment.api.refreshTokenType === 're-request'
      ) {
        return tryRefreshToken(injector, ev, req, next);
      }
      toLogin(injector);
      break;
    case 403:
    case 404:
    case 500:
      // goTo(injector, `/exception/${ev.status}?url=${req.urlWithParams}`);
      break;
    default:
      if (ev instanceof HttpErrorResponse) {
        console.warn(
          '未可知错误，大部分是由于后端不支持跨域CORS或无效配置引起，请参考 https://ng-alain.com/docs/server 解决跨域问题',
          ev,
        );
      }
      break;
  }
  if (ev instanceof HttpErrorResponse) {
    // 5xx 仅在非匿名请求下弹出全局提示，避免与业务页面的内联提示重复
    if (ev.status >= 500 && !anonymous) {
      injector
        .get(NzMessageService)
        .error((ev.error as NzSafeAny)?.message ?? '服务器异常，请稍后重试！');
    }
    // 抛出后端响应体（`{ statusCode, message }`）而非 HttpErrorResponse，
    // 调用方可直接取 message 展示，无需再拆一层
    return throwError(() => ev.error);
  } else if ((ev as unknown as ReThrowHttpError)._throw === true) {
    return throwError(() => (ev as unknown as ReThrowHttpError).body);
  } else {
    return of(ev) as unknown as Observable<HttpEvent<unknown>>;
  }
}

export const defaultInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);
  // 统一加上服务端前缀
  let url = req.url;
  if (
    !req.context.get(IGNORE_BASE_URL) &&
    !url.startsWith('https://') &&
    !url.startsWith('http://') &&
    // 协议相对地址（`//host/`）与静态资源不加前缀
    !url.startsWith('//') &&
    !url.startsWith('assets')
  ) {
    /** 后端服务地址，注：来自 `assets/config.json`（运行时配置），由 StartupService 注入 */
    const baseUrl = injector.get(SettingsService).getData('baseUrl') as string | undefined;
    if (!baseUrl) {
      // 注：配置缺失时明确报错，避免拼出 `undefined/passport/init` 这种更难排查的地址
      throw new Error('未配置有效后端地址，请检查 assets/config.json！');
    }
    url = baseUrl + (baseUrl.endsWith('/') && url.startsWith('/') ? url.substring(1) : url);
  }
  const newReq = req.clone({ url, setHeaders: getAdditionalHeaders(req.headers) });

  return next(newReq).pipe(
    mergeMap((ev) => {
      // 允许统一对请求错误处理
      if (ev instanceof HttpResponseBase) {
        return handleData(injector, ev, newReq, next);
      }
      // 若一切都正常，则后续操作
      return of(ev);
    }),
    // 注：非 2xx 走的是错误通道，必须在这里接住，否则 401 不会触发登录态失效处理
    catchError((err: HttpErrorResponse) => handleData(injector, err, newReq, next)),
  );
};
