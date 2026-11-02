import { describe, expect, it } from 'vitest';

import { assetUrl } from './asset-url';

describe('assetUrl', () => {
  it('外链 / 协议相对 / data / blob 原样返回', () => {
    expect(assetUrl('https://example.com/a.png', '//localhost:3000/')).toBe(
      'https://example.com/a.png',
    );
    expect(assetUrl('//cdn.example.com/a.png', '//localhost:3000/')).toBe(
      '//cdn.example.com/a.png',
    );
    expect(assetUrl('data:image/png;base64,AAAA', '//localhost:3000/')).toBe(
      'data:image/png;base64,AAAA',
    );
    expect(assetUrl('blob:http://x/1', '//localhost:3000/')).toBe('blob:http://x/1');
  });

  it('协议相对的 baseUrl 用页面地址补协议后只取 origin', () => {
    expect(assetUrl('/static/avatar/a.webp', '//localhost:3000/', 'http://192.168.1.3/')).toBe(
      'http://localhost:3000/static/avatar/a.webp',
    );
    expect(
      assetUrl('/static/avatar/a.webp', 'https://api.example.com/', 'http://192.168.1.3/'),
    ).toBe('https://api.example.com/static/avatar/a.webp');
  });

  it('同源反代前缀（/api/）拼在该前缀下，不是页面根', () => {
    expect(assetUrl('/static/avatar/a.webp', '/api/')).toBe('/api/static/avatar/a.webp');
    // 末尾斜杠多了也不能拼出双斜杠
    expect(assetUrl('/static/avatar/a.webp', '/api///')).toBe('/api/static/avatar/a.webp');
  });

  it('baseUrl 缺失时原样返回（至少不会指向错误的主机）', () => {
    expect(assetUrl('/static/avatar/a.webp', '')).toBe('/static/avatar/a.webp');
    expect(assetUrl('/static/avatar/a.webp', null)).toBe('/static/avatar/a.webp');
  });

  it('空值与纯空白返回空串，交给首字符头像兜底', () => {
    expect(assetUrl('', '//localhost:3000/')).toBe('');
    expect(assetUrl('   ', '//localhost:3000/')).toBe('');
    expect(assetUrl(null, '//localhost:3000/')).toBe('');
    expect(assetUrl(undefined, '//localhost:3000/')).toBe('');
  });

  it('baseUrl 写坏时不抛错，退回原值', () => {
    expect(assetUrl('/static/a.png', 'not-a-url', '')).toBe('/static/a.png');
  });

  it('裸 key 有页面地址时能拼到后端源（后端未拼 /static/ 的兜底）', () => {
    expect(assetUrl('avatar/a.webp', '//localhost:3000/', 'http://192.168.1.3/')).toBe(
      'http://localhost:3000/avatar/a.webp',
    );
  });

  it('裸 key 且拿不到页面地址时保持原值，不抛错', () => {
    expect(assetUrl('avatar/a.webp', '//localhost:3000/', '')).toBe('avatar/a.webp');
  });
});
