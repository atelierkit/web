import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { SHARED_IMPORTS } from '@shared';

import { DataStore } from '../data.store';
import { DataSyncCardComponent } from '../shared/sync-card/sync-card.component';

/**
 * 行情仪表板（`/data/dashboard`）
 *
 * 页面本体就三块：标题 + 帮助、四张只读卡、一条状态行。
 * 与桌面端三条约束一一对应：两页共用 `data.store`、共用 `sync-card`（`showActions=false`）、
 * 只显示错误文案不显示动作文案。
 *
 * ⚠ 失败态必须给重试按钮 —— 桌面端靠启动流程广播自动重读，web 没有那个广播，
 * 不给重试页面会永远停在错误态。
 */
@Component({
  selector: 'data-dashboard',
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS, DataSyncCardComponent],
})
export class DataDashboardComponent implements OnInit {
  readonly store = inject(DataStore);

  /** 帮助文案（日线卡与日历卡「已同步至」不相等是正常的） */
  readonly helpText =
    '四张卡显示行情数据的同步状态。日线卡与日历卡的「已同步至」不相等是正常的：' +
    '当日数据尚未发布，或数据源正处在收盘后的停服窗口。要发起或暂停同步，请到「数据同步」页。';

  /** 页面初始化 */
  ngOnInit(): void {
    this.store.connect();
  }

  /** 重试 */
  retry(): void {
    this.store.refresh(true);
  }
}
