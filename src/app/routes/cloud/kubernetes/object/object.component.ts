import { Directive, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { apiErrorMessage } from '@core';
import type { STChange, STColumn, STColumnButton } from '@delon/abc/st';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { concatMap, from, toArray, type Observable } from 'rxjs';

import { KubernetesObjectService } from './object.service';
import type {
  KubernetesAction,
  KubernetesActionOptions,
  KubernetesBatchAction,
  KubernetesObject,
  KubernetesObjectType,
} from './object.types';
import { KubernetesScaleComponent, type KubernetesScaleData } from './scale/scale.component';

/**
 * 集群资源列表的抽象基类
 *
 * 注 1：命名空间 / 节点 / Pod / Deployment / StatefulSet / Service 六个页面除了「业务列」与
 * 「操作按钮」外完全一样，故把列表、命名空间切换、批量动作与刷新收在基类里，子类只写差异
 * 注 2：操作列在 `ngOnInit` 里拼 —— 按钮要引用子类提供的方法，字段初始化阶段拿不到
 * 注 3：模板不写在基类上；各子类用 `templateUrl` 指向同一份 `object.component.html`
 */
@Directive()
export abstract class KubernetesObjectComponent implements OnInit {
  protected readonly route = inject(ActivatedRoute);
  protected readonly objectSrv = inject(KubernetesObjectService);
  protected readonly msgSrv = inject(NzMessageService);
  private readonly modalSrv = inject(NzModalService);

  /** 资源类型 */
  abstract readonly type: KubernetesObjectType;
  /** 资源中文名，注：只用于文案（标题 / 提示） */
  abstract readonly name: string;

  /**
   * 是否为命名空间级资源
   *
   * 注：节点与命名空间本身没有命名空间，页面上不显示命名空间下拉，请求也不带 `namespace`
   */
  readonly namespaced: boolean = true;

  /** 集群ID */
  protected kubernetesId = 0;
  /** 当前选中的命名空间，注：空串表示全部命名空间 */
  readonly namespace = signal('');
  /** 命名空间清单，注：下拉选项，取不到时为空数组（不影响列表本身） */
  readonly namespaces = signal<string[]>([]);
  /** 清单数据 */
  readonly data = signal<KubernetesObject[]>([]);
  /** 加载标记 */
  readonly loading = signal(true);
  /** 已勾选的行 */
  readonly selected = signal<KubernetesObject[]>([]);
  /** 动作进行中，注：批量按钮据此禁用，避免连点重复提交 */
  readonly busy = signal(false);
  /** 列定义，注：`ngOnInit` 里拼好 */
  columns: STColumn[] = [];

  /** 页面初始化 */
  ngOnInit(): void {
    this.kubernetesId = Number(this.route.parent?.snapshot.params['id']);
    /** 列定义 */
    const columns: STColumn[] = [{ type: 'checkbox' }, ...this.businessColumns()];
    /** 操作按钮 */
    const buttons = this.actions();
    // 注：没有动作时不加操作列（空列会让表格右侧留白）
    if (buttons.length > 0) {
      columns.push({ title: '操作', fixed: 'right', width: 260, buttons });
    }
    this.columns = columns;
    if (this.namespaced) {
      this.loadNamespaces();
    }
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
  batchActions(): KubernetesBatchAction[] {
    return [];
  }

  /**
   * 切换命名空间
   *
   * @param value 命名空间，注：空串表示全部命名空间
   */
  onNamespaceChange(value: string): void {
    this.namespace.set(value ?? '');
    this.fresh();
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
   * 注 2：按顺序逐个执行而非并发 —— 批量删除同一批 Pod 时并发容易把 API Server 打到限流，
   * 且中途失败时错误信息会互相覆盖
   * 注 3：失败也刷新列表 —— 前几行可能已经生效，界面不能停在旧数据上
   * 注 4：命名空间按行取 —— 列表停在「全部命名空间」时，每行可能属于不同命名空间
   *
   * @param rows 目标行
   * @param action 动作
   * @param options 动作参数
   */
  run(
    rows: readonly KubernetesObject[],
    action: KubernetesAction,
    options: KubernetesActionOptions = {},
  ): void {
    /** 目标资源 */
    const targets = rows.filter((row) => String(row['name'] ?? '') !== '');
    if (targets.length === 0) {
      return;
    }
    this.busy.set(true);
    from(targets)
      .pipe(
        concatMap((row) =>
          this.objectSrv.action(
            this.kubernetesId,
            this.type,
            String(row['name']),
            action,
            options,
            String(row['namespace'] ?? ''),
          ),
        ),
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
   * 打开扩缩容弹窗
   *
   * @param row 目标行
   */
  openScale(row: KubernetesObject): void {
    /** 当前副本数 */
    const replicas = Number(row['replicas'] ?? 1);
    this.modalSrv
      .create<KubernetesScaleComponent, KubernetesScaleData, number>({
        nzContent: KubernetesScaleComponent,
        nzData: {
          kind: this.name,
          name: String(row['name'] ?? ''),
          replicas: Number.isFinite(replicas) ? replicas : 1,
        },
        nzTitle: `扩缩容「${String(row['name'] ?? '')}」`,
        nzFooter: null,
        nzWidth: 480,
      })
      .afterClose.subscribe((value) => {
        // 注：取消时 `afterClose` 收到 undefined，不能当成「缩到 0」
        if (typeof value === 'number') {
          this.run([row], 'scale', { replicas: value });
        }
      });
  }

  /** 加载命名空间下拉选项 */
  private loadNamespaces(): void {
    // 注：这里不泛型化成 `KubernetesNamespaceRow` —— 投影后的行是普通对象，
    // 泛型约束要求索引签名，直接取值反而更简单
    this.objectSrv.objects(this.kubernetesId, 'namespaces').subscribe({
      next: (rows) =>
        this.namespaces.set(
          rows
            .map((row) => String(row['name'] ?? ''))
            .filter((name) => name !== '')
            .sort((a, b) => a.localeCompare(b)),
        ),
      // 注：下拉取不到只是少个便利功能，不该把整张列表打掉
      error: () => this.namespaces.set([]),
    });
  }

  /**
   * 拉取清单
   *
   * @returns 清单
   */
  protected load(): Observable<KubernetesObject[]> {
    return this.objectSrv.objects(
      this.kubernetesId,
      this.type,
      this.namespaced ? this.namespace() : '',
    );
  }
}
