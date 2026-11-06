import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { apiErrorMessage } from '@core';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef, NzModalService } from 'ng-zorro-antd/modal';

import { DNS_STATUS_TEXT, DNS_STATUS_TAG, STATE_TAG, STATE_TEXT } from '../../aliyun.format';
import { type SslState, type SslVerify, AliyunService } from '../../aliyun.service';
import { AliyunSslDeployComponent } from '../../ssl/deploy/deploy.component';

/** 状态弹窗入参 */
export interface SslResultData {
  /** 密钥ID */
  keyId: number;
  /** 订单ID */
  orderId: number;
  /** 申请域名 */
  domain: string;
}

/** 轮询间隔（毫秒），注：待验证 / 审核中才轮询，已签发后停 */
const POLL_INTERVAL = 30000;

/**
 * 申请状态组件
 *
 * 注 1：数据来自 `DescribeCertificateState`（入参是 `OrderId`）—— 本账号的
 * `GetInstanceDetail(InstanceId)` 恒 400，旧实现就是栽在这里
 * 注 2：DNS 检测**只读**，不替用户改 DNS；`pending` 也不等于失败（实测本地查不到但阿里云已签发）
 */
@Component({
  selector: 'aliyun-order-result',
  templateUrl: './result.component.html',
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
        width: 90px;
        font-weight: normal;
        white-space: nowrap;
        opacity: 0.65;
      }
      .break-all {
        word-break: break-all;
      }
      .probe-bar {
        margin: 12px 0 8px;
      }
      .probe-bar button + nz-tag {
        margin-left: 8px;
      }
      .probe-existing {
        margin-top: 8px;
      }
      .probe-existing code {
        display: block;
        margin-top: 4px;
      }
      .text-muted {
        margin: 8px 0 0;
        opacity: 0.6;
        font-size: 12px;
      }
      .modal-footer {
        margin-top: 16px;
        text-align: right;
      }
    `,
  ],
})
export class AliyunOrderResultComponent implements OnInit, OnDestroy {
  private readonly aliyunSrv = inject(AliyunService);
  private readonly msgSrv = inject(NzMessageService);
  private readonly modalSrv = inject(NzModalService);
  private readonly modalRef = inject(NzModalRef);
  /** 弹窗入参，注：模板要读 `domain` 做展示，故为 public */
  readonly data = inject<SslResultData>(NZ_MODAL_DATA);

  /** 申请状态 */
  readonly state = signal<SslState | null>(null);
  /** DNS 探测结果 */
  readonly probe = signal<SslVerify | null>(null);
  /** 加载标记 */
  readonly loading = signal(true);
  /** 探测中标记 */
  readonly probing = signal(false);
  /** 轮询计时器 */
  private timer: ReturnType<typeof setInterval> | undefined;

  /** 状态标签映射 */
  readonly stateTag = STATE_TAG;
  /** DNS 状态标签映射 */
  readonly dnsTag = DNS_STATUS_TAG;

  /** 页面初始化 */
  ngOnInit(): void {
    this.fresh();
    this.timer = setInterval(() => this.fresh(), POLL_INTERVAL);
  }

  /** 页面销毁时清掉轮询，注：弹窗关掉后必须停，否则会一直打阿里云 */
  ngOnDestroy(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
    }
  }

  /**
   * 状态文案
   *
   * @param type 状态
   * @returns 中文文案
   */
  stateText(type?: string): string {
    return STATE_TEXT[type ?? ''] ?? type ?? '-';
  }

  /**
   * DNS 状态说明
   *
   * @param status 状态
   * @returns 说明文案
   */
  dnsText(status?: string): string {
    return DNS_STATUS_TEXT[status ?? ''] ?? '';
  }

  /**
   * DNS 状态对应的提示类型
   *
   * @param status 状态
   * @returns `nz-alert` 的类型
   */
  dnsAlertType(status?: string): 'success' | 'info' | 'warning' | 'error' {
    switch (status) {
      case 'matched':
        return 'success';
      case 'mismatched':
        return 'error';
      case 'unknown':
        return 'warning';
      default:
        return 'info';
    }
  }

  /**
   * 域名 NS 的提示文案
   *
   * @param ns NS 列表
   * @returns 提示文案
   */
  nsText(ns: string[]): string {
    if (!ns || ns.length === 0) {
      return '未能查到该域名的 NS，请到域名服务商的解析页面添加记录。';
    }
    return `该域名当前由 ${ns.join('、')} 解析，请到对应平台的解析页面添加记录。`;
  }

  /** 拉取申请状态 */
  fresh(): void {
    this.aliyunSrv.state(this.data.keyId, this.data.orderId).subscribe({
      next: (res) => {
        this.state.set(res);
        this.loading.set(false);
        // 已签发 / 失败就停掉轮询，没必要继续打接口
        if (res.type === 'certificate' || res.type === 'verify_fail') {
          this.stopPolling();
        }
        if (res.type === 'domain_verify') {
          this.checkDns();
        }
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.stopPolling();
        this.msgSrv.error(apiErrorMessage(err, '获取申请状态失败，请稍后重试！'));
      },
    });
  }

  /** 探测 DNS 记录 */
  checkDns(): void {
    if (this.probing()) {
      return;
    }
    this.probing.set(true);
    this.aliyunSrv.verify(this.data.keyId, this.data.orderId, this.data.domain).subscribe({
      next: (res) => {
        this.probe.set(res);
        this.probing.set(false);
      },
      error: (err: unknown) => {
        this.probing.set(false);
        this.msgSrv.error(apiErrorMessage(err, 'DNS 检测失败，请稍后重试！'));
      },
    });
  }

  /**
   * 复制文本
   *
   * @param text 待复制内容
   */
  async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.msgSrv.success('已复制');
    } catch {
      this.msgSrv.warning('复制失败，请手动选中后复制');
    }
  }

  /** 下载证书与私钥 */
  download(): void {
    /** 申请状态 */
    const current = this.state();
    if (!current || current.cert === '') {
      return;
    }
    /** 下载内容 */
    const content = `${current.cert}\n\n${current.key}\n`;
    /** 文件对象 */
    const blob = new Blob([content], { type: 'application/x-pem-file' });
    /** 临时地址 */
    const url = URL.createObjectURL(blob);
    /** 链接触发下载 */
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.data.domain || 'certificate'}.pem`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /** 部署到 KONG */
  deploy(): void {
    /** 申请状态 */
    const current = this.state();
    if (!current || current.certId === 0) {
      this.msgSrv.warning('证书还未签发，暂时无法部署');
      return;
    }
    this.modalSrv
      .create<
        AliyunSslDeployComponent,
        { keyId: number; certId: number; name: string; sans: string[]; endAt: string },
        boolean
      >({
        nzContent: AliyunSslDeployComponent,
        nzData: {
          keyId: this.data.keyId,
          certId: current.certId,
          name: this.data.domain,
          sans: [this.data.domain],
          endAt: '',
        },
        nzTitle: '部署证书到 KONG',
        nzFooter: null,
        nzWidth: 720,
      })
      .afterClose.subscribe((saved) => {
        if (saved) {
          this.msgSrv.success('部署已完成');
        }
      });
  }

  /** 停止轮询 */
  private stopPolling(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /** 关闭弹窗 */
  close(): void {
    this.modalRef.close(false);
  }
}
