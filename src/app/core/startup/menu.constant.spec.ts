import { TestBed } from '@angular/core/testing';
import { Menu, MenuService, provideAlain } from '@delon/theme';
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

/**
 * 按 `MenuService.fixItem()` 的规则推导某一项在运行时的 `group` 取值
 *
 * 注：`fixItem()` 是 `item.group = item.group !== false`，即**不写 `group` 就等于 `true`**；
 * 测试必须照这条规则判断，否则「没写 group」的顶层直链会躲过断言（实测就栽在这里）
 *
 * @param menu 菜单项
 * @returns 运行时的 group 取值
 */
function groupOf(menu: Menu): boolean {
  return menu['group'] !== false;
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
    expect(MENUS.filter((menu) => groupOf(menu) && menu['link'])).toEqual([]);
  });

  it('顶层每一项都必须是容器（带非空 children），否则侧边栏渲染不出可点击项', () => {
    /**
     * `layout-default` 的侧边栏模板对顶层项只做两件事：`group` 为真时渲染一个**不可点击**的组标题，
     * 然后遍历 `group.children` 渲染链接。顶层项若无 children，就会出现「标题点不动」或整项消失
     */
    const empty = MENUS.filter((menu) => {
      const children = menu['children'] as Menu[] | undefined;
      return !Array.isArray(children) || children.length === 0;
    });
    expect(empty).toEqual([]);
  });

  it('顶层容器自身不挂 link（模板只消费 children，容器上的 link 会被静默丢弃）', () => {
    const dangling = MENUS.filter((menu) => !groupOf(menu) && menu['link']);
    expect(dangling).toEqual([]);
  });

  it('运行时形态（用真实的 MenuService 处理一遍）：首页必须是配置里真正能点的那一项', () => {
    TestBed.configureTestingModule({ providers: [provideAlain({})] });
    const menuSrv = TestBed.inject(MenuService);
    // 注：`add()` 会就地改写传入的菜单（写入 `_id` / `_text` / `_aclResult` 等），必须传副本，别把常量弄脏
    menuSrv.add(structuredClone(MENUS));

    /**
     * 侧边栏模板只遍历顶层项的 `children` 去渲染 `<a>`，所以「能被点到」的项一定出现在这一层；
     * 顶层项自己带了 link 反而会被 `@if (group.group)` 吃掉，渲染成不可点的组标题
     */
    const clickable = menuSrv.menus.flatMap((menu) => menu.children ?? []);
    expect(clickable.some((item) => item.link === '/home')).toBe(true);
    expect(menuSrv.menus.filter((menu) => menu.group === true && menu.link)).toEqual([]);
  });
});
