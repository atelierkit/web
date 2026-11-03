import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { STColumn, STColumnButton } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';

import { isoTextOf } from '../kubernetes.format';
import { KubernetesObjectComponent } from '../object/object.component';
import type { KubernetesBatchAction, KubernetesObject } from '../object/object.types';

/**
 * Deployment 管理组件
 *
 * 注 1：`ready` 是「就绪/期望」，只看期望副本数会漏掉「滚动更新卡住」这种典型故障
 * 注 2：重启走 `kubectl rollout restart` 的同一套注解（`kubectl.kubernetes.io/restartedAt`），
 * 因此与本模块之外的操作互不冲突
 */
@Component({
  selector: 'kubernetes-deployment',
  templateUrl: '../object/object.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class KubernetesDeploymentComponent extends KubernetesObjectComponent {
  override readonly type = 'deployments' as const;
  override readonly name = 'Deployment';

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
        pop: '重启会逐个替换 Pod（滚动更新，期间服务不中断）。确认重启？',
        click: (item) => this.run([item as KubernetesObject], 'restart'),
      },
      {
        text: '删除',
        type: 'link',
        pop: '删除 Deployment 会连带删除它管理的全部 Pod，且不可恢复。确认删除？',
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
        confirm: '确认对已选中的 Deployment 逐个滚动重启？',
      },
      {
        action: 'remove',
        text: '批量删除',
        confirm: '删除后不会进入回收站，且不可恢复。确认删除已选中的 Deployment？',
        danger: true,
      },
    ];
  }
}
