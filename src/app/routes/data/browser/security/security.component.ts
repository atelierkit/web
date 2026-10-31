import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import type { STChange, STColumn, STPage } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';

import { DataService, type SecurityQuery, type SecurityRow } from '../../data.service';
import {
  SECURITY_MARKET_TAGS,
  SECURITY_STATUS_TAGS,
  SECURITY_TYPE_TAGS,
  nextSort,
  securitiesPageTotal,
  sortHint,
} from '../browser.format';

/**
 * 证券清单页签（7 列 + 三态排序 + 服务端分页）
 */
@Component({
  selector: 'data-security',
  templateUrl: './security.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class DataSecurityComponent implements OnInit {
  private readonly dataSrv = inject(DataService);

  /** 证券清单 */
  readonly rows = signal<SecurityRow[]>([]);
  /** 加载标记 */
  readonly loading = signal(true);
  /** 失败原因 */
  readonly failed = signal('');
  /** 当前页码 */
  readonly pi = signal(1);
  /** 每页条数 */
  readonly ps = signal(50);
  /** 满足条件的总记录数 */
  readonly total = signal(0);
  /** 全市场总数 */
  readonly marketTotal = signal(0);
  /** 查询条件 */
  readonly query = signal<SecurityQuery>({});
  /** 是否有过滤条件（不含排序） */
  readonly hasFilter = signal(false);

  /** 排序档位 */
  readonly sort = signal<string>('CodeAsc');
  /** 排序提示 */
  readonly sortHint = sortHint;

  /** 列定义 */
  readonly columns: STColumn[] = [
    { title: '代码', index: 'code', width: 120 },
    { title: '名称', index: 'name', width: 140 },
    { title: '类型', index: 'type', width: 110, type: 'tag', tag: SECURITY_TYPE_TAGS },
    { title: '交易所', index: 'market', width: 90, type: 'tag', tag: SECURITY_MARKET_TAGS },
    {
      title: '上市日期',
      index: 'listDate',
      width: 120,
      format: (item: SecurityRow) => item.listDate ?? '—',
    },
    { title: '状态', index: 'status', width: 90, type: 'tag', tag: SECURITY_STATUS_TAGS },
    {
      title: '退市日期',
      index: 'delistDate',
      width: 120,
      format: (item: SecurityRow) => item.delistDate ?? '—',
    },
  ];

  /** 分页配置（服务端分页） */
  readonly page: STPage = {
    front: false,
    toTopOffset: 0,
    showSize: true,
    pageSizes: [20, 50, 100, 200],
  };

  /** 类型筛选选项 */
  readonly typeOptions = [
    { label: '股票', value: 'Stock' },
    { label: '指数', value: 'Index' },
    { label: '可转债', value: 'Bond' },
    { label: 'ETF/基金', value: 'Fund' },
  ];

  /** 交易所筛选选项 */
  readonly marketOptions = [
    { label: '上海', value: 'Shanghai' },
    { label: '深圳', value: 'Shenzhen' },
    { label: '北京', value: 'Beijing' },
  ];

  /** 页面初始化 */
  ngOnInit(): void {
    this.load();
  }

  /** 加载当前页 */
  load(): void {
    this.loading.set(true);
    this.failed.set('');
    const q = this.query();
    this.hasFilter.set(!!(q.keyword?.trim() || q.type || q.market));
    this.dataSrv
      .securities({
        ...q,
        sort: this.sort(),
        page: this.pi(),
        size: this.ps(),
      })
      .subscribe({
        next: (res) => {
          this.rows.set(res.rows);
          this.total.set(res.total);
          this.marketTotal.set(res.marketTotal);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.failed.set(err instanceof Error ? err.message : '加载证券清单失败');
        },
      });
  }

  /** 关键字输入 */
  onKeyword(value: string): void {
    this.query.update((q) => ({ ...q, keyword: value }));
  }

  /** 类型筛选 */
  onType(value: string | null): void {
    this.query.update((q) => ({ ...q, type: value ?? undefined }));
  }

  /** 交易所筛选 */
  onMarket(value: string | null): void {
    this.query.update((q) => ({ ...q, market: value ?? undefined }));
  }

  /** 上市日期三态排序 */
  toggleSort(): void {
    this.sort.set(nextSort(this.sort()));
    this.pi.set(1);
    this.load();
  }

  /** 查询（回车/点按钮） */
  search(): void {
    this.pi.set(1);
    this.load();
  }

  /** 分页变化 */
  change(e: STChange): void {
    if (e.type === 'pi') {
      this.pi.set(e.pi);
      this.load();
    } else if (e.type === 'ps') {
      this.pi.set(1);
      this.ps.set(e.ps);
      this.load();
    }
  }

  /** 汇总文案 */
  get summaryText(): string {
    return securitiesPageTotal(this.total(), this.marketTotal(), this.hasFilter());
  }
}
