/** 设备标识在本地存储中的键 */
const DEVICE_KEY = 'atelierkit.device';

/**
 * 读取（必要时生成）当前设备的标识
 *
 * 注 1：后端按该标识划分会话，同一设备重复登录只保留一个令牌，不同设备互不影响
 * 注 2：标识只在本机生成，不含任何硬件指纹；清空浏览器数据会换出一个新标识，
 * 旧会话按有效期自然回收（长期有效的令牌需在「令牌管理」页手动作废）
 * 注 3：存储不可用（隐私模式、存储被禁用）时返回空串，后端会归入统一分组，
 * 表现为「所有设备共用一个会话」，而不是直接登录失败
 *
 * @returns 设备标识，存储不可用时为空串
 */
export function getDeviceId(): string {
  try {
    /** 已保存的标识 */
    const saved = localStorage.getItem(DEVICE_KEY);
    if (saved) {
      return saved;
    }
    /** 新生成的标识 */
    const value = randomId();
    localStorage.setItem(DEVICE_KEY, value);
    return value;
  } catch {
    return '';
  }
}

/**
 * 生成设备标识
 *
 * 注：优先用 `crypto.randomUUID`（仅安全上下文可用：https 或 localhost），
 * 不可用时退到「时间戳 + 随机串」，两者都在后端允许的 `[A-Za-z0-9_-]{8,64}` 范围内
 *
 * @returns 设备标识
 */
function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
