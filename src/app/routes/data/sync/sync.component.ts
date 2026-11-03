import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import type { STColumn } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';

import { stateText, type DataTarget } from '../data.format';
import type { RecentRun } from '../data.service';
import { DataStore } from '../data.store';
import { DataSyncCardComponent } from '../shared/sync-card/sync-card.component';
import { DataSyncProgressComponent } from '../shared/sync-progress/sync-progress.component';

/**
 * 数据同步页（`/data/sync`）
 *
 * 四卡（可操作）+ 同步进度 + 执行日志；与仪表板共用同一个 `data.store`、同一个 `sync-card`
 * 与同一个进度区（`data-sync-progress`）—— 进度条在两页里都不放在卡片内。
 */
@Component({
  selector: 'data-sync',
  templateUrl: './sync.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS, DataSyncCardComponent, DataSyncProgressComponent],
})
export class DataSyncComponent implements OnInit {
  readonly store = inject(DataStore);

  /** 执行日志列定义 */
  readonly columns: STColumn[] = [
    { title: '执行号', index: 'id', width: 90 },
    { title: '目标', index: 'target', width: 140, format: (item: RecentRun) => item.target },
    {
      title: '状态',
      index: 'state',
      width: 90,
      format: (item: RecentRun) => stateText(item.state),
    },
    { title: '阶段', index: 'stage' },
    {
      title: '进度',
      index: 'done',
      width: 120,
      format: (item: RecentRun) =>
        item.total > 0 ? `${item.done} / ${item.total}` : `${item.done}`,
    },
  ];

  /** 页面初始化 */
  ngOnInit(): void {
    this.store.connect();
  }

  /** 发起同步 */
  start(target: DataTarget): void {
    this.store.start(target);
  }

  /** 暂停 */
  pause(target: DataTarget): void {
    this.store.pause(target);
  }
}
