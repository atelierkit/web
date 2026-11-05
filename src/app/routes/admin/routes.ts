import { Routes } from '@angular/router';

import { AdminOperateComponent } from './operate/operate.component';
import { AdminReqComponent } from './req/req.component';
import { AdminSettingAppComponent } from './setting/app/app.component';
import { AdminSettingEmailComponent } from './setting/email/email.component';
import { AdminSettingIcpComponent } from './setting/icp/icp.component';
import { AdminSettingListComponent } from './setting/list/list.component';

/**
 * 管理员路由
 *
 * 注 1：页面挂在主布局（`LayoutBasic`）下，导航由侧边菜单提供
 * 注 2：本模块只有配置与日志两类页面；密钥与 KONG / Docker / Kubernetes / 远程连接在「云服务」分组（`/cloud/*`）
 */
export const routes: Routes = [
  { path: '', redirectTo: 'list', pathMatch: 'full' },
  { path: 'list', component: AdminSettingListComponent, data: { title: '配置列表' } },
  { path: 'app', component: AdminSettingAppComponent, data: { title: '应用配置' } },
  { path: 'icp', component: AdminSettingIcpComponent, data: { title: '备案配置' } },
  { path: 'email', component: AdminSettingEmailComponent, data: { title: '邮件配置' } },
  { path: 'operate', component: AdminOperateComponent, data: { title: '操作日志' } },
  { path: 'req', component: AdminReqComponent, data: { title: '请求日志' } },
];
