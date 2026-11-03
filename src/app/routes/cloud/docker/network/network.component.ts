import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { STColumn, STColumnTag } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';

import { isoTextOf } from '../docker.format';
import { DockerObjectComponent } from '../object/object.component';

/** 布尔 → 标签，注：网络的 internal / attachable 是两个独立开关，用同一套是 / 否标签 */
const BOOL_TAG: STColumnTag = {
  true: { text: '是', color: 'green' },
  false: { text: '否', color: 'default' },
};

/**
 * Docker 网络管理组件
 *
 * 注：本阶段只读 —— 网络的创建与删除留到下一阶段（删掉正在被容器使用的网络会直接影响业务）
 */
@Component({
  selector: 'docker-network',
  templateUrl: '../object/object.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class DockerNetworkComponent extends DockerObjectComponent {
  override readonly type = 'networks' as const;
  override readonly name = '网络';

  /** 业务列 */
  protected override businessColumns(): STColumn[] {
    return [
      { title: '网络ID', index: 'id', width: 140 },
      { title: '名称', index: 'name' },
      { title: '驱动', index: 'driver', width: 100 },
      { title: '作用域', index: 'scope', width: 100 },
      {
        title: '内部网络',
        index: 'internal',
        width: 100,
        type: 'tag',
        tag: BOOL_TAG,
      },
      {
        title: '可手动接入',
        index: 'attachable',
        width: 110,
        type: 'tag',
        tag: BOOL_TAG,
      },
      { title: '容器数', index: 'containers', width: 90 },
      {
        title: '创建时间',
        index: 'created',
        width: 170,
        // 注：daemon 给的是纳秒精度的 RFC3339，`isoTextOf` 按毫秒解析（多余位数被截断）
        format: (item) => isoTextOf(String(item['created'] ?? '')),
      },
    ];
  }
}
