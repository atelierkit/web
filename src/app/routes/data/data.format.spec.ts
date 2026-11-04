import { describe, expect, it } from 'vitest';

import {
  changeColorClass,
  changePercentText,
  countText,
  estimateText,
  isActiveState,
  percentOf,
  progressTextOf,
  progressUnitOf,
  runningCardOf,
  stateTag,
  stateText,
  timeTextOf,
  DATA_STATE,
  type DataCard,
} from './data.format';

describe('data.format', () => {
  describe('percentOf', () => {
    it('四舍五入到整数百分比', () => {
      expect(percentOf(5, 10)).toBe(50);
      expect(percentOf(1, 3)).toBe(33);
      expect(percentOf(10, 10)).toBe(100);
    });

    it('总量未知或为 0 时给 0（不显示假进度）', () => {
      expect(percentOf(5, 0)).toBe(0);
      expect(percentOf(0, 0)).toBe(0);
      expect(percentOf(5, -1)).toBe(0);
    });

    it('越界不超过 100', () => {
      expect(percentOf(15, 10)).toBe(100);
    });
  });

  describe('timeTextOf', () => {
    it('ISO 串按本地时区格式化为 YYYY-MM-DD HH:mm:ss（带年份，跨年不会误读）', () => {
      // 用本地时间构造，避免测试机时区不同导致断言漂移
      const local = new Date(2026, 0, 5, 9, 8, 7);
      expect(timeTextOf(local.toISOString())).toBe('2026-01-05 09:08:07');
    });

    it('空值与非法值返回空串（模板据此整行不显示）', () => {
      expect(timeTextOf(null)).toBe('');
      expect(timeTextOf(undefined)).toBe('');
      expect(timeTextOf('')).toBe('');
      expect(timeTextOf('not-a-date')).toBe('');
    });
  });

  describe('progressTextOf', () => {
    it('带分母时给 `百分比（已完成 / 总量）`', () => {
      expect(progressTextOf(5, 10)).toBe('50%（5 / 10）');
      expect(progressTextOf(10, 10)).toBe('100%（10 / 10）');
    });

    it('总量未知时只给百分比，不编造分母', () => {
      expect(progressTextOf(5, 0)).toBe('0%');
      expect(progressTextOf(0, 0)).toBe('0%');
    });
  });

  describe('isActiveState', () => {
    it('排队中 / 执行中算活跃（「继续」按钮据此禁用）', () => {
      expect(isActiveState(DATA_STATE.QUEUED)).toBe(true);
      expect(isActiveState(DATA_STATE.RUNNING)).toBe(true);
    });

    it('终态与未同步都不算活跃（含已暂停：暂停后要能重新点「继续」）', () => {
      expect(isActiveState(DATA_STATE.DRAFT)).toBe(false);
      expect(isActiveState(DATA_STATE.SUCCEEDED)).toBe(false);
      expect(isActiveState(DATA_STATE.FAILED)).toBe(false);
      expect(isActiveState(DATA_STATE.SKIPPED)).toBe(false);
      expect(isActiveState(DATA_STATE.PAUSED)).toBe(false);
      expect(isActiveState(null)).toBe(false);
    });
  });

  describe('runningCardOf', () => {
    const cardOf = (target: DataCard['target'], state: DataCard['state']): DataCard => ({
      target,
      displayName: target,
      lastDate: null,
      recordCount: 0,
      state,
    });

    it('只挑执行中的那一张（终态、排队、未同步都不算）', () => {
      const cards = [
        cardOf('Security', DATA_STATE.SUCCEEDED),
        cardOf('Calendar', DATA_STATE.RUNNING),
        cardOf('BarByDate', DATA_STATE.QUEUED),
        cardOf('AdjustFactor', null),
      ];
      expect(runningCardOf(cards)?.target).toBe('Calendar');
    });

    it('没有执行中的任务时返回 null（页面据此显示「当前无任务执行」）', () => {
      expect(runningCardOf([])).toBeNull();
      expect(
        runningCardOf([
          cardOf('Security', DATA_STATE.FAILED),
          cardOf('Calendar', DATA_STATE.PAUSED),
        ]),
      ).toBeNull();
    });

    it('多卡同时执行时按顺序取第一条（只显示一条进度条）', () => {
      const cards = [
        cardOf('Security', DATA_STATE.RUNNING),
        cardOf('Calendar', DATA_STATE.RUNNING),
      ];
      expect(runningCardOf(cards)?.target).toBe('Security');
    });
  });

  describe('progressUnitOf', () => {
    it('证券 = 只，日历/按交易日 = 天', () => {
      expect(progressUnitOf('Security')).toBe('只');
      expect(progressUnitOf('Calendar')).toBe('天');
      expect(progressUnitOf('BarByDate')).toBe('天');
      expect(progressUnitOf('AdjustFactor')).toBe('天');
    });

    it('未知目标抛错', () => {
      expect(() => progressUnitOf('Unknown' as never)).toThrow();
    });
  });

  describe('stateText / stateTag', () => {
    it('状态文案正确', () => {
      expect(stateText(null)).toBe('未同步');
      expect(stateText(DATA_STATE.QUEUED)).toBe('排队中');
      expect(stateText(DATA_STATE.RUNNING)).toBe('执行中');
      expect(stateText(DATA_STATE.SUCCEEDED)).toBe('成功');
      expect(stateText(DATA_STATE.FAILED)).toBe('失败');
      expect(stateText(DATA_STATE.SKIPPED)).toBe('已跳过');
      expect(stateText(DATA_STATE.PAUSED)).toBe('已暂停');
    });

    it('六态映射不合并：排队/执行中 processing，成功 success，失败 error，已跳过 default，暂停 warning', () => {
      expect(stateTag(DATA_STATE.QUEUED).color).toBe('processing');
      expect(stateTag(DATA_STATE.RUNNING).color).toBe('processing');
      expect(stateTag(DATA_STATE.SUCCEEDED).color).toBe('success');
      expect(stateTag(DATA_STATE.FAILED).color).toBe('error');
      expect(stateTag(DATA_STATE.SKIPPED).color).toBe('default');
      expect(stateTag(DATA_STATE.PAUSED).color).toBe('warning');
    });
  });

  describe('estimateText', () => {
    it('四档格式带秒', () => {
      // 1天7小时18分14秒
      expect(
        estimateText(1000, 1, Math.ceil(((1 * 86400 + 7 * 3600 + 18 * 60 + 14) * 1000) / 1000)),
      ).toBe('1天7小时18分14秒');
      // 20小时26分58秒
      expect(estimateText(1000, 1, 20 * 3600 + 26 * 60 + 58)).toBe('20小时26分58秒');
      // 9分56秒
      expect(estimateText(1000, 1, 9 * 60 + 56)).toBe('9分56秒');
      // 18秒
      expect(estimateText(1000, 1, 18)).toBe('18秒');
    });

    it('无输入返回 null（最近一批与预计完成时间同源，一起为空）', () => {
      expect(estimateText(0, 1, 10)).toBeNull();
      expect(estimateText(1000, 0, 10)).toBeNull();
      expect(estimateText(1000, 1, 0)).toBeNull();
    });
  });

  describe('countText', () => {
    it('亿/万/千缩写', () => {
      expect(countText(43000000)).toBe('4300 万');
      expect(countText(120000000)).toBe('1.2 亿');
      expect(countText(3456)).toBe('3,456');
    });
  });

  describe('changeColorClass / changePercentText', () => {
    it('涨红跌绿（A 股约定）', () => {
      expect(changeColorClass(1.5)).toBe('market-up');
      expect(changeColorClass(-0.5)).toBe('market-down');
      expect(changeColorClass(0)).toBe('market-flat');
      expect(changeColorClass(null)).toBe('market-flat');
    });

    it('涨跌幅格式化', () => {
      expect(changePercentText(1.5)).toBe('+1.50%');
      expect(changePercentText(-0.5)).toBe('-0.50%');
      expect(changePercentText(null)).toBe('-');
    });
  });
});
