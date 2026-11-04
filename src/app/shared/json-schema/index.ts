import type { SFWidgetProvideConfig } from '@delon/form';
// import { withCascaderWidget } from '@delon/form/widgets/cascader';

import { AtWidget } from './at/at.widget';
import { PrivateKeyWidget } from './private-key/private-key.widget';
import { TestWidget } from './test/test.widget';

export const SF_WIDGETS: SFWidgetProvideConfig[] = [
  // 时间戳只读展示，注：`ui: { $字段: { widget: 'at' } }`，单位由 schema 的 timestamp 指定
  { KEY: AtWidget.KEY, type: AtWidget },
  // 私钥录入：选本地文件为主、手动粘贴兜底，注：`ui: { $privateKey: { widget: 'privateKey' } }`
  { KEY: PrivateKeyWidget.KEY, type: PrivateKeyWidget },
  { KEY: TestWidget.KEY, type: TestWidget },
  // Non-built-in widget registration method
  // withCascaderWidget()
];
