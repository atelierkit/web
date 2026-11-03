import { Routes } from '@angular/router';

import { DockerContainerComponent } from './docker/container/container.component';
import { DockerDashboardComponent } from './docker/dashboard/dashboard.component';
import { CloudDockerDetailComponent } from './docker/detail/detail.component';
import { CloudDockerComponent } from './docker/docker.component';
import { DockerImageComponent } from './docker/image/image.component';
import { DockerNetworkComponent } from './docker/network/network.component';
import { DockerVolumeComponent } from './docker/volume/volume.component';
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
 * 注 1：密钥管理、KONG 网关站点、Docker 宿主机三个入口；两个站点的「管理」分别进入
 * `kong/:id` 与 `docker/:id`，其下的标签页由对应的详情组件依据本文件的 `children` 生成导航
 * 注 2：`kong` / `docker` 列表页必须 `pathMatch: 'full'` —— 否则 `/cloud/kong/3/dashboard`
 * 会先命中列表页
 */
export const routes: Routes = [
  { path: '', redirectTo: 'key', pathMatch: 'full' },
  { path: 'key', component: CloudKeyComponent, data: { title: '密钥管理' } },
  {
    path: 'docker',
    pathMatch: 'full',
    component: CloudDockerComponent,
    data: { title: 'Docker 宿主机' },
  },
  {
    path: 'docker/:id',
    component: CloudDockerDetailComponent,
    data: { title: 'Docker 宿主机' },
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        component: DockerDashboardComponent,
        data: { title: '仪表板' },
      },
      {
        path: 'container',
        component: DockerContainerComponent,
        data: { title: '容器' },
      },
      { path: 'image', component: DockerImageComponent, data: { title: '镜像' } },
      {
        path: 'volume',
        component: DockerVolumeComponent,
        data: { title: '数据卷' },
      },
      {
        path: 'network',
        component: DockerNetworkComponent,
        data: { title: '网络' },
      },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
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
