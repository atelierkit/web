import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PassportService, apiErrorMessage } from '@core';
import { MatchControl } from '@delon/util/form';
import { PASSWORD_MAX, PASSWORD_MIN, passwordValidator } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzResultModule } from 'ng-zorro-antd/result';
import { finalize } from 'rxjs';

/** 验证码位数，注：后端 `random(6, 'number')` 生成 6 位数字 */
const CODE_LENGTH = 6;

/** 验证码格式 */
const CODE_PATTERN = new RegExp(`^\\d{${CODE_LENGTH}}$`);

/** 重发验证码的冷却秒数，注：后端对同一邮箱也限流 60 秒一次 */
const RESEND_SECONDS = 60;

/**
 * 重置密码组件
 *
 * 注 1：旧私有项目没有密码体系（邮箱 + 授权码），本仓库改为「用户名 + 密码」后，
 * 「忘记密码」必须自己实现 —— 账号由管理员创建，用户改不了密码就只能找管理员
 * 注 2：验证码走 `passport/reset`、提交走 `passport/reset/confirm`，两者都是公开接口（`/passport` 前缀由
 * 守卫放行），与登录态无关，所以直接挂在登录页同一布局（`LayoutPassport`）下
 * 注 3：后端对「邮箱不存在 / 账号禁用」也回同一句文案，所以提示只写「如果该邮箱已绑定账号」
 */
@Component({
  selector: 'passport-reset',
  templateUrl: './reset.component.html',
  styleUrls: ['./reset.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    NzIconModule,
    NzResultModule,
  ],
})
export class PassportResetComponent implements OnDestroy {
  private readonly passportSrv = inject(PassportService);
  private readonly formBuilder = inject(FormBuilder);

  /** 重置表单 */
  readonly form = this.formBuilder.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email]],
      code: ['', [Validators.required, Validators.pattern(CODE_PATTERN)]],
      password: [
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
    { validators: MatchControl('password', 'confirm') },
  );

  /** 失败提示 */
  readonly error = signal('');
  /** 验证码发送提示 */
  readonly notice = signal('');
  /** 提交请求在途 */
  readonly loading = signal(false);
  /** 验证码发送在途 */
  readonly sending = signal(false);
  /** 重发倒计时（秒），注：大于 0 时禁止重复发送 */
  readonly countdown = signal(0);
  /** 是否已重置成功，注：为 true 时展示结果页 */
  readonly done = signal(false);

  /** 倒计时定时器 */
  private timer: ReturnType<typeof setInterval> | null = null;

  /** 组件销毁时清掉定时器，避免离开页面后还在跑 */
  ngOnDestroy(): void {
    this.stopTimer();
  }

  /** 发送邮箱验证码 */
  sendCode(): void {
    this.error.set('');
    /** 邮箱控件 */
    const email = this.form.controls.email;
    // 注：只校验邮箱这一项 —— 此时用户还没填验证码与新密码，整表校验必然不通过
    email.markAsDirty();
    email.updateValueAndValidity();
    if (email.invalid || this.sending() || this.countdown() > 0) {
      return;
    }
    this.sending.set(true);
    this.passportSrv
      .resetCode(email.value)
      .pipe(finalize(() => this.sending.set(false)))
      .subscribe({
        next: (res) => {
          this.notice.set(res?.msg ?? '如果该邮箱已绑定账号，验证码已发送，请查收！');
          this.startCountdown();
        },
        error: (err: unknown) =>
          this.error.set(apiErrorMessage(err, '验证码发送失败，请稍后重试！')),
      });
  }

  /** 提交重置 */
  submit(): void {
    this.error.set('');
    // 注：未触碰过的控件不会显示校验错误，这里统一标记，用户点提交时才看得到哪里不对
    Object.values(this.form.controls).forEach((control) => {
      control.markAsDirty();
      control.updateValueAndValidity();
    });
    if (this.form.invalid) {
      return;
    }
    /** 表单值 */
    const { email, code, password } = this.form.getRawValue();
    this.loading.set(true);
    this.passportSrv
      .reset({ email, code, password })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          this.stopTimer();
          this.done.set(true);
        },
        error: (err: unknown) => this.error.set(apiErrorMessage(err, '密码重置失败，请稍后重试！')),
      });
  }

  /** 开始重发倒计时 */
  private startCountdown(): void {
    this.stopTimer();
    this.countdown.set(RESEND_SECONDS);
    this.timer = setInterval(() => {
      /** 剩余秒数 */
      const left = this.countdown() - 1;
      this.countdown.set(left);
      if (left <= 0) {
        this.stopTimer();
      }
    }, 1000);
  }

  /** 停止重发倒计时 */
  private stopTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
