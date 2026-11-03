// Custom icon static resources
// 注：这些图标只在 TS 里以字符串形式出现（菜单配置、`nzIcon`），
// 自动生成脚本扫不到，必须手工注册，否则侧边栏会渲染成空白。
// 菜单里的每个 `icon.value` 都要在这里（或 style-icons-auto 里）有对应项，
// 该对应关系由 `src/app/core/startup/menu.constant.spec.ts` 自动校验；
// 布局折叠按钮也是拼名引用，由 `src/style-icons.spec.ts` 校验。

import {
  ApiOutline,
  AppstoreOutline,
  AuditOutline,
  ClusterOutline,
  ContainerOutline,
  DashboardOutline,
  DatabaseOutline,
  FileProtectOutline,
  FileTextOutline,
  HomeOutline,
  IdcardOutline,
  KeyOutline,
  LaptopOutline,
  MenuFoldOutline,
  MenuUnfoldOutline,
  ProfileOutline,
  SafetyCertificateOutline,
  SyncOutline,
  TeamOutline,
} from '@ant-design/icons-angular/icons';

export const ICONS = [
  // 侧边菜单：首页 / 个人资料 / 角色 / 令牌 / 密钥 / KONG 网关 / Docker 宿主机 / Kubernetes 集群 / 远程连接
  HomeOutline,
  IdcardOutline,
  TeamOutline,
  KeyOutline,
  SafetyCertificateOutline,
  ApiOutline,
  ContainerOutline,
  ClusterOutline,
  LaptopOutline,
  // 侧边菜单：配置列表 / 操作日志 / 请求日志（`setting` 由 style-icons-auto 注册）
  AuditOutline,
  FileTextOutline,
  // 侧边菜单：应用配置 / 备案配置
  AppstoreOutline,
  FileProtectOutline,
  // 侧边菜单：行情数据（仪表板 / 数据同步 / 数据浏览）
  DashboardOutline,
  SyncOutline,
  DatabaseOutline,
  // 表格行内「详情」按钮（ST 的 buttons.icon 是 TS 里的字符串，扫不到）
  ProfileOutline,
  // 布局侧边栏的折叠/展开按钮：图标名由 `@delon/theme` 的 layout-default 内部按
  // `menu-${fold|unfold}` 拼出来（折起来时是 `menu-unfold`，展开时是 `menu-fold`），
  // 既不出现在模板里、也不出现在菜单配置里，脚本扫不到，必须手工登记，
  // 否则折叠到只剩图标条时那个位置就是一个空白方块，点了没反应也看不出是按钮。
  MenuFoldOutline,
  MenuUnfoldOutline,
];
