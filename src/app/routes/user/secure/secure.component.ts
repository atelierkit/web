import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import { SFSchema, SFUISchema } from '@delon/form';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzResultModule } from 'ng-zorro-antd/result';
import { finalize } from 'rxjs';

import { UserService } from '../user.service';

/**
 * 更换邮箱组件
 *
 * 注 1：提交后并不会立即改绑 —— 后端只发一封激活邮件，必须点邮件里的链接（`/passport/activate/:code`）
 * 才算改完，所以成功后这里切到「请激活新邮箱」的结果页
 * 注 2：激活链接 30 分钟内有效，文案由后端缓存有效期决定，前端只做提示
 */
@Component({
  selector: 'user-secure',
  templateUrl: './secure.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS, NzResultModule],
})
export class UserSecureComponent implements OnInit {
  private readonly userSrv = inject(UserService);
  private readonly msgSrv = inject(NzMessageService);

  /** 是否已发出激活邮件，注：为 true 时展示结果页而不是表单 */
  readonly sent = signal(false);
  /** 待激活的新邮箱 */
  readonly email = signal('');
  /** 失败提示 */
  readonly message = signal('');
  /** 表单数据 */
  readonly formData = signal<Record<string, unknown>>({ email: '' });
  /** 提交请求在途 */
  readonly saving = signal(false);

  /** 表单配置 */
  readonly schema: SFSchema = {
    properties: { email: { type: 'string', title: '新邮箱', format: 'email' } },
    required: ['email'],
  };

  /** 表单样式配置，注：改动输入即清掉上一次的失败提示 */
  readonly ui: SFUISchema = {
    '*': { spanLabelFixed: 100, size: 'large', grid: { span: 24 } },
    $email: { placeholder: '新邮箱地址', change: () => this.message.set('') },
  };

  /** 页面初始化，回填当前邮箱 */
  ngOnInit(): void {
    this.userSrv.show().subscribe({
      next: (user) => this.formData.set({ email: user.email ?? '' }),
      error: (err: unknown) =>
        this.msgSrv.error(apiErrorMessage(err, '加载当前邮箱失败，请稍后重试！')),
    });
  }

  /**
   * 提交邮箱修改
   *
   * @param value SF 表单提交值
   */
  submit(value: Record<string, unknown>): void {
    // 前置守卫：请求在途时直接忽略，避免重复发送激活邮件
    if (this.saving()) {
      return;
    }
    /** 新邮箱，注：后端会再归一化一次（trim + 转小写） */
    const email = String(value['email'] ?? '').trim();
    if (!email) {
      this.message.set('请输入新邮箱！');
      return;
    }
    this.saving.set(true);
    this.userSrv
      .changeEmail(email)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.email.set(email);
          this.sent.set(true);
        },
        error: (err: unknown) =>
          this.message.set(apiErrorMessage(err, '邮箱修改失败，请稍后重试！')),
      });
  }
}
