import { Routes } from '@angular/router';

import { DataBrowserComponent } from './browser/browser.component';
import { DataDashboardComponent } from './dashboard/dashboard.component';
import { DataSyncComponent } from './sync/sync.component';

/**
 * 行情数据路由
 *
 * 注：`/data` 重定向到仪表板（默认落地页），菜单上仪表板仍排「行情数据」组第一。
 */
export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DataDashboardComponent, data: { title: '仪表板' } },
  { path: 'sync', component: DataSyncComponent, data: { title: '数据同步' } },
  { path: 'browser', component: DataBrowserComponent, data: { title: '数据浏览' } },
];
