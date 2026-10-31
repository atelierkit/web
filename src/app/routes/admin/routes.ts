import { Routes } from '@angular/router';

import { AdminOperateComponent } from './operate/operate.component';
import { AdminReqComponent } from './req/req.component';
import { AdminSettingAppComponent } from './setting/app/app.component';
import { AdminSettingIcpComponent } from './setting/icp/icp.component';
import { AdminSettingListComponent } from './setting/list/list.component';

/**
 * 管理员路由
 *
 * 注 1：页面挂在主布局（`LayoutBasic`）下，导航由侧边菜单提供
 * 注 2：旧私有项目的 `admin/task` 与 `admin/dashboard` **不迁移** —— 前者表格列是用户字段却调
 * `kong/*`（站点）接口、后端也没有任务接口；后者根本没挂路由，且功能已被 `cloud/kong/dashboard` 取代
 */
export const routes: Routes = [
  { path: '', redirectTo: 'list', pathMatch: 'full' },
  { path: 'list', component: AdminSettingListComponent, data: { title: '配置列表' } },
  { path: 'app', component: AdminSettingAppComponent, data: { title: '应用配置' } },
  { path: 'icp', component: AdminSettingIcpComponent, data: { title: '备案配置' } },
  { path: 'operate', component: AdminOperateComponent, data: { title: '操作日志' } },
  { path: 'req', component: AdminReqComponent, data: { title: '请求日志' } },
];
