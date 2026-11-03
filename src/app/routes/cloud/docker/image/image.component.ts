import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { STColumn, STColumnButton } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';

import { bytesText, timeTextOf } from '../docker.format';
import { DockerObjectComponent } from '../object/object.component';
import type { DockerBatchAction, DockerObject } from '../object/object.types';

/**
 * Docker 镜像管理组件
 *
 * 注 1：镜像列表来自 `GET /images/json`，悬空镜像的 `<none>:<none>` 已在后端归成空标签
 * 注 2：删除按 ID 提交（后端不接受带 `/` 的镜像名），被容器引用时会失败并原样提示原因
 */
@Component({
  selector: 'docker-image',
  templateUrl: '../object/object.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class DockerImageComponent extends DockerObjectComponent {
  override readonly type = 'images' as const;
  override readonly name = '镜像';

  /** 业务列 */
  protected override businessColumns(): STColumn[] {
    return [
      { title: '镜像ID', index: 'id', width: 140 },
      {
        title: '标签',
        type: 'widget',
        widget: {
          type: 'array',
          params: ({ record }) => ({ value: record['tags'] }),
        },
      },
      {
        title: '大小',
        index: 'size',
        width: 110,
        format: (item) => bytesText(Number(item['size'])),
      },
      { title: '容器数', index: 'containers', width: 90 },
      {
        title: '创建时间',
        index: 'created',
        width: 170,
        format: (item) => timeTextOf(Number(item['created'])),
      },
    ];
  }

  /** 单行操作 */
  protected override actions(): STColumnButton[] {
    return [
      {
        text: '删除',
        type: 'link',
        pop: '删除后需要重新拉取才能使用。若仍有容器引用该镜像，删除会失败。确认删除？',
        click: (item) => this.run([item as DockerObject], 'remove'),
      },
    ];
  }

  /** 批量动作 */
  override batchActions(): DockerBatchAction[] {
    return [
      {
        action: 'remove',
        text: '批量删除',
        confirm: '删除后需要重新拉取，且不可恢复。确认删除已选中的镜像？',
        danger: true,
      },
    ];
  }
}
