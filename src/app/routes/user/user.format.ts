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

/** 头像裁剪后的边长（像素），注：256 在 2× 屏的头像尺寸下依然清晰，单张通常 20~40KB */
export const AVATAR_SIDE = 256;

/** 正方形裁剪区域 */
export interface AvatarCrop {
  /** 裁剪起点 X */
  sx: number;
  /** 裁剪起点 Y */
  sy: number;
  /** 裁剪边长 */
  size: number;
}

/**
 * 计算居中正方形裁剪区域
 *
 * 注：头像统一按「取短边、居中裁」处理 —— 不裁的话 16:9 的照片会被压成扁脸；
 * 尺寸为 0（空图 / 损坏文件）时返回 size = 0，由调用方拦下
 *
 * @param width 原图宽度
 * @param height 原图高度
 * @returns 裁剪区域
 */
export function cropRectOf(width: number, height: number): AvatarCrop {
  /** 可用的非负尺寸 */
  const w = Number.isFinite(width) ? Math.max(0, width) : 0;
  /** 可用的非负尺寸 */
  const h = Number.isFinite(height) ? Math.max(0, height) : 0;
  /** 短边长度 */
  const size = Math.min(w, h);
  // 没有可裁剪的面积时统一给零值，避免留下 (0, 50) 这种「有偏移却没尺寸」的组合
  if (!(size > 0)) {
    return { sx: 0, sy: 0, size: 0 };
  }
  return {
    sx: (w - size) / 2,
    sy: (h - size) / 2,
    size,
  };
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
