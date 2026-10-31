import { Routes } from '@angular/router';

import { CloudKeyComponent } from './key/key.component';
import { CloudKongComponent } from './kong/kong.component';

/**
 * 云服务路由
 *
 * 注：密钥管理与 KONG 网关站点两个页面；站点下的对象管理（services / routes / plugins 等）
 * 暂不迁移，故站点列表里不再提供「管理」入口
 */
export const routes: Routes = [
  { path: '', redirectTo: 'key', pathMatch: 'full' },
  { path: 'key', component: CloudKeyComponent, data: { title: '密钥管理' } },
  { path: 'kong', component: CloudKongComponent, data: { title: 'KONG 网关' } },
];
