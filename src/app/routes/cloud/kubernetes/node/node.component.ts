import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { STColumn, STColumnButton, STColumnTag } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';

import { STATUS_TAG, bytesText, cpuText, isoTextOf, rolesText } from '../kubernetes.format';
import { KubernetesObjectComponent } from '../object/object.component';
import type { KubernetesObject } from '../object/object.types';

/**
 * 节点管理组件
 *
 * 注 1：节点是集群级资源，没有命名空间；列表来自 `GET /api/v1/nodes`
 * 注 2：`cordon` / `uncordon` 按状态切换显示 —— 已经禁止调度的节点不该再出现「封锁」按钮，
 * 反之亦然（两个按钮同时摆出来只会让人点错）
 * 注 3：**不提供 `drain`** —— 驱逐节点上的 Pod 涉及 DaemonSet 与本地存储的判断，
 * 误操作的代价太高，需要时用 kubectl
 */
@Component({
  selector: 'kubernetes-node',
  templateUrl: '../object/object.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class KubernetesNodeComponent extends KubernetesObjectComponent {
  override readonly type = 'nodes' as const;
  override readonly name = '节点';
  override readonly namespaced = false;

  /** 业务列 */
  protected override businessColumns(): STColumn[] {
    return [
      { title: '名称', index: 'name' },
      {
        title: '状态',
        index: 'status',
        width: 150,
        type: 'tag',
        tag: STATUS_TAG as STColumnTag,
      },
      {
        title: '角色',
        index: 'roles',
        width: 160,
        format: (item) => rolesText(String(item['roles'] ?? '')),
      },
      { title: 'kubelet', index: 'version', width: 120 },
      {
        title: 'CPU',
        index: 'cpu',
        width: 90,
        format: (item) => cpuText(Number(item['cpu'])),
      },
      {
        title: '内存',
        index: 'memory',
        width: 110,
        format: (item) => bytesText(Number(item['memory'])),
      },
      { title: 'Pod 上限', index: 'pods', width: 100 },
      { title: '内网地址', index: 'ip', width: 140 },
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
        text: '封锁',
        type: 'link',
        iif: (item) => String(item['status'] ?? '') !== 'SchedulingDisabled',
        pop: '封锁后不会再往该节点调度新 Pod（已有 Pod 不受影响）。确认封锁？',
        click: (item) => this.run([item as KubernetesObject], 'cordon'),
      },
      {
        text: '解封',
        type: 'link',
        iif: (item) => String(item['status'] ?? '') === 'SchedulingDisabled',
        click: (item) => this.run([item as KubernetesObject], 'uncordon'),
      },
    ];
  }
}
