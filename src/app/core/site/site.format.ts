/** 应用配置，注：由管理员在「配置 → 应用配置」中维护，对应后端 `settings` 表 `code = 'app'` 的 `value` */
export interface SiteApp {
  /** 应用名称 */
  name: string;
  /** 应用说明 */
  description: string;
}

/** 备案信息，注：由管理员在「配置 → 备案配置」中维护，对应后端 `settings` 表 `code = 'icp'` 的 `value` */
export interface SiteIcp {
  /** 备案主体 */
  owner: string;
  /** 备案号 */
  icp: string;
}

/** 站点信息，注：两个配置各自独立，任一读取失败不影响另一个 */
export interface SiteInfo {
  /** 应用配置，注：未配置或读取失败时为空对象 */
  app: Partial<SiteApp>;
  /** 备案信息，注：未配置或读取失败时为空对象 */
  icp: Partial<SiteIcp>;
}

/** 应用名称兜底，注：运行时配置与后端都取不到时使用，避免页头空白 */
export const DEFAULT_APP_NAME = '管理平台';

/** 备案号查询地址（工业和信息化部政务服务平台） */
export const ICP_URL = 'https://beian.miit.gov.cn/';

/**
 * 合并应用配置
 *
 * 注：优先级为「后端配置 → 运行时配置（`assets/config.json`）→ 内置兜底」，
 * 后端未配置过应用信息时不应把站点名称显示成空白
 *
 * @param raw 后端返回的应用配置
 * @param fallback 运行时配置提供的兜底值
 * @returns 可直接用于展示的应用配置
 */
export function mergeApp(
  raw?: Partial<SiteApp> | null,
  fallback?: Partial<SiteApp> | null,
): SiteApp {
  return {
    name: raw?.name?.trim() || fallback?.name?.trim() || DEFAULT_APP_NAME,
    description: raw?.description?.trim() || fallback?.description?.trim() || '',
  };
}

/**
 * 合并备案信息
 *
 * @param raw 后端返回的备案信息
 * @returns 备案信息，注：主体与备案号均为空时返回 `null`，页脚据此不渲染备案行
 */
export function mergeIcp(raw?: Partial<SiteIcp> | null): SiteIcp | null {
  /** 备案主体 */
  const owner = raw?.owner?.trim() ?? '';
  /** 备案号 */
  const icp = raw?.icp?.trim() ?? '';
  return owner || icp ? { owner, icp } : null;
}

/**
 * 生成页脚版权文案
 *
 * @param year 当前年份
 * @param owner 备案主体，注：未配置时只显示版权年份
 * @returns 版权文案
 */
export function copyrightText(year: number, owner?: string): string {
  /** 去掉空白的备案主体 */
  const name = owner?.trim();
  return name ? `Copyright © ${year} ${name} 版权所有` : `Copyright © ${year}`;
}
