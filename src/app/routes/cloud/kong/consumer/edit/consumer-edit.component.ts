import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { SFSchema, SFUISchema } from '@delon/form';
import { SHARED_IMPORTS } from '@shared';

import { KongObjectEditComponent } from '../../object/edit/object-edit.component';

/** KONG 消费者（用户）编辑弹窗 */
@Component({
  selector: 'kong-consumer-edit',
  templateUrl: '../../object/edit/object-edit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class KongConsumerEditComponent extends KongObjectEditComponent {
  override readonly name = '用户';

  /** 表单 schema */
  override readonly schema: SFSchema = {
    properties: {
      custom_id: { type: 'string', title: '自定义ID', maxLength: 200 },
      username: { type: 'string', title: '用户名', maxLength: 200 },
    },
    // 注：Kong 要求 `custom_id` 与 `username` 至少给一个，这里把两者都设成必填更不容易踩坑
    required: ['custom_id', 'username'],
  };

  /** 表单样式 */
  override readonly ui: SFUISchema = {
    '*': { spanLabelFixed: 100, spanLabel: 6, spanControl: 18, grid: { span: 24 } },
  };

  /**
   * 表单值 → 提交数据
   *
   * @param value 表单值
   * @returns 提交给 Kong 的消费者数据
   */
  protected override payload(value: Record<string, unknown>): Record<string, unknown> {
    return this.compact({
      custom_id: value['custom_id'],
      username: value['username'],
    });
  }
}
