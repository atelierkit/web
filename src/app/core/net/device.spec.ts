import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getDeviceId } from './device';

/** 设备标识的本地存储键，注：与实现保持一致 */
const DEVICE_KEY = 'atelierkit.device';

describe('getDeviceId', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('首次调用生成标识并持久化，后续调用复用同一个', () => {
    /** 首次生成的标识 */
    const first = getDeviceId();
    expect(first).toBeTruthy();
    expect(localStorage.getItem(DEVICE_KEY)).toBe(first);
    // 同一浏览器重复登录必须落到同一设备分组，否则「每个设备一个令牌」不成立
    expect(getDeviceId()).toBe(first);
  });

  it('已保存标识时直接复用，不再生成', () => {
    localStorage.setItem(DEVICE_KEY, 'saved-device-id');
    expect(getDeviceId()).toBe('saved-device-id');
  });

  it('生成的标识符合后端允许的格式', () => {
    // 后端按 [A-Za-z0-9_-]{8,64} 校验，不符合会归入统一分组，等于多设备能力失效
    expect(getDeviceId()).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it('存储不可用时返回空串，不阻断登录', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(getDeviceId()).toBe('');
  });
});
