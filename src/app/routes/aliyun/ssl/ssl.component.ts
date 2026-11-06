import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { apiErrorMessage } from '@core';
import type { STChange, STColumn, STData, STPage } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';

import { CERT_SOURCE_TAG } from '../aliyun.format';
import { type SslCertItem, AliyunService } from '../aliyun.service';
import { AliyunSslDeployComponent } from './deploy/deploy.component';
import { AliyunSslDetailComponent } from './detail/detail.component';
import { AliyunSslUploadComponent } from './upload/upload.component';

/**
 * 阿里云证书页
 *
 * 注 1：数据来自 `aliyun/ssl/list`（后端固定 `OrderType=CERT`），字段已归一化
 * 注 2：**不提供吊销** —— 实测 `RevokeCertificate` 只受理付费订阅证书，
 * 免费测试证书一律 400 `NotFound`，放个点了报错的按钮没有意义
 */
@Component({
  selector: 'aliyun-ssl',
  templateUrl: './ssl.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class AliyunSslComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly aliyunSrv = inject(AliyunService);
  private readonly modalSrv = inject(NzModalService);
  private readonly msgSrv = inject(NzMessageService);

  /** 密钥ID */
  readonly keyId = Number(this.route.parent?.snapshot.params['id']);
  /** 证书清单 */
  readonly data = signal<SslCertItem[]>([]);
  /** 加载标记 */
  readonly loading = signal(true);
  /** 当前页码 */
  readonly pi = signal(1);
  /** 每页数量 */
  readonly ps = signal(10);
  /** 总记录数 */
  readonly total = signal(0);
  /** 已加载过且结果为空，注：用于区分「还没有数据」与「加载失败」 */
  readonly empty = signal(false);

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
    { title: '证书ID', index: 'certId', width: 110 },
    { title: '名称', index: 'name' },
    { title: '主域名', index: 'domain' },
    {
      title: '绑定域名',
      type: 'widget',
      widget: { type: 'array', params: ({ record }) => ({ value: record['sans'] }) },
    },
    { title: '颁发机构', index: 'issuer' },
    { title: '签发日期', index: 'startAt', type: 'date' },
    { title: '到期日期', index: 'endAt', type: 'date' },
    {
      title: '状态',
      index: 'expired',
      type: 'tag',
      width: 110,
      tag: {
        false: { text: '有效', color: 'green' },
        true: { text: '已过期', color: 'red' },
      },
    },
    {
      title: '来源',
      index: 'uploaded',
      type: 'tag',
      width: 120,
      tag: CERT_SOURCE_TAG,
    },
    {
      title: '操作',
      fixed: 'right',
      width: 240,
      buttons: [
        {
          text: '详情',
          icon: 'eye',
          click: (record: STData) => this.detail(record as SslCertItem),
        },
        {
          text: '部署',
          icon: 'cloud-upload',
          click: (record: STData) => this.deploy(record as SslCertItem),
        },
        {
          text: '删除',
          icon: 'delete',
          type: 'del',
          pop: '确认删除该证书吗？删除后不可恢复。',
          click: (record: STData) => this.remove(record as SslCertItem),
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
    this.aliyunSrv.sslList(this.keyId, { CurrentPage: this.pi(), ShowSize: this.ps() }).subscribe({
      next: (res) => {
        this.data.set(res.items ?? []);
        this.total.set(res.total ?? 0);
        this.empty.set((res.items ?? []).length === 0);
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

  /**
   * 打开证书详情
   *
   * @param record 证书
   */
  detail(record: SslCertItem): void {
    this.modalSrv.create<AliyunSslDetailComponent, { keyId: number; certId: number }, unknown>({
      nzContent: AliyunSslDetailComponent,
      nzData: { keyId: this.keyId, certId: record.certId },
      nzTitle: '证书详情',
      nzFooter: null,
      nzWidth: 880,
    });
  }

  /**
   * 打开上传弹窗
   */
  upload(): void {
    this.modalSrv
      .create<AliyunSslUploadComponent, { keyId: number }, boolean>({
        nzContent: AliyunSslUploadComponent,
        nzData: { keyId: this.keyId },
        nzTitle: '上传证书',
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
   * 打开部署弹窗
   *
   * @param record 证书
   */
  deploy(record: SslCertItem): void {
    this.modalSrv
      .create<
        AliyunSslDeployComponent,
        { keyId: number; certId: number; name: string; sans: string[]; endAt: string },
        boolean
      >({
        nzContent: AliyunSslDeployComponent,
        nzData: {
          keyId: this.keyId,
          certId: record.certId,
          name: record.name,
          sans: record.sans,
          endAt: record.endAt,
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
   * 删除证书
   *
   * @param record 证书
   */
  remove(record: SslCertItem): void {
    this.aliyunSrv.sslDelete(this.keyId, record.certId).subscribe({
      next: () => {
        this.msgSrv.success('证书删除成功');
        this.fresh();
      },
      error: (err: unknown) =>
        this.msgSrv.error(apiErrorMessage(err, '证书删除失败，请稍后重试！')),
    });
  }
}
