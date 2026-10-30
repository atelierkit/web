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
