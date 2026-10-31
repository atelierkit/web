import { Menu } from '@delon/theme';

/**
 * 侧边菜单配置
 *
 * 注：菜单尚未接入后端，先沿用静态配置（https://ng-alain.com/theme/menu）。
 * 每个 `icon.value` 都是 ng-zorro 的图标名，**必须**在 `src/style-icons.ts`（菜单/Ts 里的字符串）
 * 或 `style-icons-auto.ts`（模板里出现、由脚本自动生成）中注册过，否则侧边栏该处渲染成空白；
 * 这条对应关系由 `menu.constant.spec.ts` 自动校验，新增菜单项时不用靠肉眼记。
 */
export const MENUS: Menu[] = [
  {
    text: '首页',
    link: '/home',
    icon: { type: 'icon', value: 'home' },
  },
  {
    text: '账号',
    group: true,
    children: [
      {
        text: '个人资料',
        link: '/user/basic',
        icon: { type: 'icon', value: 'idcard' },
        // 注：账号管理只改自己的资料，不需要任何角色（后端 `user/*` 也只认令牌里的用户ID）
      },
    ],
  },
  {
    text: '访问控制',
    group: true,
    children: [
      {
        text: '用户管理',
        link: '/auth/user',
        icon: { type: 'icon', value: 'user' },
        // 注：后端按 @Allow('admin') 校验，前端只隐藏入口，越权请求仍会被拦
        acl: 'admin',
      },
      {
        text: '角色管理',
        link: '/auth/role',
        icon: { type: 'icon', value: 'team' },
        acl: 'admin',
      },
      {
        text: '令牌管理',
        link: '/auth/token',
        icon: { type: 'icon', value: 'key' },
        acl: 'admin',
      },
    ],
  },
  {
    text: '云服务',
    group: true,
    children: [
      {
        text: '密钥管理',
        link: '/cloud/key',
        icon: { type: 'icon', value: 'safety-certificate' },
        acl: 'admin',
      },
      {
        text: 'KONG 网关',
        link: '/cloud/kong',
        icon: { type: 'icon', value: 'api' },
        acl: 'admin',
      },
    ],
  },
  {
    text: '管理员',
    group: true,
    children: [
      {
        text: '配置管理',
        link: '/admin/list',
        icon: { type: 'icon', value: 'setting' },
        acl: 'admin',
      },
      {
        text: '操作日志',
        link: '/admin/operate',
        icon: { type: 'icon', value: 'audit' },
        acl: 'admin',
      },
      {
        text: '请求日志',
        link: '/admin/req',
        icon: { type: 'icon', value: 'file-text' },
        acl: 'admin',
      },
    ],
  },
  {
    text: '行情数据',
    group: true,
    children: [
      {
        text: '仪表板',
        link: '/data/dashboard',
        icon: { type: 'icon', value: 'dashboard' },
        // 注：仪表板与浏览页登录即可看，不加 acl —— 写操作由后端 @Allow('admin') 拦
      },
      {
        text: '数据同步',
        link: '/data/sync',
        icon: { type: 'icon', value: 'sync' },
      },
      {
        text: '数据浏览',
        link: '/data/browser',
        icon: { type: 'icon', value: 'database' },
      },
    ],
  },
];
