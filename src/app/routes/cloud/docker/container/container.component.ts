import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import type { STColumn, STColumnButton, STColumnTag } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';

import { STATE_TAG, timeTextOf } from '../docker.format';
import { DockerObjectComponent } from '../object/object.component';
import type { DockerBatchAction, DockerObject } from '../object/object.types';
import { DockerLogComponent } from './log/log.component';

/**
 * Docker 容器管理组件
 *
 * 注 1：列表由 daemon 的 `GET /containers/json?all=1` 提供，后端已做投影，这里不建模字段
 * 注 2：启停按钮用 `iif` 按容器状态切换显示 —— 对运行中的容器点「启动」只会拿到 304，
 * 藏在界面上比摆出来更清楚
 * 注 3：日志用右侧抽屉而不是独立路由 —— 容器没有自己的实体页（列表即全部入口），
 * 抽屉能保留列表上下文，便于在几个容器之间来回看
 */
@Component({
  selector: 'docker-container',
  templateUrl: './container.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS, DockerLogComponent],
})
export class DockerContainerComponent extends DockerObjectComponent {
  override readonly type = 'containers' as const;
  override readonly name = '容器';

  /** 正在查看日志的容器，注：`null` 表示抽屉关闭 */
  readonly logTarget = signal<DockerObject | null>(null);

  /** 抽屉标题 */
  readonly logTitle = computed(() => {
    /** 目标容器 */
    const target = this.logTarget();
    return target === null ? '容器日志' : `容器日志 · ${String(target['name'] ?? '')}`;
  });

  /** 业务列 */
  protected override businessColumns(): STColumn[] {
    return [
      { title: '容器ID', index: 'id', width: 140 },
      { title: '名称', index: 'name' },
      { title: '镜像', index: 'image' },
      {
        title: '状态',
        index: 'state',
        type: 'tag',
        tag: STATE_TAG as STColumnTag,
      },
      { title: '状态描述', index: 'status' },
      { title: '端口', index: 'ports' },
      { title: '项目', index: 'project', width: 110 },
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
        text: '启动',
        type: 'link',
        iif: (item) => String(item['state'] ?? '') !== 'running',
        click: (item) => this.run([item as DockerObject], 'start'),
      },
      {
        text: '停止',
        type: 'link',
        iif: (item) => ['running', 'paused', 'restarting'].includes(String(item['state'] ?? '')),
        click: (item) => this.run([item as DockerObject], 'stop'),
      },
      {
        text: '重启',
        type: 'link',
        click: (item) => this.run([item as DockerObject], 'restart'),
      },
      {
        text: '日志',
        type: 'link',
        click: (item) => this.openLog(item as DockerObject),
      },
      {
        text: '删除',
        type: 'link',
        pop: '删除后容器连同其可写层一起消失，且不可恢复。确认删除？',
        click: (item) => this.run([item as DockerObject], 'remove'),
      },
    ];
  }

  /** 批量动作 */
  override batchActions(): DockerBatchAction[] {
    return [
      {
        action: 'start',
        text: '批量启动',
        confirm: '确认启动已选中的容器？',
      },
      {
        action: 'stop',
        text: '批量停止',
        confirm: '确认停止已选中的容器？正在运行的进程会被强制结束。',
      },
      {
        action: 'remove',
        text: '批量删除',
        confirm: '删除后不会进入回收站，且不可恢复。确认删除已选中的容器？',
        danger: true,
      },
    ];
  }

  /**
   * 打开日志抽屉
   *
   * @param item 容器行
   */
  openLog(item: DockerObject): void {
    this.logTarget.set(item);
  }

  /** 关闭日志抽屉 */
  closeLog(): void {
    this.logTarget.set(null);
  }

  /**
   * 字段 → 字符串
   *
   * 注：模板里不能直接用全局 `String`（Angular 表达式只认识 `undefined` / `$any`），
   * 而后端投影的字段是 `Record<string, unknown>`，需要一个收敛点
   *
   * @param value 原始值
   * @returns 字符串
   */
  protected textOf(value: unknown): string {
    return value === undefined || value === null ? '' : String(value);
  }
}
