import { describe, expect, it } from 'vitest';

import { TOKEN_VALID_DEFAULT, TOKEN_VALID_OPTIONS, tokenValidLabel } from './token';

describe('token 工具', () => {
  it('档位与后端 TOKEN_VALIDS 白名单逐项一致', () => {
    // 注：后端 token.constant.ts 的 TOKEN_VALIDS，改一边必须改另一边，否则令牌续期会被拒
    expect(TOKEN_VALID_OPTIONS.map((item) => item.value)).toEqual([60, 1440, 10080, 43200, 0]);
  });

  it('默认档位落在白名单内', () => {
    expect(TOKEN_VALID_OPTIONS.some((item) => item.value === TOKEN_VALID_DEFAULT)).toBe(true);
  });

  it('已知档位返回对应文案', () => {
    expect(tokenValidLabel(60)).toBe('1小时');
    expect(tokenValidLabel(43200)).toBe('30天');
  });

  it('长期有效的 0 档位不会被当成空值', () => {
    expect(tokenValidLabel(0)).toBe('长期有效');
  });

  it('未知档位退化为「N分钟」，便于发现前后端档位不一致', () => {
    expect(tokenValidLabel(7)).toBe('7分钟');
  });
});
