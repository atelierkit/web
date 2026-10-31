import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import type { SFSchema, SFUISchema } from '@delon/form';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';

import { businessError } from '../../tencent.format';
import { TencentService } from '../../tencent.service';

/** 申请弹窗入参 */
export interface SslApplyData {
  /** 密钥ID */
  keyId: number;
}

/** 免费证书申请组件 */
@Component({
  selector: 'tencent-ssl-apply',
  templateUrl: './apply.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class TencentSslApplyComponent implements OnInit {
  private readonly tencentSrv = inject(TencentService);
  private readonly modalRef = inject(NzModalRef);
  private readonly msgSrv = inject(NzMessageService);
  /** 弹窗入参 */
  private readonly data = inject<SslApplyData>(NZ_MODAL_DATA);

  /** 表单数据 */
  readonly formData = signal<Record<string, unknown> | null>(null);

  /** 表单 schema */
  readonly schema: SFSchema = {
    properties: {
      DvAuthMethod: {
        type: 'string',
        title: '验证方式',
        default: 'DNS_AUTO',
        enum: [
          { value: 'DNS', label: '手动 DNS 验证' },
          { value: 'DNS_AUTO', label: '自动 DNS 验证' },
          { value: 'FILE', label: '文件验证' },
        ],
      },
      DomainName: { type: 'string', title: '域名' },
    },
    required: ['DvAuthMethod', 'DomainName'],
  };

  /** 表单样式 */
  readonly ui: SFUISchema = {
    '*': { spanLabelFixed: 100, grid: { span: 24 } },
    $DvAuthMethod: { widget: 'radio' },
    $DomainName: { placeholder: '例如 example.com 或 www.example.com' },
  };

  /** 页面初始化 */
  ngOnInit(): void {
    this.formData.set({ DomainName: '', DvAuthMethod: 'DNS_AUTO' });
  }

  /**
   * 提交申请
   *
   * @param value 表单值
   */
  save(value: Record<string, unknown>): void {
    this.tencentSrv
      .sslApply(this.data.keyId, {
        DomainName: String(value['DomainName'] ?? '').trim(),
        DvAuthMethod: String(value['DvAuthMethod'] ?? 'DNS_AUTO'),
      })
      .subscribe({
        next: (res) => {
          /** 业务错误 */
          const message = businessError(res);
          if (message) {
            this.msgSrv.error(message);
            return;
          }
          this.msgSrv.success('证书申请成功，请前往 DNS 验证配置');
          this.modalRef.close(true);
        },
        error: (err: unknown) =>
          this.msgSrv.error(apiErrorMessage(err, '证书申请失败，请稍后重试！')),
      });
  }

  /** 关闭弹窗 */
  close(): void {
    this.modalRef.close(false);
  }
}
