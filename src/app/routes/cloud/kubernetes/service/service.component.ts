import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { STColumn, STColumnButton } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';

import { isoTextOf } from '../kubernetes.format';
import { KubernetesObjectComponent } from '../object/object.component';
import type { KubernetesBatchAction, KubernetesObject } from '../object/object.types';

/**
 * Service 管理组件
 *
 * 注 1：端口列显示「服务端口/协议」，NodePort 用箭头标出节点端口（`80/TCP→30080`）
 * 注 2：只提供删除 —— 改端口 / 改类型 / 改选择器本质上是「重建」，需要结构化表单，
 * 与「不做 YAML 编辑」的边界一致，放 P1
 */
@Component({
  selector: 'kubernetes-service',
  templateUrl: '../object/object.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class KubernetesServiceComponent extends KubernetesObjectComponent {
  override readonly type = 'services' as const;
  override readonly name = 'Service';

  /** 业务列 */
  protected override businessColumns(): STColumn[] {
    return [
      { title: '名称', index: 'name' },
      { title: '命名空间', index: 'namespace', width: 150 },
      { title: '类型', index: 'type', width: 130 },
      { title: 'ClusterIP', index: 'clusterIP', width: 140 },
      { title: '端口', index: 'ports', width: 180 },
      { title: '选择器', index: 'selector' },
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
        pop: '删除后该 Service 的访问入口立即失效（Pod 本身不受影响）。确认删除？',
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
        confirm: '删除后访问入口立即失效，且不可恢复。确认删除已选中的 Service？',
        danger: true,
      },
    ];
  }
}
