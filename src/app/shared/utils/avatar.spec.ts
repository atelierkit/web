import { describe, expect, it } from 'vitest';

import { AVATAR_COLORS, avatarColorOf, avatarTextOf } from './avatar';

describe('avatarTextOf', () => {
  it('中文取首字、英文取首字母并大写', () => {
    expect(avatarTextOf('张三')).toBe('张');
    expect(avatarTextOf('alice')).toBe('A');
    expect(avatarTextOf('  bob ')).toBe('B');
  });

  it('昵称为空时退回登录用户名', () => {
    expect(avatarTextOf('', 'admin')).toBe('A');
    expect(avatarTextOf(null, 'admin')).toBe('A');
  });

  it('全空时给一个占位符，不返回空串（空文本会渲染成空白圆块）', () => {
    expect(avatarTextOf('')).toBe('?');
    expect(avatarTextOf('   ', '  ')).toBe('?');
    expect(avatarTextOf(null, null)).toBe('?');
  });

  it('emoji 不会被截成半个字符', () => {
    expect(avatarTextOf('😀abc')).toBe('😀');
  });
});

describe('avatarColorOf', () => {
  it('同名同色（不能随机，否则每次刷新都换色）', () => {
    expect(avatarColorOf('张三')).toBe(avatarColorOf('张三'));
    expect(avatarColorOf('alice')).toBe(avatarColorOf('alice'));
  });

  it('空值落到色板第一项', () => {
    expect(avatarColorOf('')).toBe(AVATAR_COLORS[0]);
    expect(avatarColorOf(null)).toBe(AVATAR_COLORS[0]);
  });

  it('取值一定在色板内', () => {
    for (const name of ['张三', 'alice', 'bob', '管理员', 'x'.repeat(50)]) {
      expect(AVATAR_COLORS).toContain(avatarColorOf(name));
    }
  });
});
