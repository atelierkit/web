import { Routes } from '@angular/router';
import { setupGuard, startPageGuard } from '@core';
import { authSimpleCanActivate, authSimpleCanActivateChild } from '@delon/auth';

import { LayoutBasic } from '../layout';
import { DashboardComponent } from './dashboard/dashboard.component';

export const routes: Routes = [
  {
    path: '',
    component: LayoutBasic,
    // 注：初始化守卫必须排在最前 —— 未初始化时任何入口都要先被送去创建管理员
    canActivate: [setupGuard, startPageGuard, authSimpleCanActivate],
    canActivateChild: [authSimpleCanActivateChild],
    data: {},
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      // 访问控制（用户 / 角色 / 令牌），注：页面挂在主布局下，导航走侧边菜单
      {
        path: 'auth',
        data: { title: '访问控制' },
        loadChildren: () => import('./auth/routes').then((m) => m.routes),
      },
      // 云服务（密钥管理 / KONG 网关站点），注：页面挂在主布局下，导航走侧边菜单
      {
        path: 'cloud',
        data: { title: '云服务' },
        loadChildren: () => import('./cloud/routes').then((m) => m.routes),
      },
    ],
  },
  // passport
  {
    path: '',
    canActivate: [setupGuard],
    loadChildren: () => import('./passport/routes').then((m) => m.routes),
  },
  {
    path: 'exception',
    canActivate: [setupGuard],
    loadChildren: () => import('./exception/routes').then((m) => m.routes),
  },
  { path: '**', redirectTo: 'exception/404' },
];
