import type { ITokenModel } from '@delon/auth';
import { describe, expect, it } from 'vitest';

import { tokenState } from './home.format';

/**
 * 构造令牌
 *
 * @param expired 过期时间戳，0 表示长期有效
 * @returns 令牌模型
 */
function tokenOf(expired: number): ITokenModel {
  return { token: '1:abc', expired } as ITokenModel;
}

describe('tokenState', () => {
  it('长期有效令牌：deadline 为 0、判定有效', () => {
    expect(tokenState(tokenOf(0))).toEqual({ deadline: 0, alive: true });
  });

  it('有效期内令牌：保留过期时间、判定有效', () => {
    /** 未来时间戳 */
    const expired = Date.now() + 60_000;
    expect(tokenState(tokenOf(expired))).toEqual({ deadline: expired, alive: true });
  });

  it('过期令牌：保留过期时间、判定失效', () => {
    /** 过去时间戳 */
    const expired = Date.now() - 60_000;
    expect(tokenState(tokenOf(expired))).toEqual({ deadline: expired, alive: false });
  });

  it('没有令牌：deadline 为 0、判定失效（未登录不能展示成长期有效）', () => {
    expect(tokenState(null)).toEqual({ deadline: 0, alive: false });
  });
});
