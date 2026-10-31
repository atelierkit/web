import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '@core';
import { DA_SERVICE_TOKEN } from '@delon/auth';
import { SettingsService, User } from '@delon/theme';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { finalize } from 'rxjs';

import { UserService } from '../../user/user.service';

/**
 * 屏幕锁定组件
 *
 * 注：解锁是登录态操作（后端从令牌取用户），因此本页必须保留令牌 —— 不能挂在
 * LayoutPassport 下（那个布局进入即清令牌），路由上单独注册并加登录守卫
 */
@Component({
  selector: 'passport-lock',
  templateUrl: './lock.component.html',
  styleUrls: ['./lock.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    NzAvatarModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    NzIconModule,
  ],
})
export class UserLockComponent {
  private readonly userSrv = inject(UserService);
  private readonly settings = inject(SettingsService);
  private readonly router = inject(Router);
  private readonly tokenService = inject(DA_SERVICE_TOKEN);
  private readonly cdr = inject(ChangeDetectorRef);

  /** 解锁表单 */
  f = inject(FormBuilder).nonNullable.group({
    password: ['', [Validators.required]],
  });

  get user(): User {
    return this.settings.user;
  }

  /** 失败提示 */
  error = '';
  /** 提交请求在途 */
  loading = false;

  /**
   * 提交解锁
   */
  submit(): void {
    this.error = '';
    const { password } = this.f.controls;
    password.markAsDirty();
    password.updateValueAndValidity();
    if (this.f.invalid) {
      return;
    }
    this.loading = true;
    this.cdr.detectChanges();
    this.userSrv
      .unlock(password.value)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => this.router.navigateByUrl('/'),
        error: (err: unknown) => {
          this.error = apiErrorMessage(err, '解锁失败，请稍后重试！');
          this.cdr.detectChanges();
        },
      });
  }

  /**
   * 退出登录
   *
   * 注：锁定页保留了令牌，用户忘了密码时可从这里回到登录页
   */
  logout(): void {
    this.tokenService.clear();
    this.router.navigateByUrl(this.tokenService.login_url!);
  }
}
