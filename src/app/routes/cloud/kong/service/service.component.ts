import { ChangeDetectionStrategy, Component, type Type } from '@angular/core';
import type { STColumn } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';

import { KongObjectComponent } from '../object/object.component';
import { KongServiceEditComponent } from './edit/service-edit.component';

/** KONG 服务管理组件 */
@Component({
  selector: 'kong-service',
  templateUrl: '../object/object.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class KongServiceComponent extends KongObjectComponent {
  override readonly type = 'services' as const;
  override readonly name = '服务';

  /** 业务列 */
  protected override businessColumns(): STColumn[] {
    return [
      { title: '名称', index: 'name' },
      { title: '协议', index: 'protocol' },
      { title: '地址', index: 'host' },
      { title: '端口', index: 'port' },
      { title: '路径', index: 'path' },
    ];
  }

  /** 编辑弹窗组件 */
  protected override editComponent(): Type<unknown> {
    return KongServiceEditComponent;
  }
}
