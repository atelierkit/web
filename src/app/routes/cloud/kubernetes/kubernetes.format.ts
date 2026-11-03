/**
 * Kubernetes 页面的文案与格式转换
 *
 * 注：抽成独立模块而不是写在组件里，是为了能在单元测试里直接覆盖 ——
 * 组件文件 import 了 `SHARED_IMPORTS`，测试一旦加载它就会把整片页面模块带进覆盖率分母
 * （实测全局语句覆盖率会从 92% 掉到 72%），而这里的取值规则恰好最需要被钉住
 */

/**
 * 状态 → 文案与标签色
 *
 * 注 1：Pod 的 `CrashLoopBackOff` / `ImagePullBackOff` 这类容器级原因**不翻译** ——
 * 原文才是社区与文档里的通用说法，翻成中文反而搜不到
 * 注 2：文案与颜色同源于此表，表格的 tag 列与其它展示都从这里取，避免两处口径漂移
 */
export const STATUS_TAG: Record<string, { text: string; color: string }> = {
  Running: { text: '运行中', color: 'green' },
  Pending: { text: '等待中', color: 'gold' },
  Succeeded: { text: '已完成', color: 'blue' },
  Failed: { text: '失败', color: 'red' },
  Unknown: { text: '未知', color: 'default' },
  Terminating: { text: '终止中', color: 'gold' },
  Completed: { text: '已完成', color: 'blue' },
  Ready: { text: '就绪', color: 'green' },
  NotReady: { text: '未就绪', color: 'red' },
  SchedulingDisabled: { text: '禁止调度', color: 'gold' },
  Active: { text: '活跃', color: 'green' },
  // 注：容器级的常见故障原因，颜色都按「要看一眼」处理
  CrashLoopBackOff: { text: 'CrashLoopBackOff', color: 'red' },
  ImagePullBackOff: { text: 'ImagePullBackOff', color: 'red' },
  ErrImagePull: { text: 'ErrImagePull', color: 'red' },
  ContainerCreating: { text: 'ContainerCreating', color: 'gold' },
  Evicted: { text: 'Evicted', color: 'red' },
  OOMKilled: { text: 'OOMKilled', color: 'red' },
};

/**
 * 状态 → 中文文案
 *
 * @param status 集群返回的状态
 * @returns 展示文案，注：未收录的原样显示
 */
export function statusText(status: string): string {
  return STATUS_TAG[status]?.text ?? (status || '-');
}

/**
 * 状态 → 标签颜色
 *
 * @param status 集群返回的状态
 * @returns ng-zorro 的标签色名
 */
export function statusColor(status: string): string {
  return STATUS_TAG[status]?.color ?? 'default';
}

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
 * CPU 核数 → 展示文本
 *
 * @param cores 核数，注：来自节点 `capacity.cpu`，可能是 0.5 这种
 * @returns 如 `4 核` / `2.5 核`
 */
export function cpuText(cores: number): string {
  if (!Number.isFinite(cores) || cores <= 0) {
    return '0 核';
  }
  // 注：整数不带小数（`4 核` 比 `4.0 核` 自然），小数保留一位
  return `${Number.isInteger(cores) ? cores : cores.toFixed(1)} 核`;
}

/**
 * ISO 时间字符串 → 本地时间文本
 *
 * @param value ISO 字符串
 * @returns `YYYY-MM-DD HH:mm:ss`，空值 / 解析不了的值给 `-`
 */
export function isoTextOf(value: string): string {
  if (!value || value.startsWith('0001-')) {
    return '-';
  }
  /** 毫秒时间戳 */
  const time = Date.parse(value);
  if (Number.isNaN(time)) {
    return '-';
  }
  /** 时间对象 */
  const date = new Date(time);
  /**
   * 补零
   *
   * @param part 数字
   * @returns 两位文本
   */
  const pad = (part: number): string => String(part).padStart(2, '0');
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  ].join(' ');
}

/**
 * 鉴权方式 → 展示文案
 *
 * @param authMode 后端判定的鉴权方式
 * @returns 展示文案
 */
export function authText(authMode: string): string {
  if (authMode === 'token') {
    return 'ServiceAccount Token';
  }
  if (authMode === 'cert') {
    return '客户端证书';
  }
  if (authMode === 'anonymous') {
    return '匿名（无凭据）';
  }
  return authMode || '-';
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
 * 角色文本
 *
 * @param roles 逗号分隔的角色，注：没有角色标签的节点为空串
 * @returns 展示文案
 */
export function rolesText(roles: string): string {
  return roles || '-';
}
