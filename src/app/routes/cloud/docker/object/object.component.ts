import { Directive, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { apiErrorMessage } from '@core';
import type { STChange, STColumn, STColumnButton } from '@delon/abc/st';
import { NzMessageService } from 'ng-zorro-antd/message';
import { concatMap, from, toArray, type Observable } from 'rxjs';

import { DockerObjectService } from './object.service';
import type {
  DockerAction,
  DockerActionOptions,
  DockerBatchAction,
  DockerObject,
  DockerObjectType,
} from './object.types';

/**
 * Docker 资源列表的抽象基类
 *
 * 注 1：容器 / 镜像 / 数据卷 / 网络四个页面除了「业务列」与「操作按钮」外完全一样，
 * 故把列表、批量动作与刷新收在基类里，子类只写差异
 * 注 2：操作列在 `ngOnInit` 里拼 —— 按钮要引用子类提供的方法，字段初始化阶段拿不到
 * 注 3：模板不写在基类上；各子类用 `templateUrl` 指向同一份 `object.component.html`
 */
@Directive()
export abstract class DockerObjectComponent implements OnInit {
  protected readonly route = inject(ActivatedRoute);
  protected readonly objectSrv = inject(DockerObjectService);
  protected readonly msgSrv = inject(NzMessageService);

  /** 资源类型 */
  abstract readonly type: DockerObjectType;
  /** 资源中文名，注：只用于文案（标题 / 提示） */
  abstract readonly name: string;

  /** 宿主机ID */
  protected dockerId = 0;
  /** 清单数据 */
  readonly data = signal<DockerObject[]>([]);
  /** 加载标记 */
  readonly loading = signal(true);
  /** 已勾选的行 */
  readonly selected = signal<DockerObject[]>([]);
  /** 动作进行中，注：批量按钮据此禁用，避免连点重复提交 */
  readonly busy = signal(false);
  /** 列定义，注：`ngOnInit` 里拼好 */
  columns: STColumn[] = [];

  /** 页面初始化 */
  ngOnInit(): void {
    this.dockerId = Number(this.route.parent?.snapshot.params['id']);
    /** 列定义 */
    const columns: STColumn[] = [{ type: 'checkbox' }, ...this.businessColumns()];
    /** 操作按钮 */
    const buttons = this.actions();
    // 注：卷与网络本阶段只读，没有动作时不加操作列（空列会让表格右侧留白）
    if (buttons.length > 0) {
      columns.push({ title: '操作', fixed: 'right', width: 240, buttons });
    }
    this.columns = columns;
    this.fresh();
  }

  /**
   * 业务列
   *
   * @returns 列定义
   */
  protected abstract businessColumns(): STColumn[];

  /**
   * 单行操作按钮
   *
   * @returns 按钮定义，注：缺省表示该资源只读
   */
  protected actions(): STColumnButton[] {
    return [];
  }

  /**
   * 批量动作
   *
   * @returns 动作定义，注：缺省表示不支持批量
   */
  batchActions(): DockerBatchAction[] {
    return [];
  }

  /** 数据刷新 */
  fresh(): void {
    this.loading.set(true);
    this.selected.set([]);
    this.load().subscribe({
      next: (rows) => {
        this.data.set(rows);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        // 失败时须复位加载态，否则表格会一直转圈
        this.loading.set(false);
        this.msgSrv.error(apiErrorMessage(err, `加载${this.name}列表失败，请稍后重试！`));
      },
    });
  }

  /**
   * 勾选变化
   *
   * @param event 表格变更事件
   */
  onChange(event: STChange): void {
    if (event.type === 'checkbox') {
      this.selected.set(event.checkbox ?? []);
    }
  }

  /**
   * 对若干行执行同一个动作
   *
   * 注 1：单行操作与批量操作共用本方法（传一行即可）
   * 注 2：按顺序逐个执行而非并发 —— 批量停止同一批容器时并发容易把 daemon 打到超时，
   * 且中途失败时错误信息会互相覆盖
   * 注 3：失败也刷新列表 —— 前几行可能已经生效，界面不能停在旧数据上
   *
   * @param rows 目标行
   * @param action 动作
   * @param options 动作参数
   */
  run(
    rows: readonly DockerObject[],
    action: DockerAction,
    options: DockerActionOptions = {},
  ): void {
    /** 目标资源ID */
    const ids = rows
      .map((row) => row['id'])
      .filter((id): id is string => typeof id === 'string' && id !== '');
    if (ids.length === 0) {
      return;
    }
    this.busy.set(true);
    from(ids)
      .pipe(
        concatMap((id) => this.objectSrv.action(this.dockerId, this.type, id, action, options)),
        toArray(),
      )
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.msgSrv.success('操作已完成！');
          this.fresh();
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.msgSrv.error(apiErrorMessage(err, `操作${this.name}失败，请稍后重试！`));
          this.fresh();
        },
      });
  }

  /**
   * 拉取清单
   *
   * @returns 清单
   */
  protected load(): Observable<DockerObject[]> {
    return this.objectSrv.objects(this.dockerId, this.type);
  }
}
