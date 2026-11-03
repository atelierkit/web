/**
 * 后端源（socket 通道要连的 origin）
 *
 * ⚠ HTTP 请求由拦截器拼 `baseUrl`，socket 不会走拦截器 —— 不显式推导就会连到**前端页面源**，
 * 表现为握手 404、实时通道静默失效（页面只在进入时刷新一次）。
 *
 * @param baseUrl 运行时配置 `assets/config.json` 的 `baseUrl`（可能是 `//host:port/`）
 * @param href 当前页面地址（协议相对地址要靠它补协议）
 * @returns 形如 `http://host:port`，配置缺失或非法时为 null
 */
export function apiOriginOf(baseUrl: string | null | undefined, href: string): string | null {
  if (typeof baseUrl !== 'string' || baseUrl.trim() === '') {
    return null;
  }
  try {
    return new URL(baseUrl, href).origin;
  } catch {
    return null;
  }
}
