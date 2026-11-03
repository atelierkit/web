import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { SHARED_IMPORTS } from '@shared';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';

/** 扩缩容弹窗入参 */
export interface KubernetesScaleData {
  /** 资源类型的中文名，注：只用于文案 */
  kind: string;
  /** 资源名 */
  name: string;
  /** 当前副本数 */
  replicas: number;
}

/**
 * 扩缩容弹窗
 *
 * 注 1：Deployment 与 StatefulSet 共用本组件，两者只有文案差异
 * 注 2：`nz-input-number` 的最小值给 0 —— 缩到 0 是合法操作（临时下线），
 * 但按钮上是「保存」而不是「确定」，页面另有一句提示说明副本为 0 的效果
 */
@Component({
  selector: 'kubernetes-scale',
  templateUrl: './scale.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class KubernetesScaleComponent {
  private readonly modalRef = inject(NzModalRef);
  /** 弹窗入参 */
  private readonly data = inject<KubernetesScaleData>(NZ_MODAL_DATA);

  /** 资源类型的中文名 */
  readonly kind = this.data?.kind ?? '';
  /** 资源名 */
  readonly name = this.data?.name ?? '';
  /** 目标副本数，注：`null` 表示输入框被清空，此时不允许提交 */
  readonly replicas = signal<number | null>(this.data?.replicas ?? 1);

  /**
   * 输入是否不可提交
   *
   * 注：模板里直接写 `replicas() === null || replicas() < 0` 会被严格模板判成
   * 「对象可能为 null」，抽出 getter 同时也让按钮禁用逻辑只有一处
   */
  get invalid(): boolean {
    /** 目标副本数 */
    const replicas = this.replicas();
    return replicas === null || !Number.isInteger(replicas) || replicas < 0;
  }

  /**
   * 提交副本数
   *
   * 注：`null`（清空输入框）时按 0 处理是不可接受的 —— 那等于把服务缩到零，
   * 故这里直接忽略，按钮的禁用态已经在模板里挡住了
   */
  save(): void {
    if (this.invalid) {
      return;
    }
    this.modalRef.close(this.replicas());
  }

  /** 关闭弹窗 */
  close(): void {
    this.modalRef.close();
  }
}
