import { Routes } from '@angular/router';

import { CallbackComponent } from './callback.component';
import { LayoutPassport } from '../../layout';
import { UserLockComponent } from './lock/lock.component';
import { UserLoginComponent } from './login/login.component';
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
        // 首次部署创建管理员，注：由 setupGuard 保证只在未初始化时可访问
        path: 'setup',
        component: SetupComponent,
        data: { title: '创建管理员' },
      },
      {
        path: 'lock',
        component: UserLockComponent,
        data: { title: '锁屏' },
      },
    ],
  },
  // 单页不包裹Layout
  { path: 'passport/callback/:type', component: CallbackComponent },
];
