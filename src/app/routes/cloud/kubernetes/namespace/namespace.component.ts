import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { STColumn, STColumnButton, STColumnTag } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';

import { STATUS_TAG, isoTextOf } from '../kubernetes.format';
import { KubernetesObjectComponent } from '../object/object.component';
import type { KubernetesBatchAction, KubernetesObject } from '../object/object.types';

/**
 * 命名空间管理组件
 *
 * 注：命名空间是集群级资源，故不显示命名空间下拉；删除命名空间会连带删掉它下面的**全部**资源
 * （Pod / Service / ConfigMap / PVC …），是本模块最危险的动作之一，二次确认文案必须说清
 */
@Component({
  selector: 'kubernetes-namespace',
  templateUrl: '../object/object.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class KubernetesNamespaceComponent extends KubernetesObjectComponent {
  override readonly type = 'namespaces' as const;
  override readonly name = '命名空间';
  override readonly namespaced = false;

  /** 业务列 */
  protected override businessColumns(): STColumn[] {
    return [
      { title: '名称', index: 'name' },
      {
        title: '阶段',
        index: 'phase',
        width: 120,
        type: 'tag',
        tag: STATUS_TAG as STColumnTag,
      },
      {
        title: '创建时间',
        index: 'created',
        width: 170,
        format: (item) => isoTextOf(String(item['created'] ?? '')),
      },
    ];
  }

  /** 单行操作 */
  protected override actions(): STColumnButton[] {
    return [
      {
        text: '删除',
        type: 'link',
        pop: '删除命名空间会连带删除它下面的全部资源（Pod / Service / PVC 等），且不可恢复。确认删除？',
        click: (item) => this.run([item as KubernetesObject], 'remove'),
      },
    ];
  }

  /** 批量动作 */
  override batchActions(): KubernetesBatchAction[] {
    return [
      {
        action: 'remove',
        text: '批量删除',
        confirm: '删除命名空间会连带删除其下全部资源，且不可恢复。确认删除已选中的命名空间？',
        danger: true,
      },
    ];
  }
}
