import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import type { SFSchema, SFUISchema } from '@delon/form';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';

import { businessError } from '../../tencent.format';
import { TencentService } from '../../tencent.service';

/** 重置密码弹窗入参 */
export interface PasswordData {
  /** 密钥ID */
  keyId: number;
  /** 地域 */
  region: string;
  /** 实例ID */
  instanceId: string;
}

/**
 * 重置实例密码组件
 *
 * 注：旧私有项目用 `window.prompt` 收密码（无法校验、也没有输入掩码），这里换成表单弹窗
 */
@Component({
  selector: 'tencent-password',
  templateUrl: './password.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class TencentPasswordComponent implements OnInit {
  private readonly tencentSrv = inject(TencentService);
  private readonly modalRef = inject(NzModalRef);
  private readonly msgSrv = inject(NzMessageService);
  /** 弹窗入参 */
  private readonly data = inject<PasswordData>(NZ_MODAL_DATA);

  /** 表单数据 */
  readonly formData = signal<Record<string, unknown> | null>(null);

  /** 表单 schema */
  readonly schema: SFSchema = {
    properties: {
      Password: { type: 'string', title: '新密码', minLength: 8, maxLength: 32 },
    },
    required: ['Password'],
  };

  /** 表单样式 */
  readonly ui: SFUISchema = {
    '*': { spanLabelFixed: 100, grid: { span: 24 } },
    $Password: { widget: 'password', type: 'password', placeholder: '8-32 位，含大小写字母与数字' },
  };

  /** 页面初始化 */
  ngOnInit(): void {
    this.formData.set({ Password: '' });
  }

  /**
   * 提交新密码
   *
   * @param value 表单值
   */
  save(value: Record<string, unknown>): void {
    /** 新密码 */
    const password = String(value['Password'] ?? '');
    this.tencentSrv
      .resetPassword(this.data.keyId, this.data.region, this.data.instanceId, password)
      .subscribe({
        next: (res) => {
          /** 业务错误 */
          const message = businessError(res);
          if (message) {
            this.msgSrv.error(message);
            return;
          }
          this.modalRef.close(true);
        },
        error: (err: unknown) =>
          this.msgSrv.error(apiErrorMessage(err, '密码重置失败，请稍后重试！')),
      });
  }

  /** 关闭弹窗 */
  close(): void {
    this.modalRef.close(false);
  }
}
