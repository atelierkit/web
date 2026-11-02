import { Routes } from '@angular/router';

import { ExceptionComponent } from './exception.component';

// 注：不带 trigger —— 那是脚手架自带的调试页（手动触发 401/403/404/500、无效令牌），
// 与本站业务无关，2026-11-02 已连同页头菜单入口一并删除。
export const routes: Routes = [
  { path: '403', component: ExceptionComponent, data: { type: 403 } },
  { path: '404', component: ExceptionComponent, data: { type: 404 } },
  { path: '500', component: ExceptionComponent, data: { type: 500 } },
];
