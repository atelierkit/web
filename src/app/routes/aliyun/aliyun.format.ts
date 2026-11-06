import type { STColumnTag } from '@delon/abc/st';

/** 一级标签页 */
export interface AliyunTab {
  /** 子路由路径 */
  path: string;
  /** 展示名 */
  title: string;
}

/** 一级标签页 */
export const ALIYUN_TABS: AliyunTab[] = [
  { path: 'ssl', title: '证书' },
  { path: 'order', title: '订单' },
  { path: 'contact', title: '联系人' },
];

/**
 * 由当前地址算出高亮的一级标签
 *
 * @param url 当前地址，形如 `/aliyun/3/order`
 * @returns 标签下标，注：认不出时回落到第一个（证书）
 */
export function tabIndexOf(url: string): number {
  /** 地址里的第三段（跳过 `aliyun` 与密钥ID） */
  const segment = url.split('/')[3] ?? '';
  /** 标签下标 */
  const index = ALIYUN_TABS.findIndex((item) => item.path === segment);
  return index < 0 ? 0 : index;
}

/** 证书状态标签，注：阿里云返回的是大写下划线枚举 */
export const CERT_STATUS_TAG: STColumnTag = {
  ISSUED: { text: '已签发', color: 'green' },
  WILLEXPIRED: { text: '即将到期', color: 'orange' },
  EXPIRED: { text: '已过期', color: 'red' },
  CHECKING: { text: '审核中', color: 'blue' },
  CHECKED_FAIL: { text: '审核失败', color: 'red' },
  PAYED: { text: '待申请', color: 'gold' },
  NOTACTIVATED: { text: '未激活', color: 'gray' },
  REVOKED: { text: '已吊销', color: 'red' },
  CLOSED: { text: '已关闭', color: 'gray' },
};

/** 订单状态标签，注：与证书状态共用一套枚举，但 `PAYED` 在订单页表示「额度未使用」 */
export const ORDER_STATUS_TAG: STColumnTag = {
  PAYED: { text: '待申请', color: 'gold' },
  CHECKING: { text: '审核中', color: 'blue' },
  ISSUED: { text: '已签发', color: 'green' },
  WILLEXPIRED: { text: '即将到期', color: 'orange' },
  EXPIRED: { text: '已过期', color: 'red' },
  CHECKED_FAIL: { text: '审核失败', color: 'red' },
  REVOKED: { text: '已吊销', color: 'red' },
  CLOSED: { text: '已关闭', color: 'gray' },
  NOTACTIVATED: { text: '未激活', color: 'gray' },
};

/** 证书来源标签 */
export const CERT_SOURCE_TAG: STColumnTag = {
  true: { text: '外部上传', color: 'blue' },
  false: { text: '阿里云签发', color: 'orange' },
};

/** 申请状态文案，注：`DescribeCertificateState` 的 `Type` */
export const STATE_TEXT: Record<string, string> = {
  payed: '待申请',
  domain_verify: '待域名验证',
  process: 'CA 审核中',
  certificate: '已签发',
  verify_fail: '审核失败',
  unknow: '状态未知',
};

/** 申请状态标签 */
export const STATE_TAG: STColumnTag = {
  payed: { text: '待申请', color: 'gold' },
  domain_verify: { text: '待验证', color: 'blue' },
  process: { text: '审核中', color: 'orange' },
  certificate: { text: '已签发', color: 'green' },
  verify_fail: { text: '审核失败', color: 'red' },
  unknow: { text: '未知', color: 'gray' },
};

/** DNS 探测状态标签 */
export const DNS_STATUS_TAG: STColumnTag = {
  pending: { text: '本地未查到', color: 'gold' },
  matched: { text: '已生效', color: 'green' },
  mismatched: { text: '值不匹配', color: 'red' },
  unknown: { text: '查询失败', color: 'gray' },
};

/** DNS 探测状态说明，注：`pending` 不等于验证失败，文案要留出传播中的余地 */
export const DNS_STATUS_TEXT: Record<string, string> = {
  pending: '本地 DNS 暂未查到该记录，可能仍在传播中（通常几分钟内生效）',
  matched: '本地 DNS 已能查到该记录，可等待 CA 审核',
  mismatched: '已存在同名记录但值不同，请核对后修改',
  unknown: '本地 DNS 查询失败，请到域名服务商处手动确认',
};

/**
 * 手机号脱敏
 *
 * @param phone 手机号
 * @returns 形如 `136****8697`，长度不足时原样返回
 */
export function maskPhone(phone?: string): string {
  /** 去空白后的号码 */
  const value = (phone ?? '').trim();
  if (value.length < 7) {
    return value;
  }
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}

/**
 * 邮箱脱敏
 *
 * @param email 邮箱
 * @returns 形如 `ma***@163.com`，没有 `@` 时原样返回
 */
export function maskEmail(email?: string): string {
  /** 去空白后的邮箱 */
  const value = (email ?? '').trim();
  /** `@` 的位置 */
  const at = value.indexOf('@');
  if (at <= 0) {
    return value;
  }
  /** 保留前两位 */
  const head = value.slice(0, Math.min(2, at));
  return `${head}***${value.slice(at)}`;
}

/**
 * 订单是否还能用来申请证书
 *
 * 注：只有「待申请」且域名还没占用的额度单才能提交 —— 每张订单只能申请一次，
 * 提交后状态会离开 `payed`，再次申请会被阿里云拒
 *
 * @param order 订单行
 * @returns 可申请时为 true
 */
export function canApply(order: { status?: string; domain?: string }): boolean {
  return order.status === 'PAYED' && (order.domain ?? '').trim() === '';
}

/**
 * 订单是否还能取消
 *
 * @param order 订单行
 * @returns 待申请 / 待验证状态下可取消
 */
export function canCancel(order: { status?: string }): boolean {
  return order.status === 'PAYED' || order.status === 'CHECKING';
}

/**
 * 格式化时间用于展示
 *
 * @param value ISO 8601 字符串
 * @returns `yyyy-MM-dd`，无法解析时为空串
 */
export function dateOf(value?: string): string {
  if (!value) {
    return '';
  }
  /** 时间戳 */
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : '';
}

/**
 * 判断证书是否临近到期
 *
 * @param endAt 到期时间（ISO）
 * @param days 提前天数，缺省 30
 * @returns 在 `days` 天内到期（含已过期）时为 true
 */
export function willExpire(endAt?: string, days: number = 30): boolean {
  if (!endAt) {
    return false;
  }
  /** 到期时刻 */
  const end = Date.parse(endAt);
  if (!Number.isFinite(end)) {
    return false;
  }
  return end - Date.now() < days * 24 * 60 * 60 * 1000;
}
