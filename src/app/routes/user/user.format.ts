/** 账号管理的一级标签页 */
export interface UserTab {
  /** 子路由路径 */
  path: string;
  /** 展示名 */
  title: string;
}

/** 一级标签页，注：与 `routes.ts` 的 `children` 逐项对应，改一边必须改另一边 */
export const USER_TABS: UserTab[] = [
  { path: 'basic', title: '基本资料' },
  { path: 'password', title: '修改密码' },
  { path: 'secure', title: '更换邮箱' },
  { path: 'valid', title: '登录有效期' },
];

/**
 * 由当前地址算出高亮的一级标签
 *
 * @param url 当前地址，形如 `/user/basic`
 * @returns 标签下标，注：认不出时回落到第一个（基本资料）
 */
export function tabIndexOf(url: string): number {
  /** 地址里的第 3 段（跳过开头的空段与 `user`） */
  const segment = url.split('?')[0].split('/')[2] ?? '';
  /** 标签下标 */
  const index = USER_TABS.findIndex((item) => item.path === segment);
  return index < 0 ? 0 : index;
}

/**
 * 用户启用状态文案
 *
 * 注：旧私有项目用 -1 / 1 / 0 三个数字表示状态，本仓库改为布尔值
 *
 * @param status 启用状态，true表示启用
 * @returns 展示文案
 */
export function userStatusLabel(status: boolean): string {
  return status ? '启用' : '禁用';
}

/**
 * 登录有效期的当前过期时间文案
 *
 * 注：长期有效令牌的过期时间为 0，不能进时间格式化；已过期的令牌要明确提示「已失效」，
 * 否则用户会以为设置没生效
 *
 * @param expired 令牌过期时间戳（毫秒），0 表示长期有效
 * @param valid 令牌是否仍在有效期内
 * @param format 时间戳格式化函数，注：由调用方注入，避免本模块依赖展示层
 * @returns 展示文案
 */
export function expiredLabel(
  expired: number,
  valid: boolean,
  format: (at: number) => string,
): string {
  if (!valid) {
    return '已失效';
  }
  return expired ? format(expired) : '长期有效';
}
