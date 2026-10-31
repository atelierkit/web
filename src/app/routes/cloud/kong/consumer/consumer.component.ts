import { ChangeDetectionStrategy, Component, type Type } from '@angular/core';
import type { STColumn } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';

import { KongObjectComponent } from '../object/object.component';
import { KongConsumerEditComponent } from './edit/consumer-edit.component';

/** KONG 消费者（用户）管理组件 */
@Component({
  selector: 'kong-consumer',
  templateUrl: '../object/object.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class KongConsumerComponent extends KongObjectComponent {
  override readonly type = 'consumers' as const;
  override readonly name = '用户';

  /** 业务列 */
  protected override businessColumns(): STColumn[] {
    return [
      { title: '系统ID', index: 'id' },
      { title: '自定义ID', index: 'custom_id' },
      { title: '用户名', index: 'username' },
      {
        title: '标签',
        type: 'widget',
        widget: { type: 'array', params: ({ record }) => ({ value: record['tags'] }) },
      },
    ];
  }

  /** 编辑弹窗组件 */
  protected override editComponent(): Type<unknown> {
    return KongConsumerEditComponent;
  }
}
