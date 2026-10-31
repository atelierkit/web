import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { SFSchema, SFUISchema } from '@delon/form';
import { SHARED_IMPORTS } from '@shared';

import { KongObjectEditComponent } from '../../object/edit/object-edit.component';

/** KONG 上游编辑弹窗 */
@Component({
  selector: 'kong-upstream-edit',
  templateUrl: '../../object/edit/object-edit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class KongUpstreamEditComponent extends KongObjectEditComponent {
  override readonly name = '上游';

  /** 表单 schema */
  override readonly schema: SFSchema = {
    properties: {
      name: { type: 'string', title: '名称', maxLength: 200 },
      algorithm: {
        type: 'string',
        title: '负载均衡算法',
        default: 'round-robin',
        enum: [
          { label: '轮询', value: 'round-robin' },
          { label: '一致性哈希', value: 'consistent-hashing' },
          { label: '最少连接', value: 'least-connections' },
          { label: '延迟优先', value: 'latency' },
          { label: '会话保持', value: 'sticky-sessions' },
        ],
      },
    },
    required: ['name', 'algorithm'],
  };

  /** 表单样式 */
  override readonly ui: SFUISchema = {
    '*': { spanLabelFixed: 120, spanLabel: 6, spanControl: 18, grid: { span: 24 } },
    $algorithm: { widget: 'select' },
  };

  /**
   * 表单值 → 提交数据
   *
   * @param value 表单值
   * @returns 提交给 Kong 的上游数据
   */
  protected override payload(value: Record<string, unknown>): Record<string, unknown> {
    return this.compact({
      name: value['name'],
      algorithm: value['algorithm'],
    });
  }
}
