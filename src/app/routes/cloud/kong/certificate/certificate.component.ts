import { ChangeDetectionStrategy, Component, type Type } from '@angular/core';
import type { STColumn } from '@delon/abc/st';
import { formatDateTime, SHARED_IMPORTS } from '@shared';

import { KongObjectComponent } from '../object/object.component';
import { KongCertificateEditComponent } from './edit/certificate-edit.component';

/**
 * KONG 证书管理组件
 *
 * 注：域名与有效期不是 Kong 的证书字段（分别存在 `/certificates/{id}/snis` 与 PEM 里），
 * 后端解析 PEM 后以 `snis` / `start` / `end` 补在对象上，这里直接取用
 */
@Component({
  selector: 'kong-certificate',
  templateUrl: '../object/object.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class KongCertificateComponent extends KongObjectComponent {
  override readonly type = 'certificates' as const;
  override readonly name = '证书';

  /** 业务列 */
  protected override businessColumns(): STColumn[] {
    /** 时间列，注：Kong 的时间字段是秒级时间戳 */
    const time = (title: string, index: string): STColumn => ({
      title,
      index,
      format: (item) => formatDateTime(item[index] as number, 's'),
    });
    return [
      {
        title: '域名',
        type: 'widget',
        widget: { type: 'array', params: ({ record }) => ({ value: record['snis'] }) },
      },
      time('生效时间', 'start'),
      time('过期时间', 'end'),
    ];
  }

  /** 编辑弹窗组件 */
  protected override editComponent(): Type<unknown> {
    return KongCertificateEditComponent;
  }
}
