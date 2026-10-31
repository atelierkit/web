import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import type { STColumn, STPage } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';

import { changeColorClass, changePercentText } from '../../data.format';
import { DataService, type BarRow } from '../../data.service';
import { TRADE_STATUS_TAGS, barCountText, toNumber } from '../browser.format';

/** K 线单次查询上限（与后端一致） */
const BAR_ROW_LIMIT = 5000;

/**
 * K 线页签（单只证券 + 日期区间，10 列，前端分页 500/页）
 *
 * ⚠ 原始不复权、只有日线；`truncated` 由服务端给出（超过 5000 根保留最近 5000 并警告）。
 */
@Component({
  selector: 'data-bar',
  templateUrl: './bar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class DataBarComponent implements OnInit {
  private readonly dataSrv = inject(DataService);

  /** 证券代码 */
  readonly code = signal('');
  /** 起始日期 */
  readonly from = signal('');
  /** 结束日期 */
  readonly to = signal('');
  /** K 线数据 */
  readonly rows = signal<BarRow[]>([]);
  /** 加载标记 */
  readonly loading = signal(false);
  /** 失败原因 */
  readonly failed = signal('');
  /** 是否已查询过 */
  readonly queried = signal(false);
  /** 是否被截断 */
  readonly truncated = signal(false);
  /** 区间内总根数 */
  readonly total = signal(0);
  /** 前端分页每页条数 */
  readonly ps = signal(500);

  /** 涨跌色 class */
  readonly changeColorClass = changeColorClass;
  /** 涨跌幅文本 */
  readonly changePercentText = changePercentText;
  /** 根数格式化 */
  readonly barCountText = barCountText;

  /** 列定义 */
  readonly columns: STColumn[] = [
    { title: '日期', index: 'date', width: 110 },
    { title: '开', index: 'open', width: 90 },
    { title: '高', index: 'high', width: 90 },
    { title: '低', index: 'low', width: 90 },
    { title: '收', index: 'close', width: 90 },
    {
      title: '涨跌幅',
      index: 'changePercent',
      width: 100,
      format: (item: BarRow) => {
        const n = toNumber(item.changePercent);
        return `<span class="${changeColorClass(n)}">${changePercentText(n)}</span>`;
      },
    },
    {
      title: '成交量',
      index: 'volume',
      width: 120,
      format: (item: BarRow) => barCountText(Number(item.volume ?? 0)),
    },
    {
      title: '成交额',
      index: 'amount',
      width: 140,
      format: (item: BarRow) => (item.amount === null ? '—' : barCountText(Number(item.amount))),
    },
    {
      title: '换手率',
      index: 'turnoverRate',
      width: 90,
      format: (item: BarRow) => (item.turnoverRate === null ? '—' : `${item.turnoverRate}%`),
    },
    { title: '状态', index: 'tradeStatus', width: 90, type: 'tag', tag: TRADE_STATUS_TAGS },
  ];

  /** 分页配置（前端分页，数据已在内存） */
  readonly page: STPage = {
    front: true,
    showSize: true,
    pageSizes: [500],
  };

  /** 快捷区间 */
  private readonly today = new Date();

  /** 页面初始化（填默认区间：近一年） */
  ngOnInit(): void {
    const to = this.today.toISOString().slice(0, 10);
    const from = new Date(this.today.getTime() - 365 * 86400000).toISOString().slice(0, 10);
    this.from.set(from);
    this.to.set(to);
  }

  /** 查询 */
  query(): void {
    const code = this.code().trim();
    if (!code) {
      this.failed.set('填一只证券的代码（形如 sh.600000）后点「查询」。');
      return;
    }
    if (this.from() > this.to()) {
      this.failed.set('起始日期不能晚于结束日期。');
      return;
    }

    this.loading.set(true);
    this.failed.set('');
    this.queried.set(true);
    this.dataSrv.bars(code, this.from(), this.to()).subscribe({
      next: (res) => {
        this.rows.set(res.rows);
        this.total.set(res.total);
        this.truncated.set(res.truncated);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.failed.set(err instanceof Error ? err.message : '加载 K 线失败');
      },
    });
  }

  /** 快捷区间：近一月 */
  quickMonth(): void {
    this.from.set(new Date(this.today.getTime() - 30 * 86400000).toISOString().slice(0, 10));
    this.to.set(this.today.toISOString().slice(0, 10));
  }

  /** 快捷区间：近一年 */
  quickYear(): void {
    this.from.set(new Date(this.today.getTime() - 365 * 86400000).toISOString().slice(0, 10));
    this.to.set(this.today.toISOString().slice(0, 10));
  }

  /** 快捷区间：全部（从上市起） */
  quickAll(): void {
    this.from.set('1990-01-01');
    this.to.set(this.today.toISOString().slice(0, 10));
  }

  /** 是否超过上限 */
  get isOverLimit(): boolean {
    return this.truncated();
  }

  /** 上限常量（模板展示用） */
  readonly barRowLimit = BAR_ROW_LIMIT;
}
