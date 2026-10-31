/** 时间戳单位，注：本项目后端统一用毫秒，`s` 用于少数只给秒的外部接口 */
export type TimeUnit = 'ms' | 's';

/**
 * 时间戳格式化为 `yyyy-MM-dd HH:mm:ss`
 *
 * 注：不用 Angular 的 `formatDate` / `date` 管道 —— `formatDate` 依赖 LOCALE_ID 对应的 locale 数据已注册，
 * 而本项目 `@shared` 里的 `DatePipe` 是 ng-alain 的 `_date`（管道名不是 `date`）；这里只是纯数字格式化，
 * 手写反而没有依赖、结果也固定
 *
 * @param at 时间戳，缺省 / 0 / 负数一律视为「无」，返回空串
 * @param unit 时间戳单位，缺省毫秒
 * @returns 本地时区的展示文本
 */
export function formatDateTime(at?: number | null, unit: TimeUnit = 'ms'): string {
  if (!at || at <= 0) {
    return '';
  }
  /** 日期对象 */
  const date = new Date(unit === 's' ? at * 1000 : at);
  /**
   * 两位补零
   *
   * @param value 数值
   * @returns 补零后的字符串
   */
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
