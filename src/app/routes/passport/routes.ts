import { Routes } from '@angular/router';
import { authSimpleCanActivate } from '@delon/auth';

import { LayoutPassport } from '../../layout';
import { PassportActivateComponent } from './activate/activate.component';
import { CallbackComponent } from './callback.component';
import { UserLockComponent } from './lock/lock.component';
import { UserLoginComponent } from './login/login.component';
import { PassportResetComponent } from './reset/reset.component';
import { SetupComponent } from './setup/setup.component';

export const routes: Routes = [
  // 邮箱激活，注：独立页面 —— 不进 LayoutPassport，那个布局进页面即清令牌，会把点邮件链接的用户登出
  {
    path: 'passport/activate/:code',
    component: PassportActivateComponent,
    data: { title: '激活新邮箱' },
  },
  // 屏幕锁定，注：同样独立于 LayoutPassport —— 解锁是登录态操作（从令牌取用户），
  // 进入锁定页必须保留令牌，且需登录守卫挡住未登录访问
  {
    path: 'passport/lock',
    component: UserLockComponent,
    canActivate: [authSimpleCanActivate],
    data: { title: '锁屏' },
  },
  // passport
  {
    path: 'passport',
    component: LayoutPassport,
    children: [
      {
        path: 'login',
        component: UserLoginComponent,
        data: { title: '登录' },
      },
      {
        // 忘记密码：邮箱验证码重置，注：与登录页同布局，进来即清本地令牌（重置后令牌本来也会全失效）
        path: 'reset',
        component: PassportResetComponent,
        data: { title: '重置密码' },
      },
      {
        // 首次部署创建管理员，注：由 setupGuard 保证只在未初始化时可访问
        path: 'setup',
        component: SetupComponent,
        data: { title: '创建管理员' },
      },
    ],
  },
  // 单页不包裹Layout
  { path: 'passport/callback/:type', component: CallbackComponent },
];
