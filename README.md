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
- 用户与权限：登录、角色与令牌管理界面
- （规划中）家庭物联网：设备管理界面

## 技术栈

- [Angular](https://angular.dev) 22 · [ng-alain](https://ng-alain.com) 22
- [ng-zorro-antd](https://ng.ant.design) · Less

## 快速开始

```bash
# 安装依赖
yarn install

# 启动开发服务器（默认 http://localhost:4200）
yarn start

# 生产构建
yarn build
```

## 目录结构

```
src/app/
├── core/     # 核心服务与拦截器
├── layout/   # 布局
├── routes/   # 各功能路由页
└── shared/   # 共享组件与模块
```

## License

[MIT](./LICENSE)
