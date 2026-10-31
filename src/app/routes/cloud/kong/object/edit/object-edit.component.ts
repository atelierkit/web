import { Directive, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import type { SFSchema, SFUISchema } from '@delon/form';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';

import { KongObjectService } from '../object.service';
import type { KongAction, KongObject, KongObjectEditData, KongObjectType } from '../object.types';

/**
 * KONG 对象编辑弹窗的抽象基类
 *
 * 注 1：六种对象的编辑弹窗只有「表单 schema」与「提交哪些字段」不同，取数 / 保存 / 报错收在基类里
 * 注 2：`payload()` 必须写成白名单 —— 详情接口回传的对象里带着 `id` / `created_at` / `updated_at`
 * 等只读字段，整份提交回去 Kong 会报 schema 校验失败；写白名单也顺带让「复制」可用
 * （复制 = 读详情 → 按新建提交，只读字段天然被丢掉）
 * 注 3：模板不写在基类上，各子类用 `templateUrl` 指向同一份 `object-edit.component.html`
 */
@Directive()
export abstract class KongObjectEditComponent implements OnInit {
  private readonly data = inject<KongObjectEditData | null>(NZ_MODAL_DATA, {
    optional: true,
  });
  protected readonly objectSrv = inject(KongObjectService);
  private readonly msgSrv = inject(NzMessageService);
  private readonly modalRef = inject(NzModalRef);

  /** 对象中文名，注：只用于文案 */
  abstract readonly name: string;
  /** 表单 schema */
  abstract readonly schema: SFSchema;
  /** 表单样式 */
  abstract readonly ui: SFUISchema;

  /** 站点ID */
  protected readonly kongId = this.data?.kongId ?? 0;
  /** 对象类型 */
  protected readonly type: KongObjectType = this.data?.type ?? 'routes';
  /** 弹窗动作 */
  protected readonly action: KongAction = this.data?.action ?? 'add';
  /** 对象ID，注：新建时为空 */
  protected readonly recordId = this.data?.id;

  /**
   * 表单数据
   *
   * 注：`null` 表示详情还没到，模板据此显示加载态（新建时直接给空对象）
   */
  readonly formData = signal<Record<string, unknown> | null>(null);
  /** 提交中标记 */
  readonly saving = signal(false);

  /** 是否为编辑态，注：复制走新建，故不算编辑态 */
  protected get isEdit(): boolean {
    return this.action === 'edit' && !!this.recordId;
  }

  /** 提交按钮文案 */
  get submitText(): string {
    if (this.action === 'edit') {
      return '保存';
    }
    return this.action === 'copy' ? '另存为' : '创建';
  }

  /** 页面初始化 */
  ngOnInit(): void {
    // 注：有 `recordId` 就要读详情 —— 「编辑」要回填原值，「复制」同样要，否则复制出来的是
    // 一张空表单（保存方式仍由 `save()` 里的 `isEdit` 决定，复制走新建）
    if (!this.recordId) {
      this.formData.set({});
      return;
    }
    this.objectSrv.object(this.kongId, this.type, this.recordId).subscribe({
      next: (row) => this.formData.set(this.normalize(row)),
      error: (err: unknown) => {
        // 详情取不到时弹窗无法继续编辑，提示后关闭
        this.msgSrv.error(apiErrorMessage(err, `加载${this.name}详情失败，请稍后重试！`));
        this.close();
      },
    });
  }

  /**
   * 详情 → 表单值
   *
   * 注：Kong 的关联字段是 `{ id }` 形态，而 SF 的嵌套对象表单需要 `{ id: '' }` 才好绑定，
   * 需要处理的子类重写本方法
   *
   * @param row 详情
   * @returns 表单初值
   */
  protected normalize(row: KongObject): Record<string, unknown> {
    return { ...row };
  }

  /**
   * 表单值 → 提交数据
   *
   * @param value 表单值
   * @returns 提交给 Kong 的对象数据
   */
  protected abstract payload(value: Record<string, unknown>): Record<string, unknown>;

  /**
   * 去掉值为 `undefined` 的字段
   *
   * 注 1：Kong 的 PATCH 只更新提交上来的字段，`undefined` 经 `JSON.stringify` 后本来也会消失，
   * 这里显式过滤是为了让提交体的形状在代码里一眼可见
   * 注 2：`null` 必须保留 —— Kong 用 `null` 解绑关联对象（如路由不绑服务）
   *
   * @param value 待过滤的提交体
   * @returns 过滤后的提交体
   */
  protected compact(value: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
  }

  /**
   * 保存（新建 / 更新）
   *
   * @param value SF 表单值
   */
  save(value: Record<string, unknown>): void {
    /** 提交数据 */
    const body = this.payload(value);
    this.saving.set(true);
    /** 提交请求，注：复制态没有 recordId，走新建 */
    const request =
      this.isEdit && this.recordId
        ? this.objectSrv.update(this.kongId, this.type, this.recordId, body)
        : this.objectSrv.create(this.kongId, this.type, body);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.msgSrv.success(this.isEdit ? '保存成功' : '创建成功');
        this.modalRef.close(true);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.msgSrv.error(
          apiErrorMessage(
            err,
            this.isEdit
              ? `保存${this.name}失败，请稍后重试！`
              : `创建${this.name}失败，请稍后重试！`,
          ),
        );
      },
    });
  }

  /** 关闭弹窗 */
  close(): void {
    this.modalRef.close(false);
  }
}
