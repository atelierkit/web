import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { SHARED_IMPORTS } from '@shared';
import { filter } from 'rxjs';

import { USER_TABS, tabIndexOf } from '../user.format';

/**
 * 账号管理布局组件
 *
 * 注 1：旧私有项目用 `@brand` 的 `service-layout`（侧边二级导航），开源仓库里没有 `@brand`，
 * 这里改用与 KONG 详情页 / 腾讯云一致的「页头 + 标签页」范式
 * 注 2：页头由布局统一提供，子页面不要再写 `page-header`，否则会出现两条页头
 */
@Component({
  selector: 'user-layout',
  templateUrl: './layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class UserLayoutComponent {
  private readonly router = inject(Router);

  /** 一级标签页 */
  readonly tabs = USER_TABS;

  /**
   * 导航结束标记
   *
   * 注：只为了让下面的 `index` 在每次导航后重算 —— `router.url` 不参与变更检测
   */
  private readonly navigated = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    ),
    { initialValue: null },
  );

  /** 当前高亮的标签页 */
  readonly index = computed(() => {
    // 读一下导航标记，建立依赖
    this.navigated();
    return tabIndexOf(this.router.url);
  });

  /**
   * 切换标签页
   *
   * @param index 目标下标
   */
  go(index: number): void {
    /** 目标标签 */
    const tab = this.tabs[index];
    // 注：`nzSelectedIndex` 回写时也会触发本方法，落在当前页就直接返回
    if (!tab || index === this.index()) {
      return;
    }
    void this.router.navigate(['/user', tab.path]);
  }
}
