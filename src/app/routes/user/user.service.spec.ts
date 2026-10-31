import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DA_SERVICE_TOKEN } from '@delon/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UserService } from './user.service';

/** 令牌服务替身 */
interface TokenStub {
  /** 写入令牌 */
  set: ReturnType<typeof vi.fn>;
  /** 读取令牌 */
  get: ReturnType<typeof vi.fn>;
  /** 清空令牌 */
  clear: ReturnType<typeof vi.fn>;
}

/**
 * 构造令牌服务替身
 *
 * @returns 令牌服务替身
 */
function tokenServiceStub(): TokenStub {
  return { set: vi.fn(), get: vi.fn(() => null), clear: vi.fn() };
}

describe('UserService', () => {
  let service: UserService;
  let http: HttpTestingController;
  let tokenSrv: TokenStub;

  beforeEach(() => {
    tokenSrv = tokenServiceStub();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DA_SERVICE_TOKEN, useValue: tokenSrv },
      ],
    });
    service = TestBed.inject(UserService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('资料走 GET user/show，用户ID由后端从令牌取，前端不传', () => {
    service.show().subscribe();
    const req = http.expectOne('user/show');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ id: 1, username: 'dev' });
  });

  it('改资料走 POST user/update，且只提交昵称与头像', () => {
    const value = { name: '开发', avatar: 'https://example.com/a.png' };
    service.update(value).subscribe();
    const req = http.expectOne('user/update');
    expect(req.request.method).toBe('POST');
    // 注：状态与角色归管理端，个人端 DTO 只接收这两个字段
    expect(req.request.body).toEqual(value);
    req.flush(1);
  });

  it('换邮箱走 POST user/email，提交 { email }', () => {
    service.changeEmail('new@example.com').subscribe();
    const req = http.expectOne('user/email');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'new@example.com' });
    req.flush(1);
  });

  it('改密走 POST user/password，提交原密码与新密码，并回传后端的提示文案', () => {
    let result: { code: number; msg: string } | undefined;
    service
      .changePassword({ oldPassword: 'abc12345', newPassword: 'abc12346' })
      .subscribe((res) => (result = res));
    const req = http.expectOne('user/password');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ oldPassword: 'abc12345', newPassword: 'abc12346' });
    req.flush({ code: 0, msg: '密码修改成功，已退出2个其它会话！' });
    // 注：后端会说明踢掉了几个其它会话，页面直接展示这句，不在前端拼
    expect(result?.msg).toBe('密码修改成功，已退出2个其它会话！');
  });

  it('设置有效期走 POST user/valid，并用返回的新令牌覆盖本地登录态', () => {
    let result: unknown;
    service.setValid(60).subscribe((token) => (result = token));
    const req = http.expectOne('user/valid');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ valid: 60 });
    // 注：后端返回的字段是数字或字符串皆可，服务层负责归一化
    req.flush({
      id: 3,
      code: 'abc',
      valid: 60,
      expired: 1700000000000,
      createAt: 1690000000000,
      updateAt: 1690000000000,
    });
    expect(tokenSrv.set).toHaveBeenCalledWith({
      id: 3,
      code: 'abc',
      valid: 60,
      expired: 1700000000000,
      createAt: 1690000000000,
      updateAt: 1690000000000,
      token: '3:abc',
    });
    expect(result).toEqual(tokenSrv.set.mock.calls[0][0]);
  });

  it('本地令牌为空时 token 返回 null', () => {
    expect(service.token).toBeNull();
  });

  it('已登录时 token 原样返回本地令牌', () => {
    const model = { token: '1:abc', expired: 0 };
    tokenSrv.get.mockReturnValue(model);
    expect(service.token).toEqual(model);
  });
});
