import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PassportService, StartupService, apiErrorMessage } from '@core';
import { ReuseTabService } from '@delon/abc/reuse-tab';
import { DA_SERVICE_TOKEN } from '@delon/auth';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { finalize } from 'rxjs';

@Component({
  selector: 'passport-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.less'],
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
export class UserLoginComponent {
  private readonly router = inject(Router);
  private readonly reuseTabService = inject(ReuseTabService, { optional: true });
  private readonly tokenService = inject(DA_SERVICE_TOKEN);
  private readonly startupSrv = inject(StartupService);
  private readonly passportSrv = inject(PassportService);
  private readonly cdr = inject(ChangeDetectorRef);

  /** 登录表单，注：只保留用户名 + 密码 */
  form = inject(FormBuilder).nonNullable.group({
    username: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9_-]{3,20}$/)]],
    password: ['', [Validators.required]],
  });
  /** 错误信息 */
  error = '';
  /** 加载标记 */
  loading = false;

  /**
   * 提交登录
   */
  submit(): void {
    this.error = '';
    const { username, password } = this.form.controls;
    username.markAsDirty();
    username.updateValueAndValidity();
    password.markAsDirty();
    password.updateValueAndValidity();
    if (this.form.invalid) {
      return;
    }
    this.loading = true;
    this.cdr.detectChanges();
    this.passportSrv
      .login({ username: username.value, password: password.value })
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          // 清空路由复用信息
          this.reuseTabService?.clear();
          // 重新获取 StartupService 内容，用户信息受当前登录账号影响
          this.startupSrv.load().subscribe(() => {
            /** 登录前的目标地址 */
            let url = this.tokenService.referrer?.url || '/';
            if (url.includes('/passport')) {
              url = '/';
            }
            this.router.navigateByUrl(url);
          });
        },
        error: (error: unknown) => {
          this.error = apiErrorMessage(error, '登录失败，请稍后重试！');
          this.cdr.detectChanges();
        },
      });
  }
}
