import { TestBed } from '@angular/core/testing';
import { provideRouter, UrlTree } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { PassportService } from './passport.service';
import { setupGuard } from './setup.guard';

/**
 * 在注入上下文中执行守卫
 *
 * @param url 目标地址
 * @param initialized 初始化状态
 * @returns 守卫结果
 */
async function run(url: string, initialized: boolean): Promise<boolean | UrlTree> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: PassportService, useValue: { init: () => of({ initialized }) } },
    ],
  });
  const result = TestBed.runInInjectionContext(() => setupGuard({} as never, { url } as never));
  return firstValueFrom(result as never) as Promise<boolean | UrlTree>;
}

describe('setupGuard', () => {
  it('未初始化时把任意入口导向创建管理员页', async () => {
    const result = await run('/dashboard', false);
    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toBe('/passport/setup');
  });

  it('未初始化时允许停留在创建管理员页', async () => {
    expect(await run('/passport/setup', false)).toBe(true);
  });

  it('已初始化时允许正常访问', async () => {
    expect(await run('/dashboard', true)).toBe(true);
  });

  it('已初始化后创建管理员页不可再访问', async () => {
    const result = await run('/passport/setup', true);
    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toBe('/passport/login');
  });
});
