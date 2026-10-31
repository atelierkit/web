import { Menu } from '@delon/theme';
import { describe, expect, it } from 'vitest';

import { MENUS } from './menu.constant';
import { ICONS } from '../../../style-icons';
import { ICONS_AUTO } from '../../../style-icons-auto';

/**
 * 收集菜单里用到的图标名
 *
 * @param menus 菜单树
 * @returns 图标名清单（含子菜单）
 */
function iconNamesOf(menus: Menu[]): string[] {
  return menus.flatMap((menu) => {
    /** 本项自己的图标 */
    const icon = menu['icon'] as { value?: string } | undefined;
    const own = icon?.value ? [icon.value] : [];
    /** 子菜单的图标 */
    const children = Array.isArray(menu['children']) ? iconNamesOf(menu['children'] as Menu[]) : [];
    return [...own, ...children];
  });
}

/**
 * 收集菜单里的叶子项（分组只有 children，没有 link）
 *
 * @param menus 菜单树
 * @returns 叶子项清单
 */
function leavesOf(menus: Menu[]): Menu[] {
  return menus.flatMap((menu) => {
    const children = menu['children'] as Menu[] | undefined;
    return children?.length ? leavesOf(children) : [menu];
  });
}

describe('MENUS', () => {
  it('菜单里用到的图标都已注册（未注册时侧边栏那格会渲染成空白，图标不会自动从网上拉）', () => {
    /** 已注册的图标名，注：ICONS_AUTO 由脚本扫模板生成，ICONS 是手工登记 */
    const registered = new Set([...ICONS_AUTO, ...ICONS].map((icon) => icon.name));
    /** 漏注册的图标 */
    const missing = iconNamesOf(MENUS).filter((name) => !registered.has(name));
    expect(missing).toEqual([]);
  });

  it('每个叶子菜单都有 link 与图标，分组项都没有 link', () => {
    expect(leavesOf(MENUS).filter((menu) => !menu['link'] || !menu['icon'])).toEqual([]);
    expect(MENUS.filter((menu) => menu['group'] && menu['link'])).toEqual([]);
  });
});
