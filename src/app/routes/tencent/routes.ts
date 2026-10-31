import { Routes } from '@angular/router';

import { TencentDnsComponent } from './dns/dns.component';
import { TencentDomainComponent } from './domain/domain.component';
import { TencentFirewallComponent } from './firewall/firewall.component';
import { TencentLayoutComponent } from './layout/layout.component';
import { TencentLighthouseComponent } from './lighthouse/lighthouse.component';
import { TencentSslComponent } from './ssl/ssl.component';

/**
 * 腾讯云路由
 *
 * 注 1：`:id` 是**云服务密钥ID**，与 `/cloud/key` 里的记录一一对应；布局组件负责页头与标签页
 * 注 2：DNS 记录与防火墙是二级页面（域名的 / 实例的），不占一级标签，但仍挂在布局下
 * 注 3：`lighthouse` 与 `lighthouse/:region` 用同一个组件 —— 没有地域时由组件补全地址
 */
export const routes: Routes = [
  {
    path: ':id',
    component: TencentLayoutComponent,
    children: [
      { path: '', redirectTo: 'ssl', pathMatch: 'full' },
      { path: 'ssl', component: TencentSslComponent, data: { title: '证书' } },
      { path: 'domain', component: TencentDomainComponent, data: { title: '域名' } },
      {
        path: 'dns/:grade/:domain',
        component: TencentDnsComponent,
        data: { title: '解析记录' },
      },
      {
        path: 'lighthouse',
        component: TencentLighthouseComponent,
        data: { title: '轻量服务器' },
      },
      {
        path: 'lighthouse/:region',
        component: TencentLighthouseComponent,
        data: { title: '轻量服务器' },
      },
      {
        path: 'firewall/:region/:instance',
        component: TencentFirewallComponent,
        data: { title: '防火墙' },
      },
      { path: '**', redirectTo: 'ssl' },
    ],
  },
];
