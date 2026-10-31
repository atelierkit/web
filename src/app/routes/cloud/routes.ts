import { Routes } from '@angular/router';

import { CloudKeyComponent } from './key/key.component';
import { KongCertificateComponent } from './kong/certificate/certificate.component';
import { KongConsumerComponent } from './kong/consumer/consumer.component';
import { KongDashboardComponent } from './kong/dashboard/dashboard.component';
import { CloudKongDetailComponent } from './kong/detail/detail.component';
import { CloudKongComponent } from './kong/kong.component';
import { KongPluginComponent } from './kong/plugin/plugin.component';
import { KongRouteComponent } from './kong/route/route.component';
import { KongServiceComponent } from './kong/service/service.component';
import { KongUpstreamComponent } from './kong/upstream/upstream.component';

/**
 * 云服务路由
 *
 * 注 1：密钥管理与 KONG 网关站点两个入口；站点列表的「管理」进入 `kong/:id`，
 * 其下七个标签页由 `CloudKongDetailComponent` 依据本文件的 `children` 生成导航
 * 注 2：`kong` 列表页必须 `pathMatch: 'full'` —— 否则 `/cloud/kong/3/dashboard` 也会先命中它
 */
export const routes: Routes = [
  { path: '', redirectTo: 'key', pathMatch: 'full' },
  { path: 'key', component: CloudKeyComponent, data: { title: '密钥管理' } },
  {
    path: 'kong',
    pathMatch: 'full',
    component: CloudKongComponent,
    data: { title: 'KONG 网关' },
  },
  {
    path: 'kong/:id',
    component: CloudKongDetailComponent,
    data: { title: 'KONG 网关' },
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        component: KongDashboardComponent,
        data: { title: '仪表板' },
      },
      { path: 'route', component: KongRouteComponent, data: { title: '路由' } },
      {
        path: 'service',
        component: KongServiceComponent,
        data: { title: '服务' },
      },
      {
        path: 'consumer',
        component: KongConsumerComponent,
        data: { title: '用户' },
      },
      {
        path: 'upstream',
        component: KongUpstreamComponent,
        data: { title: '上游' },
      },
      {
        path: 'certificate',
        component: KongCertificateComponent,
        data: { title: '证书' },
      },
      {
        path: 'plugin',
        component: KongPluginComponent,
        data: { title: '插件' },
      },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
