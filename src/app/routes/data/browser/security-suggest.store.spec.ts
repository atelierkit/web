import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { SecurityOption } from '../data.service';
import { SECURITY_SUGGEST_DEBOUNCE, SecuritySuggestStore } from './security-suggest.store';

/** 让 `debounceTime(0)` 的宏任务跑完（测试里把时延置 0，不睡真实计时器） */
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** 一条候选 */
const PUFA: SecurityOption = {
  code: 'sh.600000',
  name: '浦发银行',
  type: 'Stock',
  market: 'Shanghai',
};

describe('SecuritySuggestStore', () => {
  let store: SecuritySuggestStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SecuritySuggestStore,
        { provide: SECURITY_SUGGEST_DEBOUNCE, useValue: 0 },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    store = TestBed.inject(SecuritySuggestStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('输入后按去空白的关键字请求联想，结果写入候选', async () => {
    store.search(' 浦发 ');
    await tick();

    // 防抖结束后才进入「取数中」（时延内置 250ms，测试置 0）
    expect(store.loading()).toBe(true);

    const req = http.expectOne((r) => r.url === 'data/security/suggest');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('keyword')).toBe('浦发');
    req.flush([PUFA]);

    expect(store.options()).toEqual([PUFA]);
    expect(store.keyword()).toBe('浦发');
    expect(store.loading()).toBe(false);
    expect(store.empty()).toBe(false);
  });

  it('清空输入不发请求，并收掉已有候选', async () => {
    store.options.set([PUFA]);
    store.search('   ');
    await tick();

    http.expectNone((r) => r.url === 'data/security/suggest');
    expect(store.options()).toEqual([]);
    expect(store.loading()).toBe(false);
    // 没有关键字时不该显示「无匹配」
    expect(store.empty()).toBe(false);
  });

  it('连打时只发最后一次（前一次的候选不会后到覆盖）', async () => {
    store.search('6');
    store.search('600');
    await tick();

    const req = http.expectOne((r) => r.url === 'data/security/suggest');
    expect(req.request.params.get('keyword')).toBe('600');
    req.flush([PUFA]);

    expect(store.options()).toEqual([PUFA]);
  });

  it('接口失败静默为空候选（不抛错、不清掉输入）', async () => {
    store.search('pfyh');
    await tick();

    http
      .expectOne((r) => r.url === 'data/security/suggest')
      .flush('boom', { status: 500, statusText: 'Server Error' });

    expect(store.options()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.keyword()).toBe('pfyh');
    // 有输入、查完了、但没候选 → 空态成立
    expect(store.empty()).toBe(true);
  });

  it('reset 收掉候选与关键字（选中一项后调用）', async () => {
    store.options.set([PUFA]);
    store.keyword.set('浦发');

    store.reset();
    await tick();

    expect(store.options()).toEqual([]);
    expect(store.keyword()).toBe('');
    expect(store.loading()).toBe(false);
  });
});
