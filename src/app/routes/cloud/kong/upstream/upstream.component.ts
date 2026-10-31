import { ChangeDetectionStrategy, Component, type Type } from '@angular/core';
import type { STColumn } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';

import { KongObjectComponent } from '../object/object.component';
import { KongUpstreamEditComponent } from './edit/upstream-edit.component';

/** KONG 上游管理组件 */
@Component({
  selector: 'kong-upstream',
  templateUrl: '../object/object.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class KongUpstreamComponent extends KongObjectComponent {
  override readonly type = 'upstreams' as const;
  override readonly name = '上游';

  /** 业务列 */
  protected override businessColumns(): STColumn[] {
    return [
      { title: '名称', index: 'name' },
      { title: '负载均衡算法', index: 'algorithm' },
      { title: '主机头', index: 'host_header' },
    ];
  }

  /** 编辑弹窗组件 */
  protected override editComponent(): Type<unknown> {
    return KongUpstreamEditComponent;
  }
}
