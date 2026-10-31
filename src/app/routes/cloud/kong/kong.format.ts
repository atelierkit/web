/**
 * 网关概览的文案转换
 *
 * 注：抽成独立模块而不是写在组件里，是为了能在单元测试里直接覆盖 ——
 * 组件文件 import 了 `SHARED_IMPORTS`，测试一旦加载它就会把整片页面模块带进覆盖率分母
 * （实测全局语句覆盖率从 92% 掉到 72%），而这两个函数的取值规则恰好最需要被钉住
 */

/**
 * 版本类型 → 展示文案
 *
 * @param edition Kong `/` 返回的 `edition` 字段
 * @returns 展示文案，未知类型原样返回，空值为 `-`
 */
export function editionText(edition: string): string {
  if (edition === 'community') {
    return '社区版（Community）';
  }
  if (edition === 'enterprise') {
    return '企业版（Enterprise）';
  }
  return edition || '-';
}

/**
 * 数据库可达性 → 展示文案
 *
 * @param reachable 是否可达，注：`null` 表示无数据库模式（DB-less），与「不可达」是两回事
 * @returns 展示文案
 */
export function dbText(reachable: boolean | null): string {
  if (reachable === null) {
    return '不适用（无数据库模式）';
  }
  return reachable ? '可达' : '不可达';
}
