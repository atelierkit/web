import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SHARED_IMPORTS } from '@shared';

import { countText, stateTag, stateText, type DataCard, type DataTarget } from '../../data.format';

/**
 * 四张同步状态卡片的唯一实现（仪表板与同步页共用）
 *
 * ⚠ `showActions` 是必填输入（`input.required`）：漏传直接编译报错，而不是让卡片静默失去按钮。
 * 仪表板传 `false`（连按钮都不渲染）、同步页传 `true` —— almanac 桌面端的同一条架构约束。
 */
@Component({
  selector: 'data-sync-card',
  templateUrl: './sync-card.component.html',
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

  /** 是否可暂停（只有按交易日两类可能 Running） */
  get canPause(): boolean {
    const t = this.card().target;
    return t === 'BarByDate' || t === 'AdjustFactor';
  }

  /** 按钮文案：同步（从未同步）/ 继续（有历史） */
  get actionText(): string {
    return this.card().lastDate === null ? '同步' : '继续';
  }
}
