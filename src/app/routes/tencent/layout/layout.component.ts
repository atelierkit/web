import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { apiErrorMessage } from '@core';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { filter } from 'rxjs';

import { TENCENT_TABS, tabIndexOf } from '../tencent.format';
import { TencentService } from '../tencent.service';

/**
 * 腾讯云布局组件
 *
 * 注 1：旧私有项目用 `@brand` 的 `service-layout`（侧边二级导航 + 地域子菜单），
 * 开源仓库里没有 `@brand`，这里改用与 KONG 详情页一致的「页头 + 标签页」范式
 * 注 2：地域不再进导航 —— 轻量服务器页内自带地域下拉，地址仍然是 `lighthouse/:region`
 */
@Component({
  selector: 'tencent-layout',
  templateUrl: './layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class TencentLayoutComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tencentSrv = inject(TencentService);
  private readonly msgSrv = inject(NzMessageService);

  /** 密钥ID（页面路由里的 `:id`） */
  readonly keyId = Number(this.route.snapshot.params['id']);
  /** 标题（密钥名称） */
  readonly title = signal('腾讯云');
  /** 副标题（密钥说明） */
  readonly subtitle = signal('');
  /** 一级标签页 */
  readonly tabs = TENCENT_TABS;

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

  /** 页面初始化 */
  ngOnInit(): void {
    this.tencentSrv.keyInfo(this.keyId).subscribe({
      next: (key) => {
        this.title.set(key.name);
        this.subtitle.set(key.description);
      },
      error: (err: unknown) =>
        this.msgSrv.error(apiErrorMessage(err, '加载密钥信息失败，请稍后重试！')),
    });
  }

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
    void this.router.navigate(['/tencent', this.keyId, tab.path]);
  }
}
