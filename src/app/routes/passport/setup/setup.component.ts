import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PassportService, StartupService, apiErrorMessage } from '@core';
import { ReuseTabService } from '@delon/abc/reuse-tab';
import { MatchControl } from '@delon/util/form';
import { PASSWORD_MAX, PASSWORD_MIN, passwordValidator } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSafeAny } from 'ng-zorro-antd/core/types';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { finalize } from 'rxjs';

/**
 * 创建管理员页面
 *
 * 仅在系统未初始化时可访问，由 `setupGuard` 保证
 */
@Component({
  selector: 'passport-setup',
  templateUrl: './setup.component.html',
  styleUrls: ['./setup.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    NzAlertModule,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    NzIconModule,
  ],
})
export class SetupComponent {
  private readonly router = inject(Router);
  private readonly reuseTabService = inject(ReuseTabService, { optional: true });
  private readonly startupSrv = inject(StartupService);
  private readonly passportSrv = inject(PassportService);
  private readonly cdr = inject(ChangeDetectorRef);

  /** 管理员表单 */
  form = inject(FormBuilder).nonNullable.group(
    {
      username: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9_-]{3,20}$/)]],
      name: ['', [Validators.maxLength(30)]],
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
      email: ['', [Validators.email]],
      setupToken: [''],
    },
    { validators: MatchControl('password', 'confirm') },
  );
  /** 错误信息 */
  error = '';
  /** 加载标记 */
  loading = false;

  /**
   * 提交创建
   */
  submit(): void {
    this.error = '';
    Object.keys(this.form.controls).forEach((key) => {
      const control = (this.form.controls as NzSafeAny)[key] as AbstractControl;
      control.markAsDirty();
      control.updateValueAndValidity();
    });
    if (this.form.invalid) {
      return;
    }
    const { username, name, password, email, setupToken } = this.form.getRawValue();
    this.loading = true;
    this.cdr.detectChanges();
    this.passportSrv
      .setup({
        username,
        password,
        name: name || undefined,
        email: email || undefined,
        setupToken: setupToken || undefined,
      })
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          // 注：初始化成功即已登录，无需再走登录页
          this.reuseTabService?.clear();
          this.startupSrv.load().subscribe(() => this.router.navigateByUrl('/'));
        },
        error: (error: unknown) => {
          this.error = apiErrorMessage(error, '创建管理员失败，请稍后重试！');
          this.cdr.detectChanges();
        },
      });
  }
}
