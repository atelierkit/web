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

import { ALIYUN_TABS, tabIndexOf } from '../aliyun.format';
import { AliyunService } from '../aliyun.service';

/**
 * 阿里云布局组件
 *
 * 注：与腾讯云一致的「页头 + 标签页」范式（本仓库没有侧边二级导航组件）
 */
@Component({
  selector: 'aliyun-layout',
  templateUrl: './layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class AliyunLayoutComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly aliyunSrv = inject(AliyunService);
  private readonly msgSrv = inject(NzMessageService);

  /** 密钥ID（页面路由里的 `:id`） */
  readonly keyId = Number(this.route.snapshot.params['id']);
  /** 标题（密钥名称） */
  readonly title = signal('阿里云');
  /** 副标题（密钥说明） */
  readonly subtitle = signal('');
  /** 一级标签页 */
  readonly tabs = ALIYUN_TABS;

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
    this.aliyunSrv.keyInfo(this.keyId).subscribe({
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
    void this.router.navigate(['/aliyun', this.keyId, tab.path]);
  }
}
