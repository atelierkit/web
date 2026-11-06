// Custom icon static resources
// 注：这些图标只在 TS 里以字符串形式出现（菜单配置、`nzIcon`、表格按钮），
// 自动生成脚本扫不到，必须手工注册，否则侧边栏会渲染成空白、按钮图标抛错。
// 菜单里的每个 `icon.value` 都要在这里（或 style-icons-auto 里）有对应项，
// 该对应关系由 `src/app/core/startup/menu.constant.spec.ts` 自动校验；
// 布局折叠按钮也是拼名引用，由 `src/style-icons.spec.ts` 校验；
// 模板 / 行内模板里的图标由 `ng g ng-alain:plugin icon` 写进 `style-icons-auto.ts`，
// **但下面「生成器白名单」那一段是例外**（见该段注释）。
//
// ⚠️ 报错文案里的名字带主题后缀：`cloud-upload-o`、`stop-o` 里的 `-o` 是
// `@ant-design/icons-angular` 拼的（`parseIconType()` 在未指定 theme 时补 `-o`，
// 因为 `Outline` 主题的登记键就是 `<name>-o`）。所以看到 `xxx-o` 时要去注册 `XxxOutline`，
// 不要去注册一个叫 `xxx-o` 的图标 —— 那种名字在图标库里并不存在。

import {
  ApiOutline,
  AppstoreOutline,
  AuditOutline,
  BarsOutline,
  CaretDownOutline,
  CaretUpOutline,
  CheckCircleOutline,
  CheckOutline,
  CloseCircleOutline,
  CloseOutline,
  CloudUploadOutline,
  ClusterOutline,
  ContainerOutline,
  DashboardOutline,
  DatabaseOutline,
  DeleteOutline,
  DoubleLeftOutline,
  DoubleRightOutline,
  DownOutline,
  EditOutline,
  EllipsisOutline,
  ExclamationCircleOutline,
  EyeOutline,
  FileProtectOutline,
  FileTextOutline,
  HomeOutline,
  IdcardOutline,
  InfoCircleOutline,
  KeyOutline,
  LaptopOutline,
  LeftOutline,
  LoadingOutline,
  MenuFoldOutline,
  MenuUnfoldOutline,
  PauseCircleOutline,
  PlayCircleOutline,
  ProfileOutline,
  QuestionCircleOutline,
  RedoOutline,
  ReloadOutline,
  RightOutline,
  SafetyCertificateOutline,
  SearchOutline,
  StarOutline,
  StopOutline,
  SyncOutline,
  TeamOutline,
  UpOutline,
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

  // ---- 生成器白名单：`ng g ng-alain:plugin icon` 永远**不会**写进 style-icons-auto 的图标 ----
  // `node_modules/ng-alain/plugin/plugin.icon.js` 里有一份 `WHITE_ICONS` 常量，
  // 它的假设是「这些图标由 ng-zorro / @delon 自己注册好了」。但 `@delon/theme` 22 的
  // `provideAlain()` 只补 Bell/Delete/Plus/Inbox/MenuFold/MenuUnfold 六个，**没有**整份白名单，
  // 于是白名单里的图标只要在本项目用到，就既不在自动生成的文件里、也没人注册，运行时报
  // `the icon xxx-o does not exist or is not registered`。以下就是踩到的这些：
  // 页头搜索框（`basic.ts` / `widgets/search.ts`）
  SearchOutline,
  // 搜索框加载态、按钮 loading 态
  LoadingOutline,
  // 仪表板卡片标题的「?」帮助图标
  QuestionCircleOutline,
  // ---- ST 表格行内按钮的 `icon: 'xxx'` 字符串（腾讯云各页，脚本扫不到）----
  // 域名/轻量服务器：管理面板、启停、重载、删除
  BarsOutline,
  PlayCircleOutline,
  PauseCircleOutline,
  ReloadOutline,
  // 证书：续期、部署、备注、吊销
  RedoOutline,
  CloudUploadOutline,
  StopOutline,
  EditOutline,
  DeleteOutline,
  // 阿里云：证书页「详情」（eye）、联系人页「设为默认」（star）
  EyeOutline,
  StarOutline,

  // ---- ng-zorro 组件**内部**渲染的图标（用户代码里没有字面量，肉眼与脚本都查不到）----
  // nz-select：下拉箭头、已选项对勾、多选标签的关闭、clear 图标（见 `NzSelectArrowComponent`）
  DownOutline,
  CheckOutline,
  CloseOutline,
  CloseCircleOutline,
  // nz-input-number 的加减按钮
  UpOutline,
  // nz-message / nz-notification 的四种状态图标
  CheckCircleOutline,
  ExclamationCircleOutline,
  InfoCircleOutline,
  // nz-table 的排序三角与展开箭头（`st` 的排序是 CSS 三角，只有原生 nz-table 才用这些）
  CaretUpOutline,
  CaretDownOutline,
  // nz-pagination 上一页 / 下一页 / 首末页
  LeftOutline,
  RightOutline,
  DoubleLeftOutline,
  DoubleRightOutline,
  // nz-tabs 溢出时的「更多」按钮
  EllipsisOutline,
  // 注：nz-table 的列筛选（`nzType="filter"` + `nzTheme="fill"`）与 nz-upload 的文件列表图标
  // （paper-clip / file / eye）本项目都没用到，等真正用上时再补，别提前塞进产物。
];
