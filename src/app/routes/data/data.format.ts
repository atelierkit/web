import type { STColumnTag } from '@delon/abc/st';

/**
 * 行情数据页面用到的纯逻辑
 *
 * 注：抽成独立模块而不是写在组件里，是为了能在单元测试里直接覆盖 —— 组件文件 import 了
 * `SHARED_IMPORTS`，测试一旦加载它就会把整片页面模块带进覆盖率分母（实测全局语句覆盖率会掉十几个点）。
 */

/** 同步目标（与后端 SYNC_TARGET 对齐） */
export type DataTarget = 'Security' | 'Calendar' | 'BarByDate' | 'AdjustFactor';

/** 同步状态（与后端 SYNC_STATE 对齐） */
export const DATA_STATE = {
  DRAFT: 0,
  QUEUED: 1,
  RUNNING: 2,
  SUCCEEDED: 3,
  FAILED: 4,
  SKIPPED: 5,
  PAUSED: 6,
} as const;
export type DataState = (typeof DATA_STATE)[keyof typeof DATA_STATE];

/** 快照里的一张卡 */
export interface DataCard {
  /** 目标 */
  target: DataTarget;
  /** 展示名 */
  displayName: string;
  /** 已同步至 */
  lastDate: string | null;
  /** 记录数 */
  recordCount: number;
  /** 最近一次执行状态（无历史为 null） */
  state: DataState | null;
}

/** 进度量纲（「剩余 N 只 / N 天」的那个字） */
export function progressUnitOf(target: DataTarget): string {
  switch (target) {
    case 'Security':
      return '只';
    case 'Calendar':
    case 'BarByDate':
    case 'AdjustFactor':
      return '天';
    default:
      // ⚠ 失败分支抛错而不是兜底：漏配新类型时当场暴露，而不是显示「剩余 N 天」这种读得通但错的文案
      throw new Error(`未知的同步目标：${target}。`);
  }
}

/** 状态 → 展示文案 */
export function stateText(state: DataState | null): string {
  switch (state) {
    case DATA_STATE.DRAFT:
      return '草稿';
    case DATA_STATE.QUEUED:
      return '排队中';
    case DATA_STATE.RUNNING:
      return '执行中';
    case DATA_STATE.SUCCEEDED:
      return '成功';
    case DATA_STATE.FAILED:
      return '失败';
    case DATA_STATE.SKIPPED:
      return '已跳过';
    case DATA_STATE.PAUSED:
      return '已暂停';
    default:
      return '未同步';
  }
}

/**
 * 状态 → 徽标颜色
 *
 * ⚠ 六态 vs zorro 五色：桌面端状态有六种，ng-zorro 语义色只有五种
 * （default/processing/success/error/warning），有一态必须用自定义色，
 * 不许把两态合并 —— 合并后「排队」与「已跳过」看起来一样，语义就丢了。
 * 这里「未同步」用 default、「已跳过」用自定义色（#8c8c8c 灰）区分。
 */
export function stateTag(state: DataState | null): STColumnTag[keyof STColumnTag] {
  switch (state) {
    case DATA_STATE.QUEUED:
      return { text: '排队中', color: 'processing' };
    case DATA_STATE.RUNNING:
      return { text: '执行中', color: 'processing' };
    case DATA_STATE.SUCCEEDED:
      return { text: '成功', color: 'success' };
    case DATA_STATE.FAILED:
      return { text: '失败', color: 'error' };
    case DATA_STATE.SKIPPED:
      return { text: '已跳过', color: 'default' };
    case DATA_STATE.PAUSED:
      return { text: '已暂停', color: 'warning' };
    default:
      return { text: '未同步', color: 'default' };
  }
}

/**
 * 预计完成时间（一条公式：本批耗时 ÷ Fact.Units × 剩余量）
 *
 * ⚠ Fact 不落库 ⇒ 重进页面时「最近一批」与「预计完成时间」必须一起为空。
 */
export function estimateText(
  elapsedMs: number,
  factUnits: number,
  remaining: number,
): string | null {
  if (elapsedMs <= 0 || factUnits <= 0 || remaining <= 0) {
    return null;
  }
  const totalMs = (elapsedMs / factUnits) * remaining;
  const totalSeconds = Math.ceil(totalMs / 1000);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // 四档格式带秒：1天7小时18分14秒 / 20小时26分58秒 / 9分56秒 / 18秒
  if (days > 0) {
    return `${days}天${hours}小时${minutes}分${seconds}秒`;
  }
  if (hours > 0) {
    return `${hours}小时${minutes}分${seconds}秒`;
  }
  if (minutes > 0) {
    return `${minutes}分${seconds}秒`;
  }
  return `${seconds}秒`;
}

/** 数字缩写（记录数可能上亿，缩写为 1.2 亿 / 3,456 万 / 4,300 万） */
export function countText(count: number): string {
  if (count >= 100_000_000) {
    const yi = count / 100_000_000;
    return `${yi >= 10 ? yi.toFixed(0) : yi.toFixed(1)} 亿`;
  }
  if (count >= 10_000) {
    const wan = count / 10_000;
    return `${wan >= 10 ? wan.toFixed(0) : wan.toFixed(1)} 万`;
  }
  return count.toLocaleString();
}

/** 涨跌三色（A 股约定：涨红跌绿）—— 返回 CSS 类名，颜色在 theme.less 变量里 */
export function changeColorClass(changePercent: number | null): string {
  if (changePercent === null) {
    return 'market-flat';
  }
  if (changePercent > 0) {
    return 'market-up';
  }
  if (changePercent < 0) {
    return 'market-down';
  }
  return 'market-flat';
}

/** 涨跌幅格式化（+1.23% / -0.45% / 0.00%） */
export function changePercentText(changePercent: number | null): string {
  if (changePercent === null) {
    return '-';
  }
  const sign = changePercent > 0 ? '+' : '';
  return `${sign}${changePercent.toFixed(2)}%`;
}
