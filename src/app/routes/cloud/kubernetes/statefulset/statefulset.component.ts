import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { STColumn, STColumnButton } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';

import { isoTextOf } from '../kubernetes.format';
import { KubernetesObjectComponent } from '../object/object.component';
import type { KubernetesBatchAction, KubernetesObject } from '../object/object.types';

/**
 * StatefulSet 管理组件
 *
 * 注 1：与 Deployment 的差异主要在语义 —— StatefulSet 的 Pod 有稳定标识与存储，
 * 重启是**逆序逐个**替换而不是一次性滚动，所以文案里不要写「并行」
 * 注 2：缩到 0 也是合法操作（临时下线），弹窗里有说明
 */
@Component({
  selector: 'kubernetes-statefulset',
  templateUrl: '../object/object.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class KubernetesStatefulSetComponent extends KubernetesObjectComponent {
  override readonly type = 'statefulsets' as const;
  override readonly name = 'StatefulSet';

  /** 业务列 */
  protected override businessColumns(): STColumn[] {
    return [
      { title: '名称', index: 'name' },
      { title: '命名空间', index: 'namespace', width: 150 },
      { title: '就绪', index: 'ready', width: 90 },
      { title: '期望副本', index: 'replicas', width: 100 },
      { title: '已更新', index: 'updated', width: 90 },
      { title: '可用', index: 'available', width: 90 },
      { title: '镜像', index: 'images' },
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
        text: '扩缩容',
        type: 'link',
        click: (item) => this.openScale(item as KubernetesObject),
      },
      {
        text: '重启',
        type: 'link',
        pop: '重启会逆序逐个替换 Pod（有状态服务可能短暂不可用）。确认重启？',
        click: (item) => this.run([item as KubernetesObject], 'restart'),
      },
      {
        text: '删除',
        type: 'link',
        pop: '删除 StatefulSet 不会自动删除 PVC，但会删掉全部 Pod，且不可恢复。确认删除？',
        click: (item) => this.run([item as KubernetesObject], 'remove'),
      },
    ];
  }

  /** 批量动作 */
  override batchActions(): KubernetesBatchAction[] {
    return [
      {
        action: 'restart',
        text: '批量重启',
        confirm: '确认对已选中的 StatefulSet 逐个逆序重启？',
      },
      {
        action: 'remove',
        text: '批量删除',
        confirm: '删除后不会进入回收站，且不可恢复。确认删除已选中的 StatefulSet？',
        danger: true,
      },
    ];
  }
}
