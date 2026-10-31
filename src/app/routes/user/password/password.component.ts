import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { apiErrorMessage } from '@core';
import { MatchControl } from '@delon/util/form';
import { PASSWORD_MAX, PASSWORD_MIN, SHARED_IMPORTS, passwordValidator } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { finalize } from 'rxjs';

import { UserService } from '../user.service';

/**
 * 修改密码组件
 *
 * 注 1：旧私有项目的 user 模块没有密码管理（账号是邮箱 + 授权码体系），本仓库改为
 * 「用户名 + 密码」登录，因此改密必须是个人中心的独立一页
 * 注 2：后端会先校验原密码，再作废旧会话、保留当前令牌 —— 成功文案里的「已退出 N 个其它会话」
 * 直接取后端 `msg`，前端不自己拼
 * 注 3：从未设置过密码的历史账号会被后端拒（409），提示用户去登录页用邮件验证码设置
 */
@Component({
  selector: 'user-password',
  templateUrl: './password.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class UserPasswordComponent {
  private readonly userSrv = inject(UserService);
  private readonly msgSrv = inject(NzMessageService);

  /** 改密表单 */
  readonly form = inject(FormBuilder).nonNullable.group(
    {
      oldPassword: ['', [Validators.required]],
      newPassword: [
        '',
        [
          Validators.required,
          Validators.minLength(PASSWORD_MIN),
          Validators.maxLength(PASSWORD_MAX),
          passwordValidator,
        ],
      ],
      confirm: ['', [Validators.required]],
    },
    // 注：两次输入不一致时把错误挂到 confirm 上，由模板的 matchControl 提示
    { validators: MatchControl('newPassword', 'confirm') },
  );

  /** 失败提示 */
  readonly error = signal('');
  /** 提交请求在途 */
  readonly loading = signal(false);

  /** 提交改密 */
  submit(): void {
    this.error.set('');
    // 注：未触碰过的控件不会显示校验错误，这里统一标记，用户点保存时才看得到哪里不对
    Object.values(this.form.controls).forEach((control) => {
      control.markAsDirty();
      control.updateValueAndValidity();
    });
    if (this.form.invalid) {
      return;
    }
    /** 表单值 */
    const { oldPassword, newPassword } = this.form.getRawValue();
    this.loading.set(true);
    this.userSrv
      .changePassword({ oldPassword, newPassword })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.msgSrv.success(res?.msg ?? '密码修改成功！');
          // 注：成功后立刻清空表单，避免明文密码留在页面状态里
          this.form.reset({ oldPassword: '', newPassword: '', confirm: '' });
        },
        error: (err: unknown) => this.error.set(apiErrorMessage(err, '密码修改失败，请稍后重试！')),
      });
  }
}
