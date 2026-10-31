# atelierkit · web

家用局域网服务器上的个人工具集合 —— Web 前端。

基于 [ng-alain](https://ng-alain.com) 构建，是 `atelierkit` 各工具的统一管理界面。

## 项目简介

`atelierkit` 是一套部署在家庭局域网服务器上的自托管工具集合，所有数据仅在内网流转。
`web` 是其中的前端入口，提供各工具的可视化操作界面。

## 功能

- 私有文件与数据管理：文件浏览、上传下载、分享链接生成
- 服务器运维：仪表盘、进程与服务管理
- 下载中心：下载任务列表、进度展示、暂停 / 限速操作
- 用户与权限：登录、角色与令牌管理界面（`/auth/user`、`/auth/role`、`/auth/token`，入口仅管理员可见）
- 云服务：云厂商访问密钥管理（`/cloud/key`）与 KONG 网关站点管理 / 诊断（`/cloud/kong`），入口仅管理员可见
- （规划中）家庭物联网：设备管理界面

## 技术栈

- [Angular](https://angular.dev) 22 · [ng-alain](https://ng-alain.com) 22
- [ng-zorro-antd](https://ng.ant.design) · Less
- 界面语言：**仅简体中文**（不做国际化，未引入 i18n 词典、`I18nPipe` 与语言切换；
  `app.config.ts` 里的 `defaultLang` 只提供 zh_CN 的地区数据供日期/数字管道使用）

## 部署

### 1. 构建

```bash
yarn install
yarn build          # 产物：dist/web/browser
```

> 开发态用 `yarn start`（默认 http://localhost:4200）。开发前请先启动后端 `atelierkit/api`（默认 3000 端口），
> 否则初始化状态与登录接口都会连接失败。

### 2. 静态托管

把 `dist/web/browser` 整个目录拷到 Web 服务器即可（纯静态，无 Node 运行时依赖）。nginx 参考：

```nginx
server {
  listen 80;
  root /var/www/atelierkit/web;   # 即 dist/web/browser 的内容
  index index.html;

  # SPA 兜底：前端用 hash 路由，刷新任何地址都要回 index.html
  location / {
    try_files $uri $uri/ /index.html;
  }

  # 带哈希的构建产物可长缓存
  location ~* \.(?:js|css|woff2?|svg|png|jpg)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
  }

  # 运行时配置不要缓存，改完立即生效
  location = /assets/config.json {
    add_header Cache-Control "no-store";
  }
}
```

### 3. 配置后端地址（运行时，无需重新构建）

后端地址不编进产物，而是启动时读 `assets/config.json`：

```jsonc
// src/assets/config.json → 构建后位于 dist/web/browser/assets/config.json
{
  "baseUrl": "//localhost:3000/",
  "name": "个人工具平台",
  "description": "家用局域网服务器上的个人工具集合"
}
```

- `baseUrl` 由 `StartupService` 启动时读入并写入 `SettingsService`，`defaultInterceptor` 给所有相对路径请求补前缀；
  `assets/*`、`//host/`、`http(s)://` 开头的地址不加前缀。**部署后直接改这个文件即可切换后端。**
- **跨机直连**：填 `//192.168.1.3:3000/` 这种地址，浏览器直连后端（服务端已 `enableCors`）。
- **同机反代**：填 `/api/`，由 nginx 转给后端（末尾的 `/` 负责去掉前缀）：

  ```nginx
  location /api/ {
    proxy_pass http://127.0.0.1:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
  ```

  ⚠️ 走反代时后端看到的来源恒为 nginx（`127.0.0.1`），「内网 IP」闸门等于放行所有人 ——
  **这种情况下必须在后端 `.env` 里配置 `SETUP_TOKEN`**，否则初始化接口是敞开的。

- 开发态 `proxy.conf.js` 默认留空（就是跨域直连），需要走代理时再放开示例。

### 4. Docker 镜像

`Dockerfile` 只负责**托管静态文件**，构建在前一步完成（镜像里不装 Node）：

```bash
yarn build                      # 先产出 dist/web/browser
docker build -t atelierkit/web .
docker run -d --name atelierkit-web -p 8080:80 atelierkit/web
```

- 镜像内置 `nginx.conf`：SPA 兜底、gzip、`index.html` 与 `assets/config.json` 不缓存、带哈希的静态资源长缓存。
- **改后端地址不需要重建镜像**，把配置文件挂进容器即可：

  ```bash
  docker run -d --name atelierkit-web -p 8080:80 \
    -v "$PWD/config.json:/usr/share/nginx/html/assets/config.json:ro" \
    atelierkit/web
  ```

- CI（`.github/workflows/docker.yml`）：装依赖 → `yarn lint:ts` → `yarn build` → 构建镜像并推送到 `ghcr.io/atelierkit/web`
  （PR 只验证构建，推 `main` / `v*` 标签才推送）。

## 首次使用：创建管理员

刚部署好、后端还没建号时，**打不开登录页，会直接停在「创建管理员账号」页**：

1. 前端启动先 `GET /passport/init`；未初始化时除该页之外的所有路由都被重定向回这里，登录入口也不显示。
2. 填用户名 / 密码 / 确认密码（邮箱可选），如后端配了 `SETUP_TOKEN`，还要在「初始化凭据」里填同一个值。
3. 提交 `POST /passport/setup`，**成功即返回令牌并自动登录进首页**，不需要再输一次密码。
4. 初始化完成后该页永久关闭，再访问会被送回登录页。

日常登录只有**用户名 + 密码**（已移除邮箱验证码、手机验证码与自助注册入口；账号由管理员创建）。
令牌以 `token: <用户ID>:<随机码>` 请求头传递，失效时自动跳回登录页。

## 访问控制（管理员）

侧边栏「访问控制」分组只在当前账号带 `admin` 角色时出现（菜单项带 `acl: 'admin'`）。
**隐藏入口不等于鉴权**：后端 `@Allow('admin')` 会独立校验，非管理员直接打接口仍然是 403。

| 页面 | 路由 | 后端接口 |
| --- | --- | --- |
| 用户管理 | `/auth/user` | `GET auth/user/index`、`GET auth/user/show/:id`、`POST auth/user/create`、`POST auth/user/update/:id` |
| 角色管理 | `/auth/role` | `GET auth/role/index`、`GET auth/role/show/:id`、`POST auth/role/create`、`POST auth/role/update/:id`、`POST auth/role/sort` |
| 令牌管理 | `/auth/token` | `GET auth/token/index`、`DELETE auth/token/:id:code` |

- **建号必须带用户名与初始密码**：用户名 3-20 位字母 / 数字 / 下划线 / 短横线（提交前转小写，编辑态不可改）；
  密码 8-64 位且同时含字母和数字（与后端同一套策略）。账号建好后由用户自行改密。
- **管理端不改密码**：改密走用户自己的 `/user/password`，忘记密码走邮箱重置 —— 所以编辑弹窗里没有密码框。
- 邮箱是可选资料，留空即清空（后端把空串转 `NULL`，否则第二个不填邮箱的账号会撞唯一索引）。
- 角色列表支持**行拖拽排序**，`保存排序` 按当前行顺序重排 `sort`（从 1 递增），不用手填数字。
- 令牌存在后端 Redis 里，字段值都是字符串；`作废` 会让对应会话立即掉线，`过期时间` 为 0 表示长期有效。

## 常见状态码

| 状态码 | 含义 | 处理 |
| --- | --- | --- |
| `428` | 系统尚未初始化 | 正常会自动跳创建页；若没跳，检查 `config.json` 的 `baseUrl` 是否指向正确后端 |
| `403` | 初始化凭据无效或来源不被允许 | 核对后端 `SETUP_TOKEN` 与表单里的「初始化凭据」是否一致 |
| `409` | 已完成初始化 / 用户名已被占用 | 前者直接去登录；后者换用户名 |
| `401` | 用户名或密码不正确 | 页面内联提示，不会跳转 |
| `410` | 自助注册已关闭 | 账号需由管理员创建 |
| 网络错误（`status 0`） | 后端未启动 / `baseUrl` 写错 / 跨域被拦 | 先在浏览器直接访问 `baseUrl + passport/init` 验证 |

> 顶栏的「清理本地缓存」会清掉本地令牌与本地设置，登录状态异常时可先用它再刷新。

## 测试与提交门禁

```bash
# 单元测试（浏览器模式，Chromium 由 Playwright 驱动）
yarn test

# 覆盖率
yarn test-coverage
```

仓库用 [husky](https://typicode.github.io/husky/) 挂了 `pre-commit` 钩子，**测试不通过就提交不了**，顺序为：

1. `tsc -p tsconfig.app.json --noEmit`（类型检查）
2. `lint-staged`（对暂存文件跑 eslint / stylelint）
3. `ng test --watch=false`（单元测试）

- 钩子由 `yarn install` 自动装好（`prepare: husky`，定义在 `.husky/pre-commit`），新克隆的仓库无需额外操作。
- 单元测试跑在真实 Chromium 里：新机器若报找不到浏览器，先执行一次 `npx playwright install chromium`。
- 应急绕过用 `git commit --no-verify`。

### 覆盖率

`yarn test-coverage`（= `ng test -c coverage --coverage --watch=false`）会跑覆盖率并校验 `vitest.config.ts` 里的
`coverage.thresholds`（当前 92/90/78/88：行/语句/分支/函数），不达标直接失败（CI 跑的就是这条）。

当前承诺的是 **core 层**：`passport.service`、`refresh-token`、`helper`、`setup.guard`、`start-page.guard` 为 100%，
`startup.service` 约 95%、`default.interceptor` 约 82%，整体约 **95% 行 / 98% 函数 / 85% 分支**。
访问控制部分的 `auth.service`（含接口路径 / 方法 / 提交体）与 `utils/token` 为 100%。
页面组件尚未补 TestBed 用例，`@angular/build:unit-test` 只统计被用例加载过的文件，所以它们在报告里不出现
（注：在该配置里写 `coverage.include` 会与 builder 冲突、覆盖率被算成 0%，不要加）。

## 目录结构

```
src/app/
├── core/     # 核心服务与拦截器
├── layout/   # 布局
├── routes/   # 各功能路由页（auth = 用户 / 角色 / 令牌管理）
└── shared/   # 共享组件与模块、工具函数（utils/token 为令牌档位）
```

## License

[MIT](./LICENSE)
