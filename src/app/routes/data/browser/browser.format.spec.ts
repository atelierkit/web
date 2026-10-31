import { describe, expect, it } from 'vitest';

import {
  buildMonthGrid,
  buildYearGrid,
  nextSort,
  securitiesPageTotal,
  sortHint,
  toNumber,
} from './browser.format';
import type { CalendarDay } from '../data.service';

describe('browser.format', () => {
  describe('buildMonthGrid', () => {
    it('三态：开市 / 有记录休市 / 无记录（未同步）', () => {
      // 2026-01 有 1 号开市、2 号休市（有记录）、3 号无记录
      const days: CalendarDay[] = [
        { calendarDate: '2026-01-01', isOpen: true },
        { calendarDate: '2026-01-02', isOpen: false },
      ];
      const cells = buildMonthGrid(2026, 1, days);

      // 2026-01-01 是周四（2026-01-01 = Thursday），前导 4 格（周日~周三）
      // 找到 1 号、2 号、3 号格
      const cell1 = cells.find((c) => c.date === '2026-01-01')!;
      const cell2 = cells.find((c) => c.date === '2026-01-02')!;
      const cell3 = cells.find((c) => c.date === '2026-01-03')!;

      expect(cell1.state).toBe('open');
      expect(cell2.state).toBe('closed');
      expect(cell3.state).toBe('unsynced'); // 无记录 ≠ 休市
    });

    it('恒 42 格，前导空格 state=null', () => {
      const cells = buildMonthGrid(2026, 1, []);
      expect(cells).toHaveLength(42);
      // 2026-01-01 是周四，前导 4 格（周日=0 到 周三=3）
      const lead = new Date(Date.UTC(2026, 0, 1)).getUTCDay();
      for (let i = 0; i < lead; i++) {
        expect(cells[i].state).toBeNull();
        expect(cells[i].day).toBe(0);
      }
    });

    it('只统计当月有记录的天，其他月份的天不影响本网格', () => {
      const days: CalendarDay[] = [
        { calendarDate: '2026-01-05', isOpen: true },
        { calendarDate: '2026-02-01', isOpen: true }, // 别的月
      ];
      const cells = buildMonthGrid(2026, 1, days);
      expect(cells.find((c) => c.date === '2026-02-01')).toBeUndefined();
      expect(cells.find((c) => c.date === '2026-01-05')!.state).toBe('open');
    });
  });

  describe('buildYearGrid', () => {
    it('12 个月，每月 42 格', () => {
      const grids = buildYearGrid(2026, []);
      expect(grids).toHaveLength(12);
      expect(grids[0].month).toBe(1);
      expect(grids[0].cells).toHaveLength(42);
      expect(grids[11].month).toBe(12);
    });
  });

  describe('nextSort / sortHint', () => {
    it('上市日期三态循环', () => {
      expect(nextSort(undefined)).toBe('CodeAsc');
      expect(nextSort('CodeAsc')).toBe('ListDateAsc');
      expect(nextSort('ListDateAsc')).toBe('ListDateDesc');
      expect(nextSort('ListDateDesc')).toBe('CodeAsc');
    });

    it('排序提示', () => {
      expect(sortHint('ListDateAsc')).toBe('上市日期升序');
      expect(sortHint('ListDateDesc')).toBe('上市日期降序');
      expect(sortHint('CodeAsc')).toBe('代码升序');
    });
  });

  describe('securitiesPageTotal', () => {
    it('有过滤时显示全市场总数', () => {
      expect(securitiesPageTotal(10, 5000, true)).toBe('共 10 只（全市场 5000 只）');
      expect(securitiesPageTotal(5000, 5000, false)).toBe('共 5000 只');
    });
  });

  describe('toNumber', () => {
    it('空值/非法值返回 null', () => {
      expect(toNumber(null)).toBeNull();
      expect(toNumber('')).toBeNull();
      expect(toNumber('abc')).toBeNull();
    });

    it('正常数值解析', () => {
      expect(toNumber('1.5')).toBe(1.5);
      expect(toNumber('-0.5')).toBe(-0.5);
    });
  });
});
