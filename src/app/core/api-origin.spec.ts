import { describe, expect, it } from 'vitest';

import { apiOriginOf } from './api-origin';

describe('apiOriginOf', () => {
  it('协议相对地址按页面协议补齐（dev 的 //localhost:3000/）', () => {
    expect(apiOriginOf('//localhost:3000/', 'http://localhost:4200/#/data/sync')).toBe(
      'http://localhost:3000',
    );
    expect(apiOriginOf('//localhost:3000/', 'https://example.com/#/')).toBe(
      'https://localhost:3000',
    );
  });

  it('绝对地址原样取 origin（丢掉路径，socket 只认源）', () => {
    expect(apiOriginOf('http://192.0.2.10:3000/api/', 'http://x/')).toBe('http://192.0.2.10:3000');
  });

  it('缺失或非法配置返回 null（调用方据此判定「不能建连」）', () => {
    expect(apiOriginOf(undefined, 'http://x/')).toBeNull();
    expect(apiOriginOf('', 'http://x/')).toBeNull();
    expect(apiOriginOf('   ', 'http://x/')).toBeNull();
    expect(apiOriginOf('http://', 'not a url')).toBeNull();
  });
});
