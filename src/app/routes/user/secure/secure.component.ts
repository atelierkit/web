import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { apiErrorMessage } from '@core';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzResultModule } from 'ng-zorro-antd/result';
import { finalize } from 'rxjs';

import { UserService } from '../user.service';

/** 验证码位数，注：后端 `random(6, 'number')` 生成 6 位数字 */
const CODE_LENGTH = 6;

/** 验证码格式 */
const CODE_PATTERN = new RegExp(`^\\d{${CODE_LENGTH}}$`);

/** 重发验证码的冷却秒数，注：后端对同一账号也限流 60 秒一次 */
const RESEND_SECONDS = 60;

/**
 * 更换邮箱组件
 *
 * 注 1：分两步 —— ① 填新邮箱，由后端把验证码发到**新邮箱**（证明该地址能收信）；
 *      ② 填验证码确认，后端校验通过才真正改绑。旧版「发激活链接、去邮件里点链接」的流程已下线
 * 注 2：第二步不允许再改邮箱 —— 验证码与发送时的地址绑定，改了就必然对不上，要换地址只能回上一步重来
 * 注 3：验证码有效期 2 分钟、同账号 60 秒只能发一次；提示文案取后端 `msg`，前端只维护倒计时
 * 注 4：只有表单区套 `.user-form` 收窄居中（见 `../form-layout.less`），成功态的结果页仍按满宽展示
 */
@Component({
  selector: 'user-secure',
  templateUrl: './secure.component.html',
  styleUrl: './secure.component.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS, NzResultModule],
})
export class UserSecureComponent implements OnInit, OnDestroy {
  private readonly userSrv = inject(UserService);
  private readonly msgSrv = inject(NzMessageService);

  /** 表单：新邮箱 + 验证码 */
  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    code: ['', [Validators.required, Validators.pattern(CODE_PATTERN)]],
  });

  /** 当前已绑定邮箱，注：仅用于展示，未绑定时为空串 */
  readonly current = signal('');
  /** 验证码是否已发出，注：为 true 时进入第二步 */
  readonly sent = signal(false);
  /** 已发出验证码的邮箱，注：第二步只读展示，避免与验证码绑定的地址对不上 */
  readonly target = signal('');
  /** 发送/重发提示 */
  readonly notice = signal('');
  /** 失败提示 */
  readonly error = signal('');
  /** 发送验证码在途 */
  readonly sending = signal(false);
  /** 提交确认在途 */
  readonly saving = signal(false);
  /** 重发倒计时（秒），注：大于 0 时禁止重复发送 */
  readonly countdown = signal(0);
  /** 是否已改绑成功，注：为 true 时展示结果页 */
  readonly done = signal(false);

  /** 倒计时定时器 */
  private timer: ReturnType<typeof setInterval> | null = null;

  /**
   * 页面初始化，取当前邮箱
   *
   * 注：只用于展示，**不回填到输入框** —— 新邮箱与当前邮箱相同会被后端判为「无需修改」，
   * 预填只会让用户白白吃一次 422
   */
  ngOnInit(): void {
    this.userSrv.show().subscribe({
      next: (user) => this.current.set(user.email ?? ''),
      error: (err: unknown) =>
        this.msgSrv.error(apiErrorMessage(err, '加载当前邮箱失败，请稍后重试！')),
    });
  }

  /** 组件销毁时清掉定时器，避免离开页面后还在跑 */
  ngOnDestroy(): void {
    this.stopTimer();
  }

  /**
   * 第一步：把验证码发到新邮箱
   *
   * 注：第二步的重发也走这里，读取的是表单里那个未变过的邮箱
   */
  sendCode(): void {
    this.error.set('');
    /** 邮箱控件 */
    const email = this.form.controls.email;
    // 注：只校验邮箱这一项 —— 此时用户还没填验证码，整表校验必然不通过
    email.markAsDirty();
    email.updateValueAndValidity();
    if (email.invalid || this.sending() || this.countdown() > 0) {
      return;
    }
    /** 目标邮箱，注：后端会再归一化一次（trim + 转小写） */
    const target = email.value.trim();
    this.sending.set(true);
    this.userSrv
      .sendEmailCode(target)
      .pipe(finalize(() => this.sending.set(false)))
      .subscribe({
        next: (res) => {
          this.target.set(target);
          this.sent.set(true);
          this.notice.set(res?.msg ?? `验证码已发送至${target}，请及时查收！`);
          this.startCountdown();
        },
        error: (err: unknown) =>
          this.error.set(apiErrorMessage(err, '验证码发送失败，请稍后重试！')),
      });
  }

  /** 第二步：提交验证码完成改绑 */
  submit(): void {
    this.error.set('');
    /** 验证码控件 */
    const code = this.form.controls.code;
    // 注：未触碰过的控件不会显示校验错误，这里标记一下，用户点提交时才看得到哪里不对
    code.markAsDirty();
    code.updateValueAndValidity();
    if (code.invalid || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.userSrv
      .confirmEmail(this.target(), code.value.trim())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.stopTimer();
          // 注：页头与侧栏读 `SettingsService.user`，改完必须写回，否则要刷新整页才变
          this.userSrv.syncProfile({ email: this.target() });
          this.current.set(this.target());
          this.done.set(true);
        },
        error: (err: unknown) => this.error.set(apiErrorMessage(err, '邮箱修改失败，请稍后重试！')),
      });
  }

  /** 返回第一步重新填写，注：倒计时不清 —— 后端同样会按 60 秒拦一次 */
  back(): void {
    this.sent.set(false);
    this.error.set('');
    this.notice.set('');
    this.form.controls.code.reset('');
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
