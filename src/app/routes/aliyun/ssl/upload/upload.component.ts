import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import type { SFSchema, SFUISchema } from '@delon/form';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';

import { AliyunService } from '../../aliyun.service';

/** 上传弹窗入参 */
export interface SslUploadData {
  /** 密钥ID */
  keyId: number;
}

/**
 * 证书上传组件
 *
 * 注：提交后阿里云返回 `CertId`，列表里会以「外部上传」标记出现
 */
@Component({
  selector: 'aliyun-ssl-upload',
  templateUrl: './upload.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class AliyunSslUploadComponent implements OnInit {
  private readonly aliyunSrv = inject(AliyunService);
  private readonly msgSrv = inject(NzMessageService);
  private readonly modalRef = inject(NzModalRef);
  /** 弹窗入参 */
  private readonly data = inject<SslUploadData>(NZ_MODAL_DATA);

  /** 表单数据 */
  readonly formData = signal<Record<string, unknown> | null>(null);
  /** 提交中标记 */
  readonly loading = signal(false);

  /** 表单 schema */
  readonly schema: SFSchema = {
    properties: {
      Name: {
        type: 'string',
        title: '证书名称',
        description: '同一账号下不可重复，最长 63 个字符',
        maxLength: 63,
      },
      Cert: {
        type: 'string',
        title: '证书内容',
        description: 'PEM 格式，含 -----BEGIN CERTIFICATE----- 与 -----END CERTIFICATE-----',
      },
      Key: {
        type: 'string',
        title: '证书私钥',
        description: 'PEM 格式，含 -----BEGIN PRIVATE KEY----- 或 -----BEGIN RSA PRIVATE KEY-----',
      },
    },
    required: ['Name', 'Cert', 'Key'],
  };

  /** 表单样式 */
  readonly ui: SFUISchema = {
    '*': { spanLabelFixed: 100, grid: { span: 24 } },
    $Name: { placeholder: '例如 example.com-2026' },
    $Cert: { widget: 'textarea', autosize: { minRows: 6, maxRows: 12 } },
    $Key: { widget: 'textarea', autosize: { minRows: 6, maxRows: 12 } },
  };

  /** 页面初始化 */
  ngOnInit(): void {
    this.formData.set({ Name: '', Cert: '', Key: '' });
  }

  /**
   * 提交上传
   *
   * @param value 表单值
   */
  save(value: Record<string, unknown>): void {
    this.loading.set(true);
    this.aliyunSrv
      .sslImport(this.data.keyId, {
        Name: String(value['Name'] ?? ''),
        Cert: String(value['Cert'] ?? ''),
        Key: String(value['Key'] ?? ''),
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.msgSrv.success(`证书上传成功（ID：${res.certId}）`);
          this.modalRef.close(true);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.msgSrv.error(apiErrorMessage(err, '证书上传失败，请稍后重试！'));
        },
      });
  }

  /** 关闭弹窗 */
  close(): void {
    this.modalRef.close(false);
  }
}
