import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { apiErrorMessage } from '@core';
import type { STChange, STColumn, STData, STPage } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';

import { ORDER_STATUS_TAG, canApply, canCancel } from '../aliyun.format';
import { type SslOrderItem, AliyunService } from '../aliyun.service';
import { AliyunOrderAuditComponent } from './audit/audit.component';
import { AliyunOrderResultComponent } from './result/result.component';

/**
 * 阿里云订单页
 *
 * 注 1：订单是「购买记录 / 证书额度」，与证书是两个正交概念 —— 同一个接口
 * （`ListUserCertificateOrder`）在 `OrderType=CPACK` 下返回的字段与证书完全不同
 * 注 2：账号里可能有上万条免费额度单，故默认按「待申请」筛选，靠状态而不是翻页找
 */
@Component({
  selector: 'aliyun-order',
  templateUrl: './order.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class AliyunOrderComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly aliyunSrv = inject(AliyunService);
  private readonly modalSrv = inject(NzModalService);
  private readonly msgSrv = inject(NzMessageService);

  /** 密钥ID */
  readonly keyId = Number(this.route.parent?.snapshot.params['id']);
  /** 订单清单 */
  readonly data = signal<SslOrderItem[]>([]);
  /** 加载标记 */
  readonly loading = signal(true);
  /** 当前页码 */
  readonly pi = signal(1);
  /** 每页数量 */
  readonly ps = signal(10);
  /** 总记录数 */
  readonly total = signal(0);
  /** 状态筛选，注：默认只看待申请，避免被上万条历史单淹没 */
  readonly status = signal('PAYED');

  /** 分页配置 */
  readonly page: STPage = {
    front: false,
    toTopOffset: 0,
    showSize: true,
    pageSizes: [10, 20, 50, 100],
    showQuickJumper: true,
    total: '第{{range[0]}}条至第{{range[1]}}条，共{{total}}条',
  };

  /** 状态筛选项 */
  readonly statusOptions = [
    { value: 'PAYED', label: '待申请（可用额度）' },
    { value: 'CHECKING', label: '审核中' },
    { value: 'ISSUED', label: '已签发' },
    { value: 'EXPIRED', label: '已过期' },
    { value: 'CHECKED_FAIL', label: '审核失败' },
    { value: '', label: '全部' },
  ];

  /** 列定义 */
  readonly columns: STColumn[] = [
    { title: '实例ID', index: 'instanceId', width: 220 },
    { title: '订单ID', index: 'orderId', width: 120 },
    { title: '产品', index: 'product' },
    { title: '类型', index: 'certType', width: 90 },
    {
      title: '主域名',
      index: 'domain',
      format: (record: STData) =>
        (record['domain'] as string) === '' ? '（未使用）' : (record['domain'] as string),
    },
    { title: '状态', index: 'status', type: 'tag', width: 110, tag: ORDER_STATUS_TAG },
    { title: '购买时间', index: 'boughtAt', type: 'date' },
    { title: '到期时间', index: 'endAt', type: 'date' },
    {
      title: '操作',
      fixed: 'right',
      width: 260,
      buttons: [
        {
          text: '申请证书',
          icon: 'safety-certificate',
          iif: (record: STData) => canApply(record as SslOrderItem),
          click: (record: STData) => this.apply(record as SslOrderItem),
        },
        {
          text: '查看状态',
          icon: 'eye',
          iif: (record: STData) => record['status'] !== 'PAYED',
          click: (record: STData) => this.showState(record as SslOrderItem),
        },
        {
          text: '取消',
          icon: 'stop',
          type: 'del',
          iif: (record: STData) => canCancel(record as SslOrderItem),
          pop: '取消后该订单会从账号中消失且不可恢复，证书额度也会一并作废。确认取消？',
          click: (record: STData) => this.cancel(record as SslOrderItem),
        },
      ],
    },
  ];

  /** 页面初始化 */
  ngOnInit(): void {
    this.fresh();
  }

  /** 加载订单清单 */
  fresh(): void {
    this.loading.set(true);
    this.aliyunSrv
      .orderList(this.keyId, {
        CurrentPage: this.pi(),
        ShowSize: this.ps(),
        ...(this.status() === '' ? {} : { Status: this.status() }),
      })
      .subscribe({
        next: (res) => {
          this.data.set(res.items ?? []);
          this.total.set(res.total ?? 0);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.msgSrv.error(
            apiErrorMessage(err, '加载订单失败；若订单量过大，请缩小筛选范围后重试。'),
          );
        },
      });
  }

  /**
   * 切换状态筛选
   *
   * @param value 状态
   */
  changeStatus(value: string): void {
    this.status.set(value);
    this.pi.set(1);
    this.fresh();
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
   * 打开申请弹窗
   *
   * @param record 订单
   */
  apply(record: SslOrderItem): void {
    this.modalSrv
      .create<AliyunOrderAuditComponent, { keyId: number; instanceId: string }, boolean>({
        nzContent: AliyunOrderAuditComponent,
        nzData: { keyId: this.keyId, instanceId: record.instanceId },
        nzTitle: '申请 DV 证书',
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
   * 查看申请状态
   *
   * @param record 订单
   */
  showState(record: SslOrderItem): void {
    this.modalSrv.create({
      nzContent: AliyunOrderResultComponent,
      nzData: {
        keyId: this.keyId,
        orderId: record.orderId,
        domain: record.domain,
      },
      nzTitle: '申请状态',
      nzFooter: null,
      nzWidth: 720,
    });
  }

  /**
   * 取消申请
   *
   * @param record 订单
   */
  cancel(record: SslOrderItem): void {
    this.aliyunSrv.cancel(this.keyId, record.orderId).subscribe({
      next: () => {
        this.msgSrv.success('订单已取消');
        this.fresh();
      },
      error: (err: unknown) =>
        this.msgSrv.error(apiErrorMessage(err, '取消订单失败，请稍后重试！')),
    });
  }
}
