import { describe, expect, it } from 'vitest';

import { dbText, editionText } from './kong.format';

describe('kong.format', () => {
  it('社区版 / 企业版给中文文案，未知值原样返回', () => {
    expect(editionText('community')).toBe('社区版（Community）');
    expect(editionText('enterprise')).toBe('企业版（Enterprise）');
    expect(editionText('kong-enterprise-2024')).toBe('kong-enterprise-2024');
    expect(editionText('')).toBe('-');
  });

  it('数据库三种状态分开描述（null 是不适用，不是不可达）', () => {
    expect(dbText(true)).toBe('可达');
    expect(dbText(false)).toBe('不可达');
    expect(dbText(null)).toBe('不适用（无数据库模式）');
  });
});
