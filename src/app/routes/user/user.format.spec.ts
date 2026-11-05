import { describe, expect, it, vi } from 'vitest';

import { USER_TABS, cropRectOf, expiredLabel, tabIndexOf, userStatusLabel } from './user.format';

describe('user.format', () => {
  it('标签页与子路由逐项对应，顺序即下标', () => {
    expect(USER_TABS.map((item) => item.path)).toEqual(['basic', 'password', 'secure', 'valid']);
  });

  it('由地址算出高亮标签', () => {
    expect(tabIndexOf('/user/basic')).toBe(0);
    expect(tabIndexOf('/user/password')).toBe(1);
    expect(tabIndexOf('/user/secure')).toBe(2);
    expect(tabIndexOf('/user/valid')).toBe(3);
  });

  it('带查询串时仍能认出标签', () => {
    expect(tabIndexOf('/user/valid?from=menu')).toBe(3);
  });

  it('认不出的地址回落到第一个标签，不会出现「没有任何高亮项」', () => {
    expect(tabIndexOf('/user')).toBe(0);
    expect(tabIndexOf('/user/unknown')).toBe(0);
    expect(tabIndexOf('/home')).toBe(0);
  });

  it('启用状态用中文文案展示', () => {
    expect(userStatusLabel(true)).toBe('启用');
    expect(userStatusLabel(false)).toBe('禁用');
  });

  describe('cropRectOf', () => {
    it('横图取短边并水平居中', () => {
      expect(cropRectOf(800, 400)).toEqual({ sx: 200, sy: 0, size: 400 });
    });

    it('竖图取短边并垂直居中', () => {
      expect(cropRectOf(400, 800)).toEqual({ sx: 0, sy: 200, size: 400 });
    });

    it('正方形原样裁', () => {
      expect(cropRectOf(300, 300)).toEqual({ sx: 0, sy: 0, size: 300 });
    });

    it('尺寸为 0 或非法值时给 size = 0，由调用方拦下', () => {
      expect(cropRectOf(0, 0)).toEqual({ sx: 0, sy: 0, size: 0 });
      expect(cropRectOf(Number.NaN, 100)).toEqual({ sx: 0, sy: 0, size: 0 });
      expect(cropRectOf(-10, 100)).toEqual({ sx: 0, sy: 0, size: 0 });
    });
  });

  describe('expiredLabel', () => {
    /** 固定格式化的替身，注：便于断言「是否走了格式化」而不依赖时区 */
    const format = vi.fn((at: number) => `T${at}`);

    it('令牌已失效时优先提示已失效', () => {
      expect(expiredLabel(1000, false, format)).toBe('已失效');
      expect(format).not.toHaveBeenCalled();
    });

    it('过期时间为 0（长期有效）时不进时间格式化', () => {
      expect(expiredLabel(0, true, format)).toBe('长期有效');
      expect(format).not.toHaveBeenCalled();
    });

    it('有过期时间时交给格式化函数', () => {
      expect(expiredLabel(1700000000000, true, format)).toBe('T1700000000000');
    });
  });
});
