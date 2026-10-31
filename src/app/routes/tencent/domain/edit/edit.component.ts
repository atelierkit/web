import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import type { SFSchema, SFUISchema } from '@delon/form';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';

import { businessError } from '../../tencent.format';
import { TencentService } from '../../tencent.service';

/** 备注弹窗入参 */
export interface DomainEditData {
  /** 密钥ID */
  keyId: number;
  /** 域名 */
  domain: string;
  /** 现有备注 */
  remark: string;
}

/** 域名备注组件 */
@Component({
  selector: 'tencent-domain-edit',
  templateUrl: './edit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class TencentDomainEditComponent implements OnInit {
  private readonly tencentSrv = inject(TencentService);
  private readonly modalRef = inject(NzModalRef);
  private readonly msgSrv = inject(NzMessageService);
  /** 弹窗入参 */
  private readonly data = inject<DomainEditData>(NZ_MODAL_DATA);

  /** 表单数据 */
  readonly formData = signal<Record<string, unknown> | null>(null);

  /** 表单 schema */
  readonly schema: SFSchema = {
    properties: {
      Domain: { type: 'string', title: '域名' },
      Remark: { type: 'string', title: '备注', maxLength: 200 },
    },
    required: [],
  };

  /** 表单样式 */
  readonly ui: SFUISchema = {
    '*': { spanLabelFixed: 100, grid: { span: 24 } },
    $Domain: { widget: 'text' },
    $Remark: { widget: 'textarea', autosize: { minRows: 3, maxRows: 6 } },
  };

  /** 页面初始化 */
  ngOnInit(): void {
    this.formData.set({ Domain: this.data.domain, Remark: this.data.remark });
  }

  /**
   * 保存备注
   *
   * @param value 表单值
   */
  save(value: Record<string, unknown>): void {
    /** 备注内容，注：空串表示删除备注 */
    const remark = String(value['Remark'] ?? '').trim();
    this.tencentSrv.domainRemark(this.data.keyId, this.data.domain, remark).subscribe({
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
