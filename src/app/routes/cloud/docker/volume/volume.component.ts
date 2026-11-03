import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { STColumn } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';

import { isoTextOf } from '../docker.format';
import { DockerObjectComponent } from '../object/object.component';

/**
 * Docker 数据卷管理组件
 *
 * 注：本阶段只读 —— 卷的创建与删除留到下一阶段（删除卷会直接丢数据，值得单独一轮确认与提示）
 */
@Component({
  selector: 'docker-volume',
  templateUrl: '../object/object.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class DockerVolumeComponent extends DockerObjectComponent {
  override readonly type = 'volumes' as const;
  override readonly name = '数据卷';

  /** 业务列 */
  protected override businessColumns(): STColumn[] {
    return [
      { title: '卷名', index: 'name' },
      { title: '驱动', index: 'driver', width: 100 },
      { title: '挂载点', index: 'mountpoint' },
      {
        title: '创建时间',
        index: 'createdAt',
        width: 170,
        format: (item) => isoTextOf(String(item['createdAt'] ?? '')),
      },
      { title: '作用域', index: 'scope', width: 100 },
    ];
  }
}
