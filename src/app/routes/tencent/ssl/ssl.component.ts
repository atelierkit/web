import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { apiErrorMessage } from '@core';
import type { STChange, STColumn, STData, STPage } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';

import { SSL_STATUS_TAG, businessError, canRenew } from '../tencent.format';
import { SslCertificate, TencentService } from '../tencent.service';
import { TencentSslAliasComponent, type SslAliasData } from './alias/alias.component';
import { TencentSslApplyComponent, type SslApplyData } from './apply/apply.component';
import { TencentSslDeployComponent, type SslDeployData } from './deploy/deploy.component';

/**
 * SSL 证书组件
 *
 * 注：列表、续期、部署、备注、吊销、删除都在这一页；续期只在「到期不足一个月」时出现，
 * 判定逻辑抽在 `tencent.format.ts` 的 `canRenew` 里（便于单测）
 */
@Component({
  selector: 'tencent-ssl',
  templateUrl: './ssl.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class TencentSslComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly tencentSrv = inject(TencentService);
  private readonly modalSrv = inject(NzModalService);
  private readonly msgSrv = inject(NzMessageService);

  /** 密钥ID */
  readonly keyId = Number(this.route.parent?.snapshot.params['id']);
  /** 证书清单 */
  readonly data = signal<SslCertificate[]>([]);
  /** 加载标记 */
  readonly loading = signal(true);
  /** 当前页码 */
  readonly pi = signal(1);
  /** 每页数量 */
  readonly ps = signal(10);
  /** 总记录数 */
  readonly total = signal(0);

  /** 分页配置 */
  readonly page: STPage = {
    front: false,
    toTopOffset: 0,
    showSize: true,
    pageSizes: [5, 10, 20, 50, 100],
    showQuickJumper: true,
    total: '第{{range[0]}}条至第{{range[1]}}条，共{{total}}条',
  };

  /** 列定义 */
  readonly columns: STColumn[] = [
    { title: '证书ID', index: 'CertificateId' },
    { title: '备注', index: 'Alias' },
    { title: '绑定域名', index: 'Domain' },
    {
      title: '生效时间',
      index: 'CertBeginTime',
      sort: {
        compare: (a, b) => String(a['CertBeginTime']).localeCompare(String(b['CertBeginTime'])),
      },
    },
    {
      title: '到期时间',
      index: 'CertEndTime',
      sort: { compare: (a, b) => String(a['CertEndTime']).localeCompare(String(b['CertEndTime'])) },
    },
    {
      title: '状态',
      index: 'Status',
      type: 'tag',
      width: 120,
      tag: SSL_STATUS_TAG,
    },
    { title: '状态说明', index: 'StatusName' },
    {
      title: '申请域名',
      type: 'widget',
      widget: { type: 'array', params: ({ record }) => ({ value: record['CertSANs'] }) },
    },
    {
      title: '申请时间',
      index: 'InsertTime',
      sort: { compare: (a, b) => String(a['InsertTime']).localeCompare(String(b['InsertTime'])) },
    },
    {
      title: '认证截止时间',
      index: 'DVAuthDeadline',
      sort: {
        compare: (a, b) => String(a['DVAuthDeadline']).localeCompare(String(b['DVAuthDeadline'])),
      },
    },
    {
      title: '认证通过时间',
      index: 'ValidationPassedTime',
      sort: {
        compare: (a, b) =>
          String(a['ValidationPassedTime']).localeCompare(String(b['ValidationPassedTime'])),
      },
    },
    {
      title: '操作',
      fixed: 'right',
      width: 320,
      buttons: [
        {
          text: '续期',
          icon: 'redo',
          iif: (record: STData) => canRenew(record['CertEndTime'] as string | undefined),
          click: (record: STData) => this.renew(record as SslCertificate),
          pop: '将使用相同的域名申请新的证书，是否继续？',
        },
        {
          text: '部署',
          icon: 'cloud-upload',
          click: (record: STData) => this.deploy(record as SslCertificate),
        },
        {
          text: '备注',
          icon: 'edit',
          click: (record: STData) => this.updateAlias(record as SslCertificate),
        },
        {
          text: '吊销',
          icon: 'stop',
          type: 'del',
          pop: '确认吊销吗？',
          click: (record: STData) => this.revoke(record as SslCertificate),
        },
        {
          text: '删除',
          icon: 'delete',
          type: 'del',
          click: (record: STData) => this.remove(record as SslCertificate),
        },
      ],
    },
  ];

  /** 页面初始化 */
  ngOnInit(): void {
    this.fresh();
  }

  /** 加载证书清单 */
  fresh(): void {
    this.loading.set(true);
    // 注：腾讯云的 Offset 从 0 起，所以要 (页码 - 1) * 每页
    this.tencentSrv.sslList(this.keyId, (this.pi() - 1) * this.ps(), this.ps()).subscribe({
      next: (res) => {
        /** 业务错误 */
        const message = businessError(res);
        if (message) {
          this.loading.set(false);
          this.msgSrv.error(message);
          return;
        }
        this.data.set(res.Certificates ?? []);
        this.total.set(res.TotalCount ?? 0);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        // 失败时须复位加载态，否则表格会一直转圈
        this.loading.set(false);
        this.msgSrv.error(apiErrorMessage(err, '加载证书列表失败，请稍后重试！'));
      },
    });
  }

  /**
   * 处理分页变化
   *
   * @param e 表格变化事件
   */
  change(e: STChange): void {
    if (e.type === 'pi' || e.type === 'ps') {
      if (e.type === 'pi') {
        this.pi.set(e.pi!);
      }
      if (e.type === 'ps') {
        this.ps.set(e.ps!);
      }
      this.fresh();
    }
  }

  /** 打开申请证书弹窗 */
  apply(): void {
    this.modalSrv
      .create<TencentSslApplyComponent, SslApplyData, boolean>({
        nzContent: TencentSslApplyComponent,
        nzData: { keyId: this.keyId },
        nzTitle: '申请免费证书',
        nzFooter: null,
        nzWidth: 560,
      })
      .afterClose.subscribe((saved) => {
        if (saved) {
          this.fresh();
        }
      });
  }

  /**
   * 打开备注弹窗
   *
   * @param record 证书
   */
  updateAlias(record: SslCertificate): void {
    this.modalSrv
      .create<TencentSslAliasComponent, SslAliasData, boolean>({
        nzContent: TencentSslAliasComponent,
        nzData: {
          keyId: this.keyId,
          certificateId: record.CertificateId,
          alias: record.Alias ?? '',
        },
        nzTitle: '备注证书',
        nzFooter: null,
        nzWidth: 560,
      })
      .afterClose.subscribe((saved) => {
        if (saved) {
          this.fresh();
        }
      });
  }

  /**
   * 打开部署弹窗
   *
   * @param record 证书
   */
  deploy(record: SslCertificate): void {
    this.modalSrv
      .create<TencentSslDeployComponent, SslDeployData, boolean>({
        nzContent: TencentSslDeployComponent,
        nzData: {
          keyId: this.keyId,
          certificateId: record.CertificateId,
          domain: record.CertSANs ?? [],
          end: record.CertEndTime ?? '',
        },
        nzTitle: '部署证书到 KONG',
        nzFooter: null,
        nzWidth: 720,
      })
      .afterClose.subscribe((saved) => {
        if (saved) {
          this.fresh();
        }
      });
  }

  /**
   * 续期证书
   *
   * 注：必须带上原证书ID，否则同域名免费证书会撞数量上限
   *
   * @param record 证书
   */
  renew(record: SslCertificate): void {
    this.tencentSrv
      .sslApply(this.keyId, {
        DvAuthMethod: 'DNS_AUTO',
        DomainName: record.Domain ?? '',
        OldCertificateId: record.CertificateId,
      })
      .subscribe({
        next: (res) => {
          /** 业务错误 */
          const message = businessError(res);
          if (message) {
            this.msgSrv.error(message);
            return;
          }
          this.msgSrv.success('证书续期申请成功，请等待审核完成');
          this.fresh();
        },
        error: (err: unknown) => this.msgSrv.error(apiErrorMessage(err, '证书续期失败')),
      });
  }

  /**
   * 吊销证书
   *
   * @param record 证书
   */
  revoke(record: SslCertificate): void {
    this.tencentSrv.sslRevoke(this.keyId, record.CertificateId).subscribe({
      next: (res) => {
        /** 业务错误 */
        const message = businessError(res);
        if (message) {
          this.msgSrv.error(message);
          return;
        }
        this.msgSrv.success('证书吊销成功');
        this.fresh();
      },
      error: (err: unknown) => this.msgSrv.error(apiErrorMessage(err, '证书吊销失败')),
    });
  }

  /**
   * 删除证书
   *
   * @param record 证书
   */
  remove(record: SslCertificate): void {
    this.tencentSrv.sslDelete(this.keyId, record.CertificateId).subscribe({
      next: (res) => {
        /** 业务错误 */
        const message = businessError(res);
        if (message) {
          this.msgSrv.error(message);
          return;
        }
        this.msgSrv.success('证书删除成功');
        this.fresh();
      },
      error: (err: unknown) => this.msgSrv.error(apiErrorMessage(err, '证书删除失败')),
    });
  }
}
