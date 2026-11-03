import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SHARED_IMPORTS } from '@shared';

import {
  percentOf,
  progressTextOf,
  runningCardOf,
  type DataCard,
  type DataQueue,
} from '../../data.format';

/**
 * 「同步进度」区（仪表板与同步页共用）
 *
 * 四卡并排时卡宽只有 1/4 屏，进度条挤在卡里既窄又无法横向对比 —— 两页都把进度条挪到卡片下方，
 * 由本组件统一渲染，卡片里只剩数字类信息（`data-sync-card` 不再自带进度条）。
 *
 * ⚠ 只显示「正在执行」的那一个任务：四项并列时读者要自己找哪条在动，
 * 而同一时刻真正在跑的通常只有一个，其余都是历史残留百分比，反而误导。
 * 并发多条时数量差异由标题右侧的「共 N 个执行中」补足，而不是多画几条进度条。
 *
 * ⚠ 空状态必须分两档：只判「无执行中」的话，刚点完同步（任务已入队、尚未开始）会显示
 * 「当前无任务执行」，与用户刚做的操作自相矛盾。
 */
@Component({
  selector: 'data-sync-progress',
  templateUrl: './sync-progress.component.html',
  styleUrls: ['./sync-progress.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class DataSyncProgressComponent {
  /** 四卡（与 `data-sync-card` 同源，来自同一个 `data.store`） */
  readonly cards = input.required<readonly DataCard[]>();
  /** 队列计数（排队 / 执行中的执行数） */
  readonly queue = input.required<DataQueue>();

  /** 正在执行的那一个任务（没有则为 null） */
  readonly progressCard = computed(() => runningCardOf(this.cards()));

  /** 进度百分比（模板用：进度条与进度文字同源，不各自算一份） */
  readonly percentOf = percentOf;
  /** 进度文字（`50%（5 / 10）`） */
  readonly progressText = progressTextOf;
}
