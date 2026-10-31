import type { STColumnTag } from '@delon/abc/st';

import type { FirewallRule } from './tencent.service';

/** 一级标签页 */
export interface TencentTab {
  /** 子路由路径 */
  path: string;
  /** 展示名 */
  title: string;
}

/** 一级标签页，注：轻量服务器下的防火墙、域名下的 DNS 记录都是二级页面，不单独占标签 */
export const TENCENT_TABS: TencentTab[] = [
  { path: 'ssl', title: '证书' },
  { path: 'domain', title: '域名' },
  { path: 'lighthouse', title: '轻量服务器' },
];

/** 二级页面归属的一级标签，注：不登记就等于「进二级页面后没有高亮项」 */
const CHILD_TABS: Record<string, string> = {
  dns: 'domain',
  firewall: 'lighthouse',
};

/**
 * 由当前地址算出高亮的一级标签
 *
 * @param url 当前地址，形如 `/tencent/3/lighthouse/ap-guangzhou`
 * @returns 标签下标，注：认不出时回落到第一个（证书）
 */
export function tabIndexOf(url: string): number {
  /** 地址里的第三段（跳过 `tencent` 与密钥ID） */
  const segment = url.split('/')[3] ?? '';
  /** 归属的一级标签路径 */
  const path = CHILD_TABS[segment] ?? segment;
  /** 标签下标 */
  const index = TENCENT_TABS.findIndex((item) => item.path === path);
  return index < 0 ? 0 : index;
}

/**
 * 取腾讯云的业务错误说明
 *
 * 注：腾讯云的业务错误也是 HTTP 200，前端必须自己看 `Error`；成功时返回空串
 *
 * @param res 腾讯云响应
 * @returns 错误说明，无错误时为空串
 */
export function businessError(
  res?: { RequestId?: string; Error?: { Code?: string; Message?: string } } | null,
): string {
  if (!res) {
    return '接口没有返回内容，请稍后重试！';
  }
  if (!res.Error) {
    return '';
  }
  return res.Error.Message ?? '腾讯云接口调用失败！';
}

/**
 * 证书是否该显示「续期」
 *
 * @param endTime 到期时间（腾讯云给的 `yyyy-MM-dd HH:mm:ss`）
 * @param now 参照时间，缺省当前时间，注：可注入以便测试
 * @returns 到期时间在一个月内（含已过期）时为 true
 */
export function canRenew(endTime?: string, now: Date = new Date()): boolean {
  if (!endTime) {
    return false;
  }
  /** 到期时刻 */
  const end = new Date(endTime);
  if (Number.isNaN(end.getTime())) {
    return false;
  }
  /** 一个月后的时刻 */
  const monthLater = new Date(now);
  monthLater.setMonth(monthLater.getMonth() + 1);
  return end < monthLater;
}

/**
 * 把表格行转成腾讯云要求的规则数组
 *
 * 注 1：只提交 `FirewallRule` 里声明过的字段 —— 表格行还带着 ST 的临时字段
 * 注 2：`Port` 必须转成字符串，腾讯云该字段是 String，传数字会被 DTO 拒掉
 *
 * @param records 规则行
 * @returns 规则数组
 */
export function rulePayload(records: FirewallRule[]): FirewallRule[] {
  return records.map((record) => {
    /** 单条规则 */
    const rule: FirewallRule = { Protocol: record.Protocol };
    if (record.Action) {
      rule.Action = record.Action;
    }
    if (record.FirewallRuleDescription) {
      rule.FirewallRuleDescription = record.FirewallRuleDescription;
    }
    // 注：空串等于没填，不能原样提交（腾讯云对空端口判参数错误）
    if (record.Port !== undefined && record.Port !== null && `${record.Port}` !== '') {
      rule.Port = String(record.Port);
    }
    if (record.CidrBlock) {
      rule.CidrBlock = record.CidrBlock;
    }
    if (record.Ipv6CidrBlock) {
      rule.Ipv6CidrBlock = record.Ipv6CidrBlock;
    }
    return rule;
  });
}

/** 证书状态标签 */
export const SSL_STATUS_TAG: STColumnTag = {
  0: { text: '审核中', color: 'orange' },
  1: { text: '已通过', color: 'green' },
  2: { text: '审核失败', color: 'red' },
  3: { text: '已过期', color: 'red' },
  4: { text: '已添加DNS记录', color: 'blue' },
  5: { text: '企业证书待提交', color: 'gold' },
  6: { text: '订单取消中', color: 'gray' },
  7: { text: '已取消', color: 'gray' },
  8: { text: '待上传确认函', color: 'cyan' },
  9: { text: '吊销中', color: 'orange' },
  10: { text: '已吊销', color: 'red' },
  11: { text: '重颁发中', color: 'purple' },
  12: { text: '待上传吊销确认函', color: 'blue' },
  13: { text: '免费证书待提交', color: 'gold' },
  14: { text: '已退款', color: 'gray' },
  15: { text: '证书迁移中', color: 'purple' },
};

/** 域名状态标签 */
export const DOMAIN_STATUS_TAG: STColumnTag = {
  ENABLE: { text: '正常', color: 'green' },
  PAUSE: { text: '暂停', color: 'orange' },
  SPAM: { text: '封禁', color: 'red' },
};

/** 域名套餐标签 */
export const DOMAIN_GRADE_TAG: STColumnTag = {
  D_FREE: { text: '免费套餐', color: 'blue' },
  D_PLUS: { text: '个人豪华', color: 'cyan' },
  D_EXTRA: { text: '企业1', color: 'geekblue' },
  D_EXPERT: { text: '企业2', color: 'purple' },
  D_ULTRA: { text: '企业3', color: 'volcano' },
  DP_FREE: { text: '新免费', color: 'green' },
  DP_PLUS: { text: '个人专业版', color: 'lime' },
  DP_EXTRA: { text: '企业创业版', color: 'gold' },
  DP_EXPERT: { text: '企业标准版', color: 'orange' },
  DP_ULTRA: { text: '企业旗舰版', color: 'red' },
};

/** 解析记录状态标签 */
export const DNS_STATUS_TAG: STColumnTag = {
  ENABLE: { text: '启用', color: 'green' },
  DISABLE: { text: '禁用', color: 'red' },
};

/** 实例状态标签 */
export const INSTANCE_STATE_TAG: STColumnTag = {
  RUNNING: { text: '运行中', color: 'green' },
  STOPPED: { text: '已停止', color: 'default' },
  STARTING: { text: '启动中', color: 'processing' },
  STOPPING: { text: '停止中', color: 'warning' },
  REBOOTING: { text: '重启中', color: 'processing' },
  SHUTDOWN: { text: '已关机', color: 'default' },
};

/** 防火墙规则动作标签 */
export const FIREWALL_ACTION_TAG: STColumnTag = {
  ACCEPT: { text: '接受', color: 'green' },
  DROP: { text: '丢弃', color: 'red' },
};
