import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { startPageGuard } from './start-page.guard';

describe('startPageGuard', () => {
  it('当前实现直接放行（菜单重定向逻辑被注释保留）', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const result = TestBed.runInInjectionContext(() =>
      startPageGuard({} as never, { url: '/dashboard' } as never),
    );
    expect(result).toBe(true);
  });
});
