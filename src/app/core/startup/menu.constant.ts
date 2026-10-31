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
    text: 'Main',
    group: true,
    children: [
      {
        text: 'Dashboard',
        link: '/dashboard',
        icon: { type: 'icon', value: 'appstore' },
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
];
