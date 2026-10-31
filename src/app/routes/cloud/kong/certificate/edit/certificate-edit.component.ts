import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { SFSchema, SFUISchema } from '@delon/form';
import { SHARED_IMPORTS } from '@shared';

import { KongObjectEditComponent } from '../../object/edit/object-edit.component';

/** KONG 证书编辑弹窗 */
@Component({
  selector: 'kong-certificate-edit',
  templateUrl: '../../object/edit/object-edit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class KongCertificateEditComponent extends KongObjectEditComponent {
  override readonly name = '证书';

  /** 表单 schema */
  override readonly schema: SFSchema = {
    properties: {
      snis: { type: 'string', title: '域名' },
      key: { type: 'string', title: '私钥' },
      cert: { type: 'string', title: '证书' },
      // 注：生效 / 过期时间由后端从 PEM 解析，只读展示，仅编辑态出现
      ...(this.isEdit
        ? {
            start: { type: 'number', title: '生效时间', timestamp: 's' },
            end: { type: 'number', title: '过期时间', timestamp: 's' },
          }
        : {}),
    },
    required: ['snis', 'key', 'cert'],
  };

  /** 表单样式 */
  override readonly ui: SFUISchema = {
    '*': { spanLabelFixed: 100, spanLabel: 6, spanControl: 18, grid: { span: 24 } },
    $snis: { widget: 'tags' },
    $key: { widget: 'textarea', autosize: { minRows: 6, maxRows: 12 } },
    $cert: { widget: 'textarea', autosize: { minRows: 6, maxRows: 12 } },
    $start: { widget: 'at' },
    $end: { widget: 'at' },
  };

  /**
   * 表单值 → 提交数据
   *
   * 注 1：`start` / `end` 是从 PEM 推导出来的展示字段，不提交（Kong 也不认）
   * 注 2：`snis` 是 Kong 证书的外键字段（`/certificates` 的响应里同样带它），随证书一起提交
   *
   * @param value 表单值
   * @returns 提交给 Kong 的证书数据
   */
  protected override payload(value: Record<string, unknown>): Record<string, unknown> {
    return this.compact({
      cert: value['cert'],
      key: value['key'],
      snis: value['snis'] ?? [],
    });
  }
}
