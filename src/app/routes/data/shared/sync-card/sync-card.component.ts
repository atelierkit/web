import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SHARED_IMPORTS } from '@shared';

import {
  countText,
  DATA_STATE,
  percentOf,
  stateTag,
  stateText,
  timeTextOf,
  type DataCard,
  type DataTarget,
} from '../../data.format';

/**
 * 四张同步状态卡片的唯一实现（仪表板与同步页共用）
 *
 * ⚠ `showActions` 是必填输入（`input.required`）：漏传直接编译报错，而不是让卡片静默失去按钮。
 * 仪表板传 `false`（连按钮都不渲染）、同步页传 `true` —— almanac 桌面端的同一条架构约束。
 */
@Component({
  selector: 'data-sync-card',
  templateUrl: './sync-card.component.html',
  styleUrls: ['./sync-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class DataSyncCardComponent {
  /** 是否渲染操作按钮（同步页 true、仪表板 false） */
  readonly showActions = input.required<boolean>();
  /** 卡片数据 */
  readonly card = input.required<DataCard>();
  /** 点击「同步/继续」 */
  readonly start = output<DataTarget>();
  /** 点击「暂停」 */
  readonly pause = output<DataTarget>();

  /** 数字缩写 */
  readonly countText = countText;
  /** 状态文案 */
  readonly stateText = stateText;
  /** 状态徽标 */
  readonly stateTag = stateTag;
  /** 更新时刻文案（不依赖 DatePipe：模板里没有 CommonModule 的管道） */
  readonly timeText = timeTextOf;

  /** 是否显示进度条（只有执行中且有总量才有意义） */
  get showProgress(): boolean {
    const card = this.card();
    return card.state === DATA_STATE.RUNNING && (card.total ?? 0) > 0;
  }

  /** 进度百分比 */
  get percent(): number {
    return percentOf(this.card().done ?? 0, this.card().total ?? 0);
  }

  /** 进度文字（`50%（5 / 10）`，总量未知时只显示百分比） */
  readonly progressFormat = (percent: number): string => {
    const card = this.card();
    const total = card.total ?? 0;
    return total > 0 ? `${percent}%（${card.done ?? 0} / ${total}）` : `${percent}%`;
  };

  /** 是否可暂停（按交易日两类 + 确实有活跃执行；否则点了也不会有任何效果） */
  get canPause(): boolean {
    const card = this.card();
    const byTradeDate = card.target === 'BarByDate' || card.target === 'AdjustFactor';
    return byTradeDate && (card.state === DATA_STATE.RUNNING || card.state === DATA_STATE.QUEUED);
  }

  /** 按钮文案：同步（从未同步）/ 继续（有历史） */
  get actionText(): string {
    return this.card().lastDate === null ? '同步' : '继续';
  }
}
