/**
 * 头像回退用的显示文本
 *
 * 注：没有头像（或图片加载失败）时用名字首字符占位 —— 空 `nzSrc` 在 ng-zorro 里
 * 三个渲染分支都不命中，页头会留一个空白圆块，这是「头像功能看起来失效」的观感来源
 *
 * @param name 昵称
 * @param username 登录用户名，注：昵称为空时兜底
 * @returns 单字符文本，全空时返回 `?`
 */
export function avatarTextOf(
  name: string | null | undefined,
  username: string | null | undefined = '',
): string {
  /** 候选文本 */
  const source = (name ?? '').trim() || (username ?? '').trim();
  if (source === '') {
    return '?';
  }
  // 用 Array.from 取码点，避免把 emoji / 生僻字的代理对截成半个字符
  const [first] = Array.from(source);
  return first ? first.toUpperCase() : '?';
}

/** 首字符头像的配色，注：低饱和、深浅色主题下都够对比度 */
export const AVATAR_COLORS = [
  '#5b8ff9',
  '#61ddaa',
  '#f6bd16',
  '#7262fd',
  '#9661bc',
  '#78d3f8',
  '#f08bb4',
  '#7f8b99',
] as const;

/**
 * 按名字取稳定的头像底色
 *
 * 注：同一个名字任何时候都得到同一个颜色（不能用随机数，否则每次刷新都换色）
 *
 * @param name 昵称（或用户名）
 * @returns 颜色值
 */
export function avatarColorOf(name: string | null | undefined): string {
  /** 参与哈希的文本 */
  const source = (name ?? '').trim();
  if (source === '') {
    return AVATAR_COLORS[0];
  }
  /** 哈希值 */
  let hash = 0;
  for (const ch of source) {
    hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) % 1_000_003;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
