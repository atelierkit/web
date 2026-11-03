import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { DA_SERVICE_TOKEN } from '@delon/auth';
import { SettingsService, User } from '@delon/theme';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HeaderUser } from './user';

/** 运行时配置里的后端基址，注：头像地址按它拼成「后端源」的绝对地址 */
const BASE_URL = '//localhost:3000/';

/**
 * 设置服务替身
 *
 * 注：`user` 必须与真身一样由 signal 承载 —— 被测组件靠这个 signal 依赖把 OnPush 的模板标脏。
 * 若替身用普通对象属性，组件即使写成构造时的字段快照也能通过，测出来是假绿
 */
class SettingsStub {
  /** 当前登录用户，注：真身内部同样是 signal */
  private readonly current = signal<User>({
    name: '张三',
    avatar: '/static/avatar/a.webp',
    email: 'a@b.com',
  });

  /** 取运行时配置（只有头像组件用得到的后端基址） */
  getData(): string {
    return BASE_URL;
  }

  /** 当前登录用户 */
  get user(): User {
    return this.current();
  }

  /**
   * 写入当前登录用户
   *
   * @param value 用户资料
   */
  setUser(value: User): void {
    this.current.set(value);
  }
}

/**
 * 组装被测页头用户组件
 *
 * @returns 组件夹具与设置服务替身
 */
function mount(): { fixture: ComponentFixture<HeaderUser>; settings: SettingsStub } {
  TestBed.resetTestingModule();
  /** 设置服务替身 */
  const settings = new SettingsStub();
  TestBed.configureTestingModule({
    imports: [HeaderUser],
    providers: [
      // 模板里有两个 routerLink，RouterLink 指令需要 Router
      provideRouter([]),
      { provide: SettingsService, useValue: settings },
      { provide: DA_SERVICE_TOKEN, useValue: { clear: vi.fn(), login_url: '/passport/login' } },
    ],
  });
  /** 组件夹具 */
  const fixture = TestBed.createComponent(HeaderUser);
  fixture.detectChanges();
  return { fixture, settings };
}

/**
 * 取页头的头像图片地址
 *
 * @param fixture 组件夹具
 * @returns 图片地址，未渲染图片时为 null
 */
function avatarSrcOf(fixture: ComponentFixture<HeaderUser>): string | null {
  return (fixture.nativeElement as HTMLElement).querySelector('img')?.getAttribute('src') ?? null;
}

/**
 * 取页头渲染出的文本
 *
 * @param fixture 组件夹具
 * @returns 文本内容
 */
function textOf(fixture: ComponentFixture<HeaderUser>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

describe('HeaderUser', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('初始按当前用户渲染头像与昵称', () => {
    /** 组件夹具 */
    const { fixture } = mount();
    expect(avatarSrcOf(fixture)).toBe('http://localhost:3000/static/avatar/a.webp');
    expect(textOf(fixture)).toContain('张三');
  });

  it('换头像与改昵称后当场刷新，不必刷新整页', () => {
    // 注：这是本组件最要紧的行为 —— 个人中心保存后只写 SettingsService，
    // 页头能不能立刻变，全看这里读的是 signal 还是构造时的快照
    /** 组件夹具与设置服务替身 */
    const { fixture, settings } = mount();
    settings.setUser({ name: '李四', avatar: '/static/avatar/b.webp', email: 'a@b.com' });
    fixture.detectChanges();
    expect(avatarSrcOf(fixture)).toBe('http://localhost:3000/static/avatar/b.webp');
    expect(textOf(fixture)).toContain('李四');
    // 注：旧图地址必须彻底换掉，否则浏览器会一直拿缓存里的旧头像
    expect(textOf(fixture)).not.toContain('张三');
  });

  it('退出登录清空令牌并回到登录页', () => {
    /** 组件夹具 */
    const { fixture } = mount();
    /** 路由 */
    const router = TestBed.inject(Router);
    /** 路由跳转的替身，注：不真正导航，只验证跳到了登录页 */
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    /** 令牌服务替身 */
    const tokenSrv = TestBed.inject(DA_SERVICE_TOKEN) as unknown as {
      clear: ReturnType<typeof vi.fn>;
      login_url: string;
    };
    // 注：logout 是 protected，模板里的下拉菜单项是懒渲染、点不到，直接从实例上调
    (fixture.componentInstance as unknown as { logout: () => void }).logout();
    expect(tokenSrv.clear).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(tokenSrv.login_url);
  });
});
