import { Routes } from '@angular/router';
import { setupGuard, startPageGuard } from '@core';
import { authSimpleCanActivate, authSimpleCanActivateChild } from '@delon/auth';

import { LayoutBasic } from '../layout';
import { HomeComponent } from './home/home.component';

export const routes: Routes = [
  {
    path: '',
    component: LayoutBasic,
    // 注：初始化守卫必须排在最前 —— 未初始化时任何入口都要先被送去创建管理员
    canActivate: [setupGuard, startPageGuard, authSimpleCanActivate],
    canActivateChild: [authSimpleCanActivateChild],
    data: {},
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      { path: 'home', component: HomeComponent, data: { title: '首页' } },
      // 账号管理（基本资料 / 更换邮箱 / 登录有效期），注：不需要管理员角色，任何登录用户都能改自己的资料
      {
        path: 'user',
        data: { title: '账号管理' },
        loadChildren: () => import('./user/routes').then((m) => m.routes),
      },
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
      // 管理员（配置管理 / 操作日志 / 请求日志），注：接口一律按 @Allow('admin') 校验
      {
        path: 'admin',
        data: { title: '管理员' },
        loadChildren: () => import('./admin/routes').then((m) => m.routes),
      },
      // 行情数据（仪表板 / 数据同步 / 数据浏览），注：仪表板是默认落地页，菜单排组第一
      {
        path: 'data',
        data: { title: '行情数据' },
        loadChildren: () => import('./data/routes').then((m) => m.routes),
      },
      // 腾讯云（证书 / 域名 / 轻量服务器），注：入口是密钥列表里「服务商为腾讯云」那条的「管理」，
      // 不带密钥ID时无法渲染，故不放侧边菜单
      {
        path: 'tencent',
        data: { title: '腾讯云' },
        loadChildren: () => import('./tencent/routes').then((m) => m.routes),
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
