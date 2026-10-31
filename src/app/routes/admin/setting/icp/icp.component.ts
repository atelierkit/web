import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SFSchema } from '@delon/form';
import { SHARED_IMPORTS } from '@shared';

import { AdminSettingEditComponent } from '../edit/edit.component';

/**
 * 备案配置组件
 *
 * 注：备案号要求与页脚展示一致，故两个字段都必填
 */
@Component({
  selector: 'admin-setting-icp',
  templateUrl: '../edit/edit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class AdminSettingIcpComponent extends AdminSettingEditComponent {
  override code = 'icp';

  override title = '备案配置';

  override valueSchema: SFSchema = {
    type: 'object',
    properties: {
      owner: { type: 'string', title: '所有者' },
      icp: { type: 'string', title: '备案号' },
    },
    required: ['owner', 'icp'],
  };
}
