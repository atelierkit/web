import { Directive, OnInit, inject, signal, type Type } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { apiErrorMessage } from '@core';
import type { STChange, STColumn } from '@delon/abc/st';
import { formatDateTime } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { concatMap, from, toArray, type Observable } from 'rxjs';

import { KongObjectService } from './object.service';
import type { KongAction, KongObject, KongObjectEditData, KongObjectType } from './object.types';

/**
 * KONG 对象列表的抽象基类
 *
 * 注 1：路由 / 服务 / 用户 / 上游 / 证书 / 插件六个页面除了「业务列」与「取数方式」外完全一样，
 * 故把列表、翻页、批量删除与操作列收在基类里，子类只写差异（这也是旧私有项目的做法）
 * 注 2：列定义在 `ngOnInit` 里拼 —— 操作列要引用子类提供的编辑弹窗组件，字段初始化阶段拿不到
 * 注 3：模板不写在基类上；各子类用 `templateUrl` 指向同一份 `object.component.html`
 */
@Directive()
export abstract class KongObjectComponent implements OnInit {
  protected readonly route = inject(ActivatedRoute);
  protected readonly objectSrv = inject(KongObjectService);
  private readonly modalSrv = inject(NzModalService);
  protected readonly msgSrv = inject(NzMessageService);

  /** 对象类型 */
  abstract readonly type: KongObjectType;
  /** 对象中文名，注：只用于文案（标题 / 提示） */
  abstract readonly name: string;

  /** 站点ID */
  protected kongId = 0;
  /** 清单数据 */
  readonly data = signal<KongObject[]>([]);
  /** 加载标记 */
  readonly loading = signal(true);
  /** 已勾选的行 */
  readonly selected = signal<KongObject[]>([]);
  /** 批量删除进行中 */
  readonly deleting = signal(false);
  /** 列定义，注：`ngOnInit` 里拼好 */
  columns: STColumn[] = [];

  /** 页面初始化 */
  ngOnInit(): void {
    this.kongId = Number(this.route.parent?.snapshot.params['id']);
    this.columns = [
      { type: 'checkbox' },
      ...this.businessColumns(),
      {
        title: '创建时间',
        index: 'created_at',
        format: (item) => formatDateTime(item['created_at'] as number, 's'),
      },
      {
        title: '更新时间',
        index: 'updated_at',
        format: (item) => formatDateTime(item['updated_at'] as number, 's'),
      },
      {
        title: '操作',
        fixed: 'right',
        width: 220,
        buttons: [
          {
            text: '编辑',
            type: 'link',
            click: (record) => this.open('edit', record as KongObject),
          },
          {
            text: '复制',
            type: 'link',
            click: (record) => this.open('copy', record as KongObject),
          },
          {
            text: '删除',
            type: 'link',
            click: (record) => this.remove([record as KongObject]),
          },
        ],
      },
    ];
    this.fresh();
  }

  /**
   * 业务列
   *
   * 注：创建 / 更新时间与操作列由基类统一追加，子类只关心自己那几列
   *
   * @returns 列定义
   */
  protected abstract businessColumns(): STColumn[];

  /**
   * 编辑弹窗组件
   *
   * @returns 组件类型
   */
  protected abstract editComponent(): Type<unknown>;

  /**
   * 拉取清单
   *
   * 注：路由与插件页要额外查关联对象补名称，故子类可重写
   *
   * @returns 清单
   */
  protected load(): Observable<KongObject[]> {
    return this.objectSrv.objects(this.kongId, this.type);
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
   * 打开创建弹窗
   */
  add(): void {
    this.open('add');
  }

  /**
   * 打开创建 / 编辑 / 复制弹窗
   *
   * @param action 动作
   * @param record 待操作的记录，注：新建时缺省
   */
  open(action: KongAction, record?: KongObject): void {
    /** 弹窗入参 */
    const data: KongObjectEditData = {
      kongId: this.kongId,
      type: this.type,
      action,
      id: record?.['id'] as string | undefined,
    };
    /** 标题前缀 */
    const verb = action === 'add' ? '创建' : action === 'copy' ? '复制' : '编辑';
    this.modalSrv
      .create<unknown, KongObjectEditData, boolean>({
        nzContent: this.editComponent(),
        nzData: data,
        nzTitle: `${verb}${this.name}`,
        nzFooter: null,
        nzWidth: 900,
      })
      .afterClose.subscribe((saved) => {
        // 仅在保存成功时刷新，取消关闭不动列表
        if (saved) {
          this.fresh();
        }
      });
  }

  /**
   * 删除对象
   *
   * 注 1：单行删除与批量删除共用本方法（传一行即可）
   * 注 2：Kong 没有批量删除接口，这里按顺序逐个删（并发删同一批对象容易出现互相引用导致的失败）；
   * 中途失败时已经删掉的不回滚，所以失败分支也要刷新列表，别让界面停在旧数据上
   *
   * @param rows 待删除的行
   */
  remove(rows: readonly KongObject[]): void {
    /** 待删除的对象ID */
    const ids = rows
      .map((row) => row['id'])
      .filter((id): id is string => typeof id === 'string' && id !== '');
    if (ids.length === 0) {
      return;
    }
    this.deleting.set(true);
    from(ids)
      .pipe(
        concatMap((id) => this.objectSrv.destroy(this.kongId, this.type, id)),
        toArray(),
      )
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.msgSrv.success('已完成删除！');
          this.fresh();
        },
        error: (err: unknown) => {
          this.deleting.set(false);
          this.msgSrv.error(apiErrorMessage(err, `删除${this.name}失败，请稍后重试！`));
          this.fresh();
        },
      });
  }
}
