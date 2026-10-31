import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { apiErrorMessage } from '@core';
import type { STChange, STColumn, STData, STPage } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';

import { DNS_STATUS_TAG, businessError } from '../tencent.format';
import { DnsRecord, TencentService } from '../tencent.service';
import { TencentDnsEditComponent, type DnsEditData } from './edit/edit.component';

/**
 * 解析记录组件
 *
 * 注：列表总数取 `RecordCountInfo.TotalCount` —— `DescribeRecordList` 没有顶层 `TotalCount`，
 * 旧私有项目取 `res.TotalCount` 恒为 undefined，分页器一直是 0 条
 */
@Component({
  selector: 'tencent-dns',
  templateUrl: './dns.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class TencentDnsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly tencentSrv = inject(TencentService);
  private readonly modalSrv = inject(NzModalService);
  private readonly msgSrv = inject(NzMessageService);

  /** 密钥ID */
  readonly keyId = Number(this.route.parent?.snapshot.params['id']);
  /** 域名 */
  readonly domain = String(this.route.snapshot.params['domain'] ?? '');
  /** 域名套餐等级 */
  readonly grade = String(this.route.snapshot.params['grade'] ?? '');
  /** 记录清单 */
  readonly data = signal<DnsRecord[]>([]);
  /** 加载标记 */
  readonly loading = signal(true);
  /** 当前页码 */
  readonly pi = signal(1);
  /** 每页数量 */
  readonly ps = signal(20);
  /** 总记录数 */
  readonly total = signal(0);

  /** 分页配置 */
  readonly page: STPage = {
    front: false,
    toTopOffset: 0,
    showSize: true,
    pageSizes: [10, 20, 50, 100],
    showQuickJumper: true,
    total: '第{{range[0]}}条至第{{range[1]}}条，共{{total}}条',
  };

  /** 列定义 */
  readonly columns: STColumn[] = [
    { title: '记录ID', index: 'RecordId', width: 100 },
    { title: '主机记录', index: 'Name', width: 150 },
    { title: '记录类型', index: 'Type', width: 90 },
    { title: '记录值', index: 'Value', width: 250 },
    { title: '线路', index: 'Line', width: 100 },
    {
      title: '状态',
      index: 'Status',
      type: 'tag',
      width: 90,
      tag: DNS_STATUS_TAG,
    },
    { title: 'TTL', index: 'TTL', width: 80 },
    { title: 'MX', index: 'MX', width: 80 },
    {
      title: '更新时间',
      index: 'UpdatedOn',
      width: 180,
      sort: { compare: (a, b) => String(a['UpdatedOn']).localeCompare(String(b['UpdatedOn'])) },
    },
    { title: '备注', index: 'Remark' },
    {
      title: '操作',
      fixed: 'right',
      width: 150,
      buttons: [
        {
          text: '编辑',
          icon: 'edit',
          click: (record: STData) => this.edit(record as DnsRecord),
        },
        {
          text: '删除',
          icon: 'delete',
          type: 'del',
          pop: '确定删除该解析记录吗？',
          click: (record: STData) => this.remove(record as DnsRecord),
        },
      ],
    },
  ];

  /** 页面初始化 */
  ngOnInit(): void {
    if (this.domain) {
      this.fresh();
    }
  }

  /** 加载记录清单 */
  fresh(): void {
    this.loading.set(true);
    this.tencentSrv
      .dnsList(this.keyId, this.domain, (this.pi() - 1) * this.ps(), this.ps())
      .subscribe({
        next: (res) => {
          /** 业务错误 */
          const message = businessError(res);
          if (message) {
            this.loading.set(false);
            this.msgSrv.error(message);
            return;
          }
          this.data.set(res.RecordList ?? []);
          this.total.set(res.RecordCountInfo?.TotalCount ?? 0);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.msgSrv.error(apiErrorMessage(err, '加载解析记录失败，请稍后重试！'));
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

  /** 新增记录 */
  add(): void {
    this.open();
  }

  /**
   * 编辑记录
   *
   * @param record 记录
   */
  edit(record: DnsRecord): void {
    this.open(record.RecordId);
  }

  /**
   * 打开记录编辑弹窗
   *
   * @param recordId 记录ID，缺省表示新增
   */
  private open(recordId?: number): void {
    this.modalSrv
      .create<TencentDnsEditComponent, DnsEditData, boolean>({
        nzContent: TencentDnsEditComponent,
        nzData: {
          keyId: this.keyId,
          grade: this.grade,
          domain: this.domain,
          recordId,
        },
        nzTitle: recordId ? '编辑解析记录' : '添加解析记录',
        nzFooter: null,
        nzWidth: 640,
      })
      .afterClose.subscribe((saved) => {
        if (saved) {
          this.fresh();
        }
      });
  }

  /**
   * 删除记录
   *
   * @param record 记录
   */
  remove(record: DnsRecord): void {
    if (!record.RecordId) {
      return;
    }
    this.tencentSrv.dnsDelete(this.keyId, this.domain, record.RecordId).subscribe({
      next: (res) => {
        /** 业务错误 */
        const message = businessError(res);
        if (message) {
          this.msgSrv.error(message);
          return;
        }
        this.msgSrv.success('删除成功');
        this.fresh();
      },
      error: (err: unknown) => this.msgSrv.error(apiErrorMessage(err, '删除失败，请稍后重试！')),
    });
  }
}
