import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { SHARED_IMPORTS } from '@shared';

import { DataService, type CalendarDay } from '../../data.service';
import { buildYearGrid, type MonthGrid } from '../browser.format';

/**
 * 交易日历页签（年视图）
 *
 * ⚠ 三态（开市 / 有记录休市 / 无记录=未同步）无法用 `nz-date-picker` 表达 ——
 * picker 分不清「休市」与「日历没同步」，因此 12 月卡 × 42 格必须自绘。
 * 接口只返回存在的行，「无记录」就是「未同步，不是休市」。
 */
@Component({
  selector: 'data-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class DataCalendarComponent implements OnInit {
  private readonly dataSrv = inject(DataService);

  /** 当前年份 */
  readonly year = signal(new Date().getFullYear());
  /** 月份网格 */
  readonly months = signal<MonthGrid[]>([]);
  /** 加载标记 */
  readonly loading = signal(true);
  /** 失败原因 */
  readonly failed = signal('');
  /** 星期表头 */
  readonly weekdays = ['日', '一', '二', '三', '四', '五', '六'];

  /** 页面初始化 */
  ngOnInit(): void {
    this.load();
  }

  /** 加载某年 */
  load(): void {
    this.loading.set(true);
    this.failed.set('');
    this.dataSrv.calendar(String(this.year())).subscribe({
      next: (days: CalendarDay[]) => {
        this.months.set(buildYearGrid(this.year(), days));
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.failed.set(err instanceof Error ? err.message : '加载日历失败');
      },
    });
  }

  /** 上一年 */
  prevYear(): void {
    this.year.update((y) => y - 1);
    this.load();
  }

  /** 下一年 */
  nextYear(): void {
    this.year.update((y) => y + 1);
    this.load();
  }

  /** 回到今年 */
  toCurrentYear(): void {
    this.year.set(new Date().getFullYear());
    this.load();
  }
}
