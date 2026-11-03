import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { STColumn, STColumnButton, STColumnTag } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';

import { STATUS_TAG, isoTextOf } from '../kubernetes.format';
import { KubernetesObjectComponent } from '../object/object.component';
import type { KubernetesBatchAction, KubernetesObject } from '../object/object.types';

/**
 * Pod 管理组件
 *
 * 注 1：默认停在「全部命名空间」—— 排查故障时最先要知道的是「哪个命名空间在崩」，
 * 而不是先选命名空间再看
 * 注 2：删除 Pod 后控制器（Deployment / StatefulSet）会自动重建，这正是「重启」的常用手法；
 * 直接由 kubelet 之外的控制器管的裸 Pod 删掉就没了，故二次确认要说明
 */
@Component({
  selector: 'kubernetes-pod',
  templateUrl: '../object/object.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class KubernetesPodComponent extends KubernetesObjectComponent {
  override readonly type = 'pods' as const;
  override readonly name = 'Pod';

  /** 业务列 */
  protected override businessColumns(): STColumn[] {
    return [
      { title: '名称', index: 'name' },
      { title: '命名空间', index: 'namespace', width: 150 },
      { title: '就绪', index: 'ready', width: 90 },
      {
        title: '状态',
        index: 'status',
        width: 150,
        type: 'tag',
        tag: STATUS_TAG as STColumnTag,
      },
      { title: '重启', index: 'restarts', width: 80 },
      { title: '节点', index: 'node', width: 160 },
      { title: '镜像', index: 'images' },
      { title: 'Pod IP', index: 'ip', width: 130 },
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
        pop: '删除后由控制器自动重建（裸 Pod 则不会），正在处理的请求会中断。确认删除？',
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
        confirm: '删除后不可恢复（控制器会重建新的 Pod）。确认删除已选中的 Pod？',
        danger: true,
      },
    ];
  }
}
