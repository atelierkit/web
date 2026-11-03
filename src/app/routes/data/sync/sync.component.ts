import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import type { STColumn } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';

import {
  percentOf,
  progressTextOf,
  runningCardOf,
  stateText,
  type DataTarget,
} from '../data.format';
import type { RecentRun } from '../data.service';
import { DataStore } from '../data.store';
import { DataSyncCardComponent } from '../shared/sync-card/sync-card.component';

/**
 * 数据同步页（`/data/sync`）
 *
 * 四卡（可操作）+ 同步进度 + 队列统计 + 执行日志；与仪表板共用同一个 `data.store` 与 `sync-card`
 * （这里 `showActions=true`，且 `inlineProgress=false` —— 进度条统一放在卡片下方的「同步进度」里）。
 */
@Component({
  selector: 'data-sync',
  templateUrl: './sync.component.html',
  styleUrls: ['./sync.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS, DataSyncCardComponent],
})
export class DataSyncComponent implements OnInit {
  readonly store = inject(DataStore);

  /**
   * 正在执行的那一个任务（没有则为 null）
   *
   * ⚠ 只取一条：同一时刻真正在增加进度的通常只有一个目标，四个百分比并列反而要读者自己找。
   * 多消费者并发时按四卡顺序取第一个，其余的数量由标题右侧的「共 N 个执行中」补足。
   */
  readonly progressCard = computed(() => runningCardOf(this.store.cards()));

  /** 进度百分比（模板用：进度条与进度文字同源，不各自算一份） */
  readonly percentOf = percentOf;
  /** 进度文字（`50%（5 / 10）`） */
  readonly progressText = progressTextOf;

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
