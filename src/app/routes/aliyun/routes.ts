import { Routes } from '@angular/router';

import { AliyunContactComponent } from './contact/contact.component';
import { AliyunLayoutComponent } from './layout/layout.component';
import { AliyunOrderComponent } from './order/order.component';
import { AliyunSslComponent } from './ssl/ssl.component';

/**
 * 阿里云路由
 *
 * 注 1：`:id` 是**云服务密钥ID**，与 `/cloud/key` 里的记录一一对应；布局组件负责页头与标签页
 * 注 2：三个标签并列 —— 证书、订单、联系人。证书是默认落地页
 */
export const routes: Routes = [
  {
    path: ':id',
    component: AliyunLayoutComponent,
    children: [
      { path: '', redirectTo: 'ssl', pathMatch: 'full' },
      { path: 'ssl', component: AliyunSslComponent, data: { title: '证书' } },
      { path: 'order', component: AliyunOrderComponent, data: { title: '订单' } },
      {
        path: 'contact',
        component: AliyunContactComponent,
        data: { title: '联系人' },
      },
      { path: '**', redirectTo: 'ssl' },
    ],
  },
];
