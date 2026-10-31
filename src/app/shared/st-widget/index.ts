import type { STWidgetProvideConfig } from '@delon/abc/st';

import { StArrayWidget } from './array/array.widget';

/**
 * `@delon/abc` 的表格小部件注册表
 *
 * 注：列定义里写 `type: 'widget'` + `widget: { type: '<KEY>' }` 即可用；
 * 这里的 KEY 必须与各小部件类的 `KEY` 静态属性一致
 */
export const ST_WIDGETS: STWidgetProvideConfig[] = [
  // 数组按标签展示（Kong 的域名 / 路径 / 协议 / snis 等字段）
  { KEY: StArrayWidget.KEY, type: StArrayWidget },
];
