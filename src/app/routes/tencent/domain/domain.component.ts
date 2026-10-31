import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { apiErrorMessage } from '@core';
import type { STChange, STColumn, STData, STPage } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';

import { DOMAIN_GRADE_TAG, DOMAIN_STATUS_TAG, businessError } from '../tencent.format';
import { TencentDomain, TencentService } from '../tencent.service';
import { TencentDomainEditComponent, type DomainEditData } from './edit/edit.component';

/**
 * 域名解析组件
 *
 * 注：列表总数取 `DomainCountInfo.DomainTotal` —— 腾讯云的 `DescribeDomainList` **没有**顶层
 * `TotalCount`，旧私有项目取 `res.TotalCount` 恒为 undefined，分页器一直是 0 条
 */
@Component({
  selector: 'tencent-domain',
  templateUrl: './domain.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class TencentDomainComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tencentSrv = inject(TencentService);
  private readonly modalSrv = inject(NzModalService);
  private readonly msgSrv = inject(NzMessageService);

  /** 密钥ID */
  readonly keyId = Number(this.route.parent?.snapshot.params['id']);
  /** 域名清单 */
  readonly data = signal<TencentDomain[]>([]);
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
    { title: '域名ID', index: 'DomainId', width: 120 },
    { title: '域名', index: 'Name', width: 200 },
    {
      title: '状态',
      index: 'Status',
      type: 'tag',
      width: 100,
      tag: DOMAIN_STATUS_TAG,
    },
    {
      title: '等级',
      index: 'Grade',
      type: 'tag',
      width: 110,
      tag: DOMAIN_GRADE_TAG,
    },
    { title: '套餐', index: 'GradeTitle', width: 120 },
    { title: '解析记录', index: 'RecordCount', width: 100 },
    {
      title: '创建时间',
      index: 'CreatedOn',
      width: 180,
      sort: { compare: (a, b) => String(a['CreatedOn']).localeCompare(String(b['CreatedOn'])) },
    },
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
      width: 200,
      buttons: [
        {
          text: 'DNS 记录',
          type: 'link',
          icon: 'bars',
          click: (record: STData) => this.dns(record as TencentDomain),
        },
        {
          text: '编辑备注',
          type: 'link',
          icon: 'edit',
          click: (record: STData) => this.remark(record as TencentDomain),
        },
      ],
    },
  ];

  /** 页面初始化 */
  ngOnInit(): void {
    this.fresh();
  }

  /** 加载域名清单 */
  fresh(): void {
    this.loading.set(true);
    this.tencentSrv.domainList(this.keyId, (this.pi() - 1) * this.ps(), this.ps()).subscribe({
      next: (res) => {
        /** 业务错误 */
        const message = businessError(res);
        if (message) {
          this.loading.set(false);
          this.msgSrv.error(message);
          return;
        }
        this.data.set(res.DomainList ?? []);
        this.total.set(res.DomainCountInfo?.DomainTotal ?? 0);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.msgSrv.error(apiErrorMessage(err, '加载域名列表失败，请稍后重试！'));
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
   * 进入某域名的解析记录
   *
   * @param record 域名
   */
  dns(record: TencentDomain): void {
    void this.router.navigate([
      '/tencent',
      this.keyId,
      'dns',
      record.Grade ?? '',
      record.Name ?? '',
    ]);
  }

  /**
   * 打开备注弹窗
   *
   * @param record 域名
   */
  remark(record: TencentDomain): void {
    this.modalSrv
      .create<TencentDomainEditComponent, DomainEditData, boolean>({
        nzContent: TencentDomainEditComponent,
        nzData: {
          keyId: this.keyId,
          domain: record.Name ?? '',
          remark: record.Remark ?? '',
        },
        nzTitle: '修改域名备注',
        nzFooter: null,
        nzWidth: 560,
      })
      .afterClose.subscribe((saved) => {
        if (saved) {
          this.fresh();
        }
      });
  }
}
