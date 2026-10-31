import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SFSchema } from '@delon/form';
import { SHARED_IMPORTS } from '@shared';

import { AdminSettingEditComponent } from '../edit/edit.component';

/**
 * 应用配置组件
 *
 * 注：`app` 这个配置被页头 / 版权等公共位置读取，字段名与消费方保持一致
 */
@Component({
  selector: 'admin-setting-app',
  templateUrl: '../edit/edit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class AdminSettingAppComponent extends AdminSettingEditComponent {
  override code = 'app';

  override title = '应用配置';

  override valueSchema: SFSchema = {
    type: 'object',
    properties: {
      name: { type: 'string', title: '名称' },
      description: { type: 'string', title: '说明' },
    },
    required: ['name', 'description'],
  };
}
