import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import type { SFSchema, SFUISchema } from '@delon/form';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';

import { businessError } from '../../tencent.format';
import { TencentService } from '../../tencent.service';

/** 备注弹窗入参 */
export interface SslAliasData {
  /** 密钥ID */
  keyId: number;
  /** 证书ID */
  certificateId: string;
  /** 现有备注 */
  alias: string;
}

/** 证书备注组件 */
@Component({
  selector: 'tencent-ssl-alias',
  templateUrl: './alias.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class TencentSslAliasComponent implements OnInit {
  private readonly tencentSrv = inject(TencentService);
  private readonly modalRef = inject(NzModalRef);
  private readonly msgSrv = inject(NzMessageService);
  /** 弹窗入参 */
  private readonly data = inject<SslAliasData>(NZ_MODAL_DATA);

  /** 表单数据，注：允许空串 —— 清空备注是合法操作 */
  readonly formData = signal<Record<string, unknown> | null>(null);

  /** 表单 schema */
  readonly schema: SFSchema = {
    properties: {
      Alias: { type: 'string', title: '备注名称', maxLength: 100 },
    },
    required: [],
  };

  /** 表单样式 */
  readonly ui: SFUISchema = {
    '*': { spanLabelFixed: 100, grid: { span: 24 } },
    $Alias: { placeholder: '最多 100 个字符，留空表示清除备注' },
  };

  /** 页面初始化 */
  ngOnInit(): void {
    this.formData.set({ Alias: this.data.alias });
  }

  /**
   * 保存备注
   *
   * @param value 表单值
   */
  save(value: Record<string, unknown>): void {
    /** 备注内容 */
    const alias = String(value['Alias'] ?? '').trim();
    this.tencentSrv.sslAlias(this.data.keyId, this.data.certificateId, alias).subscribe({
      next: (res) => {
        /** 业务错误 */
        const message = businessError(res);
        if (message) {
          this.msgSrv.error(message);
          return;
        }
        this.msgSrv.success('备注修改成功');
        this.modalRef.close(true);
      },
      error: (err: unknown) =>
        this.msgSrv.error(apiErrorMessage(err, '备注修改失败，请稍后重试！')),
    });
  }

  /** 关闭弹窗 */
  close(): void {
    this.modalRef.close(false);
  }
}
