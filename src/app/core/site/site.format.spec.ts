import { describe, expect, it } from 'vitest';

import { DEFAULT_APP_NAME, copyrightText, mergeApp, mergeIcp } from './site.format';

describe('mergeApp', () => {
  it('使用后端配置的应用信息', () => {
    expect(mergeApp({ name: '星图', description: '量化平台' })).toEqual({
      name: '星图',
      description: '量化平台',
    });
  });

  it('后端未配置名称时使用内置名称，说明留空', () => {
    expect(mergeApp(undefined)).toEqual({ name: DEFAULT_APP_NAME, description: '' });
    expect(mergeApp({})).toEqual({ name: DEFAULT_APP_NAME, description: '' });
  });

  it('忽略纯空白取值，避免页头显示空标题', () => {
    expect(mergeApp({ name: '   ', description: ' ' })).toEqual({
      name: DEFAULT_APP_NAME,
      description: '',
    });
  });
});

describe('mergeIcp', () => {
  it('返回去掉首尾空白的备案信息', () => {
    expect(mergeIcp({ owner: ' 张三 ', icp: ' 京ICP备2024000000号 ' })).toEqual({
      owner: '张三',
      icp: '京ICP备2024000000号',
    });
  });

  it('只有备案号时也返回，主体为空', () => {
    expect(mergeIcp({ icp: '京ICP备2024000000号' })).toEqual({
      owner: '',
      icp: '京ICP备2024000000号',
    });
  });

  it('两项都为空时返回 null，页脚据此不渲染备案行', () => {
    expect(mergeIcp(undefined)).toBeNull();
    expect(mergeIcp({})).toBeNull();
    expect(mergeIcp({ owner: '  ', icp: '' })).toBeNull();
  });
});

describe('copyrightText', () => {
  it('配置了备案主体时带上主体与「版权所有」', () => {
    expect(copyrightText(2026, '张三')).toBe('Copyright © 2026 张三 版权所有');
  });

  it('未配置主体时只显示年份', () => {
    expect(copyrightText(2026)).toBe('Copyright © 2026');
    expect(copyrightText(2026, '  ')).toBe('Copyright © 2026');
  });
});
