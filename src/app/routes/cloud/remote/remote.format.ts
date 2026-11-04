/**
 * 远程连接页面的文案与格式转换
 *
 * 注：抽成独立模块而不是写在组件里，是为了能在单元测试里直接覆盖 ——
 * 组件文件 import 了 `SHARED_IMPORTS`，测试一旦加载它就会把整片页面模块带进覆盖率分母
 * （实测全局语句覆盖率会从 92% 掉到 72%），而这里的取值规则恰好最需要被钉住
 */

import type { STColumnTag } from '@delon/abc/st';

import type { RemoteKeyInspect } from '../cloud.service';

/**
 * 鉴权方式 → 文案
 *
 * @param type `password` / `key`
 * @returns 展示文案
 */
export function authText(type: string): string {
  if (type === 'key') {
    return '私钥';
  }
  if (type === 'password') {
    return '密码';
  }
  return type || '-';
}

/**
 * 字符集 → 文案
 *
 * @param value 字符集
 * @returns 展示文案
 */
export function charsetText(value: string): string {
  return value === 'gb18030' ? 'GB18030' : 'UTF-8';
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
 * 秒数 → 运行时长
 *
 * @param seconds 秒数
 * @returns 如 `3 天 4 小时 5 分`，0 或非法值给 `-`
 */
export function uptimeText(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '-';
  }
  /** 总秒数 */
  const total = Math.floor(seconds);
  /** 天 */
  const days = Math.floor(total / 86400);
  /** 小时 */
  const hours = Math.floor((total % 86400) / 3600);
  /** 分 */
  const minutes = Math.floor((total % 3600) / 60);
  /** 片段 */
  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days} 天`);
  }
  if (days > 0 || hours > 0) {
    parts.push(`${hours} 小时`);
  }
  parts.push(`${minutes} 分`);
  return parts.join(' ');
}

/**
 * 内存使用率
 *
 * @param total 总量（字节）
 * @param available 可用（字节）
 * @returns 百分比整数，数据不全时给 0
 */
export function usagePercent(total: number, available: number): number {
  if (!(total > 0) || !(available >= 0)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(((total - available) / total) * 100)));
}

/**
 * 指纹缩写
 *
 * 注：完整指纹有 40+ 字符，列表里放不下；缩成 `SHA256:abc12345…xyz9` 既能辨识又好认，
 * 完整值在诊断弹窗与详情里展示
 *
 * @param fingerprint 完整指纹
 * @returns 缩写，空串时给 `未记录`
 */
export function fingerprintText(fingerprint: string): string {
  /** 去空白 */
  const value = (fingerprint ?? '').trim();
  if (value === '') {
    return '未记录';
  }
  /** 前缀与摘要 */
  const [prefix, digest = ''] = value.split(':');
  if (digest.length <= 16) {
    return value;
  }
  return `${prefix}:${digest.slice(0, 8)}…${digest.slice(-4)}`;
}

/**
 * 指纹是否已记录
 *
 * @param fingerprint 指纹
 * @returns 已记录时为 true
 */
export function trustedText(fingerprint: string): string {
  return (fingerprint ?? '').trim() === '' ? '未记录' : '已记录';
}

/**
 * 私钥格式 → 文案
 *
 * @param format 后端识别到的原始格式
 * @returns 展示文案
 */
export function keyFormatText(format: string): string {
  if (format === 'openssh') {
    return 'OpenSSH';
  }
  if (format === 'pkcs8') {
    return 'PKCS#8';
  }
  if (format === 'pem') {
    return 'PEM（传统格式）';
  }
  return format || '未知格式';
}

/**
 * 私钥预检结果 → 一句人话
 *
 * 注：指纹给的是**完整值**，不缩成 `SHA256:abc12345…xyz9` ——
 * 用户要拿它与本机 `ssh-keygen -l -f 私钥文件` 的输出逐字符对照
 *
 * @param info 后端预检结果
 * @returns 展示文案
 */
export function keyInspectText(info: RemoteKeyInspect): string {
  /** 片段，注：用分号串起来，一行能读完又不会糊成一片 */
  const parts = [`已识别为 ${keyFormatText(info.format)} 格式`];
  if (info.converted) {
    parts.push('保存时会自动转换成可用的 PEM 格式，无需手动处理');
  }
  parts.push(
    info.encrypted ? '该私钥带口令，请填写「私钥口令」' : '该私钥未设口令，口令一栏留空即可',
  );
  parts.push(`指纹 ${info.fingerprint}`);
  return `${parts.join('；')}。`;
}

/**
 * 状态标签
 *
 * 注：文案与颜色同源于此表，列定义与详情页都从这里取，避免两处口径漂移
 */
export const ENABLE_TAG: STColumnTag = {
  true: { text: '启用', color: 'green' },
  false: { text: '禁用', color: 'red' },
};

/**
 * 指纹标签
 */
export const TRUST_TAG: STColumnTag = {
  true: { text: '已记录', color: 'green' },
  false: { text: '未记录', color: 'gold' },
};

/**
 * 终端错误码 → 可读文案
 *
 * 注：错误码由后端下发（`REMOTE_ERROR_CODES`），文案放前端是为了让提示能带「下一步该做什么」；
 * 未登记的错误码原样带出 `message`，不要显示成「未知错误」把线索丢掉
 *
 * @param code 错误码
 * @param message 后端给的文案
 * @returns 展示文案
 */
export function errorTextOf(code: string, message = ''): string {
  /** 已登记的映射 */
  const known: Record<string, string> = {
    TICKET_INVALID: '会话票据无效，请重新连接。',
    TICKET_EXPIRED: '会话票据已过期（有效期 60 秒），请重新连接。',
    TICKET_USED: '会话票据已被使用，请重新连接。',
    TICKET_MISMATCH: '登录状态与票据不一致，请重新登录。',
    HOST_UNREACHABLE: '无法连接目标主机：请检查地址、端口与防火墙。',
    AUTH_FAILED: '认证失败：用户名、密码或私钥不正确。',
    HOST_KEY_CHANGED:
      '主机公钥已变化，为防中间人攻击已中断连接。确认是重装或换钥后可「信任新指纹」。',
    LIMIT_EXCEEDED: '终端会话数已达上限，请先关闭其他会话。',
    CHANNEL_CLOSED: '目标主机已断开终端通道。',
  };
  /** 映射文案 */
  const text = known[code];
  if (text !== undefined) {
    return text;
  }
  return message || '连接失败，请稍后重试。';
}

/**
 * 输入分片
 *
 * 注：一次粘贴几万字符时不能作为一帧发出去 —— socket.io 的 `maxHttpBufferSize` 会拒收整帧，
 * 表现为「粘贴没反应」且不报错
 *
 * @param text 待发送文本
 * @param size 单片上限（字符数）
 * @returns 分片清单
 */
export function chunksOf(text: string, size = 4096): string[] {
  if (text === '') {
    return [];
  }
  /** 分片清单 */
  const chunks: string[] = [];
  for (let offset = 0; offset < text.length; offset += size) {
    chunks.push(text.slice(offset, offset + size));
  }
  return chunks;
}
