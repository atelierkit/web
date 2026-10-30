import { Routes } from '@angular/router';

import { AuthRoleComponent } from './role/role.component';
import { AuthTokenComponent } from './token/token.component';
import { AuthUserComponent } from './user/user.component';

/**
 * 访问控制路由
 *
 * 注：页面挂在主布局（`LayoutBasic`）下，导航由侧边菜单提供；
 * 旧私有项目的分类 / 产品两个页面不迁移
 */
export const routes: Routes = [
  { path: '', redirectTo: 'user', pathMatch: 'full' },
  { path: 'role', component: AuthRoleComponent, data: { title: '角色管理' } },
  { path: 'user', component: AuthUserComponent, data: { title: '用户管理' } },
  { path: 'token', component: AuthTokenComponent, data: { title: '令牌管理' } },
];
