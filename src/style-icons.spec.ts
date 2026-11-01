import { describe, expect, it } from 'vitest';

import { ICONS } from './style-icons';
import { ICONS_AUTO } from './style-icons-auto';

/**
 * 由第三方组件**拼名**引用、脚本扫不到的图标
 *
 * `@delon/theme` 的 layout-default 把折叠按钮绑到 `menu-${fold|unfold}` 上
 * （`layout.direction` 与 `collapsed` 组合出的字符串，见其 `collapsedIcon` 信号），
 * 模板里没有字面量、自动扫描脚本抓不到；漏注册时按钮位置直接是空白，
 * 折叠后既看不出是按钮、也没有任何报错。
 */
const LAYOUT_DERIVED_ICONS = ['menu-fold', 'menu-unfold'];

describe('ICONS', () => {
  it('布局折叠按钮拼名引用的图标已注册（未注册时折叠后那块是空白）', () => {
    /** 已注册的图标名 */
    const registered = new Set([...ICONS_AUTO, ...ICONS].map((icon) => icon.name));
    /** 漏注册的图标 */
    const missing = LAYOUT_DERIVED_ICONS.filter((name) => !registered.has(name));
    expect(missing).toEqual([]);
  });

  it('没有重复登记（同一个图标写两遍只会放大产物）', () => {
    /** 全部登记项的名字，按首次出现顺序 */
    const names = [...ICONS_AUTO, ...ICONS].map((icon) => icon.name);
    /** 出现次数大于一次的名字 */
    const duplicated = names.filter((name, index) => names.indexOf(name) !== index);
    expect(duplicated).toEqual([]);
  });
});
