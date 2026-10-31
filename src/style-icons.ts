// Custom icon static resources
// 注：这些图标只在 TS 里以字符串形式出现（菜单配置、`nzIcon`），
// 自动生成脚本扫不到，必须手工注册，否则侧边栏会渲染成空白。
// 菜单里的每个 `icon.value` 都要在这里（或 style-icons-auto 里）有对应项，
// 该对应关系由 `src/app/core/startup/menu.constant.spec.ts` 自动校验。

import {
  ApiOutline,
  AppstoreOutline,
  AuditOutline,
  DashboardOutline,
  DatabaseOutline,
  FileTextOutline,
  IdcardOutline,
  KeyOutline,
  ProfileOutline,
  SafetyCertificateOutline,
  SyncOutline,
  TeamOutline,
} from '@ant-design/icons-angular/icons';

export const ICONS = [
  // 侧边菜单：仪表盘 / 个人资料 / 角色 / 令牌 / 密钥 / KONG 网关
  AppstoreOutline,
  IdcardOutline,
  TeamOutline,
  KeyOutline,
  SafetyCertificateOutline,
  ApiOutline,
  // 侧边菜单：配置管理 / 操作日志 / 请求日志（`setting` 由 style-icons-auto 注册）
  AuditOutline,
  FileTextOutline,
  // 侧边菜单：行情数据（仪表板 / 数据同步 / 数据浏览）
  DashboardOutline,
  SyncOutline,
  DatabaseOutline,
  // 表格行内「详情」按钮（ST 的 buttons.icon 是 TS 里的字符串，扫不到）
  ProfileOutline,
];
