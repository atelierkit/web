import { HttpHeaders } from '@angular/common/http';
import { Injector } from '@angular/core';
import { Router } from '@angular/router';
import { DA_SERVICE_TOKEN, ITokenModel } from '@delon/auth';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiErrorMessage, getAdditionalHeaders, goTo, normalizeToken, toLogin } from './helper';

/** 令牌服务替身 */
interface TokenStub {
  clear: ReturnType<typeof vi.fn>;
  login_url: string;
}

/**
 * 构造令牌服务替身
 */
function tokenServiceStub(): TokenStub {
  return {
    clear: vi.fn(),
    login_url: '/passport/login',
  };
}

/**
 * 构造注入器替身
 *
 * @param tokenSrv 令牌服务替身
 * @param extras 其他按 token 取值的替身
 */
function injectorOf(
  tokenSrv: ReturnType<typeof tokenServiceStub>,
  extras: { router?: unknown; notify?: unknown } = {},
): Injector {
  const map = new Map<unknown, unknown>([
    [DA_SERVICE_TOKEN, tokenSrv],
    [Router, extras.router ?? { navigateByUrl: vi.fn() }],
    [NzNotificationService, extras.notify ?? { error: vi.fn() }],
  ]);
  return { get: (token: unknown) => map.get(token) } as unknown as Injector;
}

describe('helper', () => {
  describe('getAdditionalHeaders', () => {
    it('未声明语言时补上简体中文', () => {
      expect(getAdditionalHeaders()).toEqual({ 'Accept-Language': 'zh-CN' });
      expect(getAdditionalHeaders(new HttpHeaders())).toEqual({ 'Accept-Language': 'zh-CN' });
    });

    it('调用方已显式声明语言时不覆盖', () => {
      const headers = new HttpHeaders({ 'Accept-Language': 'en-US' });
      expect(getAdditionalHeaders(headers)).toEqual({});
    });
  });

  describe('apiErrorMessage', () => {
    it('参数校验错误（message 为数组）拼成一行', () => {
      expect(apiErrorMessage({ message: ['用户名不能为空！', '密码长度不足！'] })).toBe(
        '用户名不能为空！；密码长度不足！',
      );
    });

    it('业务异常直接取 message', () => {
      expect(apiErrorMessage({ message: '邮箱已被占用！' })).toBe('邮箱已被占用！');
    });

    it('没有 message 时按状态码给出兜底文案', () => {
      // 网络错误（status 0）与未知状态不加状态码，避免出现「请求失败（0）」
      expect(apiErrorMessage({ status: 0 })).toBe('请求失败，请稍后重试！');
      expect(apiErrorMessage({})).toBe('请求失败，请稍后重试！');
      expect(apiErrorMessage({ status: 500 })).toBe('请求失败，请稍后重试！（500）');
    });

    it('允许调用方自定义兜底文案', () => {
      expect(apiErrorMessage({ status: 502 }, '保存失败')).toBe('保存失败（502）');
    });
  });

  describe('normalizeToken', () => {
    it('拼出 id:code 形式的本地令牌，并把数字字段转成数值', () => {
      const model = normalizeToken({
        id: '3',
        code: 'abc',
        valid: '1440',
        expired: '0',
        createAt: '1700000000000',
        updateAt: '1700000000001',
        name: 'admin',
      }) as ITokenModel & Record<string, unknown>;

      expect(model.token).toBe('3:abc');
      // 注：ITokenModel 之外的自定义字段走索引签名，需用中括号取值
      expect(model['id']).toBe(3);
      // 长期有效令牌的 expired 为 0，不能被当成过期
      expect(model.expired).toBe(0);
      expect(model['valid']).toBe(1440);
      expect(model['createAt']).toBe(1700000000000);
    });
  });

  describe('goTo / toLogin', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('goTo 延迟跳转（让当前导航先结束）', () => {
      const router = { navigateByUrl: vi.fn(async () => true) };
      goTo(injectorOf(tokenServiceStub(), { router }), '/dashboard');
      expect(router.navigateByUrl).not.toHaveBeenCalled();
      vi.runAllTimers();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
    });

    it('toLogin 先清令牌再提示，最后跳登录页', () => {
      const tokenSrv = tokenServiceStub();
      const notify = { error: vi.fn() };
      const router = { navigateByUrl: vi.fn(async () => true) };
      toLogin(injectorOf(tokenSrv, { notify, router }));

      // 注：不清令牌会带着过期令牌反复触发跳转
      expect(tokenSrv.clear).toHaveBeenCalled();
      expect(notify.error).toHaveBeenCalled();
      vi.runAllTimers();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/passport/login');
    });
  });

  it('toLogin 用的登录地址来自 TokenService（与 @delon/auth 配置保持一致）', () => {
    vi.useFakeTimers();
    const tokenSrv = tokenServiceStub();
    const router = { navigateByUrl: vi.fn(async () => true) };
    toLogin(injectorOf(tokenSrv, { router }));
    vi.runAllTimers();
    expect(router.navigateByUrl).toHaveBeenCalledWith(tokenSrv.login_url);
    vi.useRealTimers();
  });
});
