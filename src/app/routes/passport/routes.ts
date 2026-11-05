import { Routes } from '@angular/router';

import { CallbackComponent } from './callback.component';
import { LayoutPassport } from '../../layout';
import { UserLoginComponent } from './login/login.component';
import { PassportResetComponent } from './reset/reset.component';
import { SetupComponent } from './setup/setup.component';

export const routes: Routes = [
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
