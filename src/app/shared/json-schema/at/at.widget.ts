import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { ControlWidget, DelonFormModule } from '@delon/form';

import { formatDateTime, TimeUnit } from '../../utils/date';

/**
 * 时间展示小部件（只读）
 *
 * 注 1：把时间戳渲染成纯文本，不生成输入框；字段值仍是后端原样的数字，格式化只发生在渲染层
 * 注 2：单位由 schema 上的 `timestamp` 决定（`'ms'` 缺省 / `'s'`），避免「秒被当毫秒」显示成 1970
 * 注 3：所有时间字段都该用它 —— 页面里只写 `ui: { $createAt: { widget: 'at' } }`，不必每个页面自己格式化
 */
@Component({
  selector: 'sf-widget-at',
  template: `
    <sf-item-wrap
      [id]="id"
      [schema]="schema"
      [ui]="ui"
      [showError]="showError"
      [error]="error"
      [showTitle]="schema.title"
    >
      {{ at() }}
    </sf-item-wrap>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DelonFormModule],
})
export class AtWidget extends ControlWidget implements OnInit {
  /** 小部件 key，schema 里通过 `ui: { $字段: { widget: 'at' } }` 指定 */
  static readonly KEY = 'at';

  /** 展示文本，注：无值时显示 `-`，与内置 text 小部件保持一致 */
  readonly at = signal('-');

  /** 初始化 */
  ngOnInit(): void {
    // 注：纯展示字段不参与必填校验（内置 TextWidget 也是这么处理的）
    this.ui['_required'] = false;
  }

  /**
   * 渲染值
   *
   * 注：框架在值变化与初始化时都会调用本方法
   *
   * @param value 时间戳
   */
  override reset(value: number | null | undefined): void {
    /** 时间戳单位，缺省按毫秒 */
    const unit = this.schema?.['timestamp'] as TimeUnit | undefined;
    this.at.set(formatDateTime(value, unit ?? 'ms') || '-');
  }
}
