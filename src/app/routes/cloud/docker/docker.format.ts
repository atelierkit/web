/**
 * Docker 页面的文案与格式转换
 *
 * 注：抽成独立模块而不是写在组件里，是为了能在单元测试里直接覆盖 ——
 * 组件文件 import 了 `SHARED_IMPORTS`，测试一旦加载它就会把整片页面模块带进覆盖率分母
 * （实测全局语句覆盖率会从 92% 掉到 72%），而这里的取值规则恰好最需要被钉住
 */

/**
 * 容器状态 → 文案与标签色
 *
 * 注：文案与颜色同源于此表，表格的 tag 列与其它展示都从这里取，避免两处口径漂移
 */
export const STATE_TAG: Record<string, { text: string; color: string }> = {
  running: { text: '运行中', color: 'green' },
  exited: { text: '已停止', color: 'default' },
  paused: { text: '已暂停', color: 'gold' },
  restarting: { text: '重启中', color: 'gold' },
  created: { text: '已创建', color: 'blue' },
  removing: { text: '删除中', color: 'gold' },
  dead: { text: '异常', color: 'red' },
};

/**
 * 字节数 → 可读体积
 *
 * @param size 字节数
 * @returns 如 `1.5 GB`，0 或非法值给 `0 B`
 */
export function bytesText(size: number): string {
  if (!Number.isFinite(size) || size <= 0) {
    return '0 B';
  }
  /** 单位表 */
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  /** 当前数值 */
  let value = size;
  /** 当前单位下标 */
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  // 注：字节数不带小数（`1.0 B` 很怪），其余保留一位
  return index === 0 ? `${Math.round(value)} B` : `${value.toFixed(1)} ${units[index]}`;
}

/**
 * 秒级时间戳 → 本地时间文本
 *
 * @param seconds 秒级时间戳
 * @returns `YYYY-MM-DD HH:mm:ss`，0 或非法值给 `-`
 */
export function timeTextOf(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '-';
  }
  return dateTextOf(new Date(seconds * 1000));
}

/**
 * ISO 时间字符串 → 本地时间文本
 *
 * @param value ISO 字符串，注：Docker 的空时间是 `0001-01-01T00:00:00Z`
 * @returns `YYYY-MM-DD HH:mm:ss`，空值 / 零值给 `-`，解析不了的原样返回
 */
export function isoTextOf(value: string): string {
  if (!value || value.startsWith('0001-')) {
    return '-';
  }
  /** 毫秒时间戳 */
  const time = Date.parse(value);
  if (Number.isNaN(time)) {
    return value;
  }
  return dateTextOf(new Date(time));
}

/**
 * 容器状态 → 中文文案
 *
 * @param state daemon 返回的 State
 * @returns 展示文案
 */
export function stateText(state: string): string {
  return STATE_TAG[state]?.text ?? (state || '-');
}

/**
 * 容器状态 → 标签颜色
 *
 * @param state daemon 返回的 State
 * @returns ng-zorro 的标签色名
 */
export function stateColor(state: string): string {
  return STATE_TAG[state]?.color ?? 'default';
}

/**
 * 协议 → 展示文案
 *
 * @param protocol `http` / `https`
 * @returns 展示文案
 */
export function protocolText(protocol: string): string {
  if (protocol === 'https') {
    return 'https（加密）';
  }
  if (protocol === 'http') {
    return 'http（明文）';
  }
  return protocol || '-';
}

/**
 * 证书校验开关 → 展示文案
 *
 * @param verify 是否校验证书链
 * @returns 展示文案
 */
export function verifyText(verify: boolean): string {
  return verify ? '校验' : '不校验';
}

/**
 * 时间 → 本地时间文本
 *
 * @param date 时间对象
 * @returns `YYYY-MM-DD HH:mm:ss`
 */
function dateTextOf(date: Date): string {
  /**
   * 补零
   *
   * @param value 数字
   * @returns 两位文本
   */
  const pad = (value: number): string => String(value).padStart(2, '0');
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  ].join(' ');
}
