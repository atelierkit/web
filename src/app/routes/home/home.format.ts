import type { ITokenModel } from '@delon/auth';

import { isTokenValid } from '../../shared/utils/token';

/** 首页令牌展示状态 */
export interface HomeTokenState {
  /** 令牌过期时间戳（毫秒），0 表示长期有效或本地没有令牌 */
  deadline: number;
  /** 令牌是否有效（长期有效或仍在有效期内） */
  alive: boolean;
}

/**
 * 由本地令牌推导首页要展示的状态
 *
 * 注：`deadline` 为 0 有两种含义 —— 长期有效、或本地没有令牌（未登录 / 已清空），
 * 前者 `alive` 为真、后者为假，模板据此在「长期有效」与「已失效」之间切换
 *
 * @param token 本地令牌，未登录时为 null
 * @returns 展示状态
 */
export function tokenState(token: ITokenModel | null): HomeTokenState {
  /** 令牌过期时间，注：0 表示长期有效 */
  const expired = Number(token?.expired);
  return { deadline: expired || 0, alive: isTokenValid(token) };
}
