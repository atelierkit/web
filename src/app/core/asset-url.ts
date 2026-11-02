/**
 * 运行时资源地址解析
 *
 * 背景：后端下发的头像等资源是「站内绝对路径」（形如 `/static/avatar/x.webp`），
 * 而前端与后端不在同一个源 —— 直接丢给 `<img src>` 会按**页面源**请求，必然 404。
 * 这里按 `baseUrl` 的形态拼出可加载地址：
 * - `//host:port/`、`http(s)://host/` → 取 origin 拼接；
 * - `/api/` 这类站内前缀（同源反代）→ 拼在该前缀下；
 * - 外链、`data:`、`blob:` 原样返回（后端允许历史数据继续用外部图床）。
 *
 * @param value 后端下发的地址（可能是完整外链、`/static/...` 或空串）
 * @param baseUrl 运行时配置 `assets/config.json` 的 `baseUrl`
 * @param href 当前页面地址，注：协议相对地址（`//host`）要靠它补协议
 * @returns 可直接放进 `<img src>` 的地址，空值返回空串
 */
export function assetUrl(
  value: string | null | undefined,
  baseUrl: string | null | undefined,
  href: string = typeof location === 'undefined' ? '' : location.href,
): string {
  /** 归一化后的值 */
  const raw = (value ?? '').trim();
  if (raw === '') {
    return '';
  }
  // 完整地址、协议相对地址、内联数据：都不该再拼 baseUrl
  if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(raw) || /^(?:data|blob):/i.test(raw)) {
    return raw;
  }
  /** 后端基址 */
  const base = (baseUrl ?? '').trim();
  if (base === '') {
    return raw;
  }
  // 同源反代（`/api/`）：静态资源也挂在该前缀下，不能用 origin 拼
  if (base.startsWith('/') && !base.startsWith('//')) {
    /** 去掉末尾斜杠后的前缀 */
    const prefix = base.replace(/\/+$/, '');
    return raw.startsWith('/') ? `${prefix}${raw}` : `${prefix}/${raw}`;
  }
  try {
    /** 后端源 */
    const origin = new URL(base, href || undefined).origin;
    return raw.startsWith('/') ? `${origin}${raw}` : `${origin}/${raw}`;
  } catch {
    // baseUrl 写坏了（缺协议且没有页面地址可参考）时退回原值，至少不会抛错白屏
    return raw;
  }
}
