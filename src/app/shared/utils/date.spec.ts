import { describe, expect, it } from 'vitest';

import { formatDateTime } from './date';

describe('formatDateTime', () => {
  it('按 yyyy-MM-dd HH:mm:ss 输出本地时间', () => {
    // 注：用本地时间构造，避免用例依赖运行机器的时区
    expect(formatDateTime(new Date(2026, 9, 31, 8, 5, 3).getTime())).toBe('2026-10-31 08:05:03');
  });

  it('月 / 日 / 时分秒都补零', () => {
    expect(formatDateTime(new Date(2026, 0, 2, 3, 4, 5).getTime())).toBe('2026-01-02 03:04:05');
  });

  it('秒级时间戳按 unit=s 处理（否则会显示成 1970 年）', () => {
    /** 秒级时间戳 */
    const seconds = Math.floor(new Date(2026, 9, 31, 8, 5, 3).getTime() / 1000);
    expect(formatDateTime(seconds, 's')).toBe('2026-10-31 08:05:03');
  });

  it('无值（undefined / null / 0）返回空串，不显示 1970', () => {
    expect(formatDateTime(undefined)).toBe('');
    expect(formatDateTime(null)).toBe('');
    expect(formatDateTime(0)).toBe('');
  });
});
