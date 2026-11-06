import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';

import { dateOf } from '../../aliyun.format';
import { type SslCertDetail, type SslCertPem, AliyunService } from '../../aliyun.service';

/** 详情弹窗入参 */
export interface SslDetailData {
  /** 密钥ID */
  keyId: number;
  /** 证书ID */
  certId: number;
}

/**
 * 阿里云证书详情
 *
 * 注 1：概览走 `show`（不含私钥），用户显式点「查看证书内容」时才调 `pem` ——
 * 私钥不经无谓的往返
 * 注 2：私钥默认遮罩，避免投屏 / 截图泄露
 */
@Component({
  selector: 'aliyun-ssl-detail',
  templateUrl: './detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
  styles: [
    `
      .kv {
        width: 100%;
        border-collapse: collapse;
      }
      .kv th,
      .kv td {
        padding: 6px 10px;
        border-bottom: 1px solid rgba(128, 128, 128, 0.2);
        text-align: left;
        vertical-align: top;
      }
      .kv th {
        width: 110px;
        font-weight: normal;
        white-space: nowrap;
        opacity: 0.65;
      }
      .kv code {
        word-break: break-all;
      }
      .pem-actions {
        margin-bottom: 8px;
      }
      .pem-actions button + button {
        margin-left: 8px;
      }
      .modal-footer {
        margin-top: 16px;
        text-align: right;
      }
    `,
  ],
})
export class AliyunSslDetailComponent implements OnInit {
  private readonly aliyunSrv = inject(AliyunService);
  private readonly msgSrv = inject(NzMessageService);
  private readonly modalRef = inject(NzModalRef);

  /** 弹窗入参，注：`NzModalService.create` 传的 `nzData` 只能通过 `NZ_MODAL_DATA` 取到，
   * 写成普通字段会一直是 `undefined`，请求会打到 `show/undefined` 上 */
  private readonly data = inject<SslDetailData>(NZ_MODAL_DATA);

  /** 密钥ID */
  private get keyId(): number {
    return this.data.keyId;
  }

  /** 证书ID */
  private get certId(): number {
    return this.data.certId;
  }

  /** 日期格式化，注：共享模块里没有 `date` 管道，统一走纯函数 */
  readonly dateOf = dateOf;
  /** 加载标记 */
  readonly loading = signal(true);
  /** 证书概览 */
  readonly detail = signal<SslCertDetail | null>(null);
  /** PEM 内容，注：未点开时为空 */
  readonly pem = signal<SslCertPem | null>(null);
  /** PEM 加载标记 */
  readonly pemLoading = signal(false);
  /** 是否展示私钥明文 */
  readonly showKey = signal(false);

  /** 页面初始化 */
  ngOnInit(): void {
    this.aliyunSrv.sslDetail(this.keyId, this.certId).subscribe({
      next: (res) => {
        this.detail.set(res);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.msgSrv.error(apiErrorMessage(err, '获取证书详情失败，请稍后重试！'));
      },
    });
  }

  /** 加载证书内容与私钥 */
  loadPem(): void {
    if (this.pem() !== null || this.pemLoading()) {
      return;
    }
    this.pemLoading.set(true);
    this.aliyunSrv.sslPem(this.keyId, this.certId).subscribe({
      next: (res) => {
        this.pem.set(res);
        this.pemLoading.set(false);
      },
      error: (err: unknown) => {
        this.pemLoading.set(false);
        this.msgSrv.error(apiErrorMessage(err, '获取证书内容失败，请稍后重试！'));
      },
    });
  }

  /** 切换私钥明文展示 */
  toggleKey(): void {
    this.loadPem();
    this.showKey.set(!this.showKey());
  }

  /** 关闭弹窗 */
  close(): void {
    this.modalRef.destroy(false);
  }
}
