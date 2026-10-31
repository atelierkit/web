import { Routes } from '@angular/router';

import { UserBasicComponent } from './basic/basic.component';
import { UserLayoutComponent } from './layout/layout.component';
import { UserPasswordComponent } from './password/password.component';
import { UserSecureComponent } from './secure/secure.component';
import { UserValidComponent } from './valid/valid.component';

/**
 * 账号管理路由
 *
 * 注 1：页面挂在主布局（`LayoutBasic`）下，四个子页面由布局的标签页串联，不占侧边菜单的多个格子
 * 注 2：子路由顺序必须与 `USER_TABS`（`user.format.ts`）一致 —— 标签下标是按数组下标算的
 */
export const routes: Routes = [
  {
    path: '',
    component: UserLayoutComponent,
    children: [
      { path: '', redirectTo: 'basic', pathMatch: 'full' },
      { path: 'basic', component: UserBasicComponent, data: { title: '基本资料' } },
      {
        path: 'password',
        component: UserPasswordComponent,
        data: { title: '修改密码' },
      },
      { path: 'secure', component: UserSecureComponent, data: { title: '更换邮箱' } },
      { path: 'valid', component: UserValidComponent, data: { title: '登录有效期' } },
      { path: '**', redirectTo: 'basic' },
    ],
  },
];
