import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SettingsService } from '@delon/theme';
import { NzAvatarComponent } from 'ng-zorro-antd/avatar';
import { describe, expect, it } from 'vitest';

import { UserAvatar } from './user-avatar';
import { avatarColorOf } from '../utils/avatar';

/** 运行时配置里的后端基址（页头/侧栏都按这个拼头像地址） */
const BASE_URL = '//localhost:3000/';

/**
 * 组装被测头像组件
 *
 * 注：每次先复位测试模块 —— 同一文件里要按不同输入渲染多次，
 * 复用同一个 TestBed 会让上一次的夹具残留
 *
 * @param inputs 初始输入
 * @returns 组件夹具
 */
function mount(inputs: {
  src?: string | null;
  name?: string | null;
  username?: string | null;
  size?: 'small' | 'default' | 'large' | number;
}): ComponentFixture<UserAvatar> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [UserAvatar],
    providers: [{ provide: SettingsService, useValue: { getData: () => BASE_URL } }],
  });
  /** 组件夹具 */
  const fixture = TestBed.createComponent(UserAvatar);
  for (const [key, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(key, value);
  }
  fixture.detectChanges();
  return fixture;
}

/**
 * 取 `nz-avatar` 宿主元素
 *
 * @param fixture 组件夹具
 * @returns 头像元素
 */
function avatarOf(fixture: ComponentFixture<UserAvatar>): HTMLElement {
  return (fixture.nativeElement as HTMLElement).querySelector('nz-avatar') as HTMLElement;
}

/**
 * 取浏览器归一化后的颜色写法
 *
 * 注：内联 `style.backgroundColor` 读回来是 `rgb(...)` 而不是写进去的十六进制，
 * 这里用同环境的探针元素换算，避免把 `rgb(91, 143, 249)` 硬编码进断言
 *
 * @param hex 十六进制色值
 * @returns 归一化后的颜色
 */
function normalizedColor(hex: string): string {
  /** 探针元素 */
  const probe = document.createElement('div');
  probe.style.backgroundColor = hex;
  return probe.style.backgroundColor;
}

describe('UserAvatar', () => {
  it('有头像时渲染图片，地址拼成「后端源」的绝对地址', () => {
    // 注：后端下发的是 `/static/...`（后端源路径），直接给 <img> 会被解析成前端源 ⇒ 永远 404
    /** 组件夹具 */
    const fixture = mount({ src: '/static/avatar/a.webp', name: '张三' });
    expect(avatarOf(fixture).querySelector('img')?.getAttribute('src')).toBe(
      'http://localhost:3000/static/avatar/a.webp',
    );
  });

  it('没有头像时回退首字符与稳定配色，不留空白圆块', () => {
    /** 组件夹具 */
    const fixture = mount({ src: '', name: '张三' });
    expect(avatarOf(fixture).querySelector('img')).toBeNull();
    expect(avatarOf(fixture).textContent).toContain('张');
    expect(avatarOf(fixture).style.backgroundColor).toBe(normalizedColor(avatarColorOf('张三')));
  });

  it('头像为空但昵称为空时退回登录用户名', () => {
    /** 组件夹具 */
    const fixture = mount({ src: null, name: '', username: 'admin' });
    expect(avatarOf(fixture).textContent).toContain('A');
  });

  it('图片加载失败回退首字符，换成新地址后恢复加载', () => {
    // 注：failed 用 linkedSignal 绑定 src，换头像后必须复位，否则新图永远显示不出来
    /** 组件夹具 */
    const fixture = mount({ src: '/static/avatar/a.webp', name: '张三' });
    /** 头像组件实例 */
    const avatar = fixture.debugElement.query(By.directive(NzAvatarComponent))
      .componentInstance as NzAvatarComponent;
    avatar.nzError.emit(new Event('error'));
    fixture.detectChanges();
    expect(avatarOf(fixture).querySelector('img')).toBeNull();
    expect(avatarOf(fixture).textContent).toContain('张');

    fixture.componentRef.setInput('src', '/static/avatar/b.webp');
    fixture.detectChanges();
    expect(avatarOf(fixture).querySelector('img')?.getAttribute('src')).toBe(
      'http://localhost:3000/static/avatar/b.webp',
    );
  });

  it('昵称与用户名都为空时给占位符，不渲染空文本', () => {
    /** 组件夹具 */
    const fixture = mount({ src: '', name: '', username: '' });
    expect(avatarOf(fixture).textContent).toContain('?');
  });
});
