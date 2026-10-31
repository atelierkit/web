import type { STColumnTag } from '@delon/abc/st';

import type { CalendarDay, SecurityRow } from '../data.service';

/**
 * 数据浏览页的纯逻辑
 *
 * 注：抽成独立模块以便单元测试覆盖（组件 import SHARED_IMPORTS 会把整片页面模块带进覆盖率分母）。
 */

/** 日历单元格的三态 */
export type CalendarCellState = 'open' | 'closed' | 'unsynced';

/** 日历网格里的一格 */
export interface CalendarCell {
  /** 日（1~31），非本月日为 0 */
  day: number;
  /** 状态 */
  state: CalendarCellState | null;
  /** 完整日期（YYYY-MM-DD），非本月日为 null */
  date: string | null;
}

/**
 * 把某月的日历日组织成 6 行 × 7 列（42 格）的网格
 *
 * ⚠ 三态判据：
 * - `open` = 该日有记录且 isOpen=true（开市）
 * - `closed` = 该日有记录且 isOpen=false（有记录休市）
 * - `unsynced` = 该日无记录（**未同步，不是休市** —— 接口只返回存在的行）
 * - 非本月日 = null（占位空格）
 *
 * 前导空格由「当月 1 号是星期几」决定（周日=0）。
 */
export function buildMonthGrid(year: number, month: number, days: CalendarDay[]): CalendarCell[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const lead = first.getUTCDay(); // 0=周日
  const total = 6 * 7;

  // 该月有记录的天：date → isOpen
  const map = new Map<string, boolean>();
  for (const d of days) {
    const parts = d.calendarDate.split('-');
    if (parts[0] === String(year) && parts[1] === String(month).padStart(2, '0')) {
      map.set(d.calendarDate, d.isOpen);
    }
  }

  const cells: CalendarCell[] = [];
  for (let i = 0; i < total; i++) {
    const dayNumber = i - lead + 1;
    if (dayNumber < 1) {
      cells.push({ day: 0, state: null, date: null });
      continue;
    }
    const dateStr = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
    // 超出当月天数（如 2 月 30 日）
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (dayNumber > lastDay) {
      cells.push({ day: 0, state: null, date: null });
      continue;
    }

    if (!map.has(dateStr)) {
      cells.push({ day: dayNumber, state: 'unsynced', date: dateStr });
    } else {
      cells.push({
        day: dayNumber,
        state: map.get(dateStr) ? 'open' : 'closed',
        date: dateStr,
      });
    }
  }
  return cells;
}

/** 12 个月的网格 */
export interface MonthGrid {
  /** 月份（1~12） */
  month: number;
  /** 中文月份名 */
  title: string;
  /** 42 格 */
  cells: CalendarCell[];
}

/** 构造某年 12 个月的网格 */
export function buildYearGrid(year: number, days: CalendarDay[]): MonthGrid[] {
  const names = [
    '一月',
    '二月',
    '三月',
    '四月',
    '五月',
    '六月',
    '七月',
    '八月',
    '九月',
    '十月',
    '十一月',
    '十二月',
  ];
  return names.map((title, i) => ({
    month: i + 1,
    title,
    cells: buildMonthGrid(year, i + 1, days),
  }));
}

/** 证券类型中文标签 */
export const SECURITY_TYPE_TAGS: STColumnTag = {
  Stock: { text: '股票', color: 'blue' },
  Index: { text: '指数', color: 'geekblue' },
  Bond: { text: '可转债', color: 'purple' },
  Fund: { text: 'ETF/基金', color: 'cyan' },
  Unknown: { text: '未知', color: 'default' },
};

/** 交易所中文标签 */
export const SECURITY_MARKET_TAGS: STColumnTag = {
  Shanghai: { text: '上海', color: 'blue' },
  Shenzhen: { text: '深圳', color: 'cyan' },
  Beijing: { text: '北京', color: 'geekblue' },
  Unknown: { text: '未知', color: 'default' },
};

/** 上市状态中文标签 */
export const SECURITY_STATUS_TAGS: STColumnTag = {
  Listed: { text: '上市', color: 'green' },
  Delisted: { text: '退市', color: 'red' },
  Suspended: { text: '暂停上市', color: 'orange' },
  Unknown: { text: '未知', color: 'default' },
};

/** 交易状态中文标签 */
export const TRADE_STATUS_TAGS: STColumnTag = {
  Normal: { text: '正常', color: 'green' },
  Suspended: { text: '停牌', color: 'orange' },
  Unknown: { text: '未知', color: 'default' },
};

/** 上市日期三态排序循环（点击表头循环切换） */
export function nextSort(current: string | undefined): string {
  switch (current) {
    case 'CodeAsc':
      return 'ListDateAsc';
    case 'ListDateAsc':
      return 'ListDateDesc';
    case 'ListDateDesc':
      return 'CodeAsc';
    default:
      return 'CodeAsc';
  }
}

/** 排序档位 → 表头提示文案 */
export function sortHint(sort: string | undefined): string {
  switch (sort) {
    case 'ListDateAsc':
      return '上市日期升序';
    case 'ListDateDesc':
      return '上市日期降序';
    default:
      return '代码升序';
  }
}

/** 证券列表分页条数 */
export function securitiesPageTotal(total: number, marketTotal: number, active: boolean): string {
  if (active) {
    return `共 ${total} 只（全市场 ${marketTotal} 只）`;
  }
  return `共 ${total} 只`;
}

/** K 线数量格式化（整数千分位） */
export function barCountText(count: number): string {
  return count.toLocaleString();
}

/** K 线涨跌幅取数值（字符串转 number，空值 null） */
export function toNumber(value: string | null): number | null {
  if (value === null || value.trim() === '') {
    return null;
  }
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

/** 证券行是否可「查看 K 线」（只有股票/指数有意义，实际浏览页 K 线页签是独立输入） */
export function securityDisplayType(row: SecurityRow): string {
  return SECURITY_TYPE_TAGS[row.type]?.text ?? row.type;
}
