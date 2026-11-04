#!/usr/bin/env node
// 图标注册检查：扫描 src 里所有「引用了图标名」的地方，确认它已在
// src/style-icons.ts（手工登记）或 src/style-icons-auto.ts（生成器产出）里注册。
//
// 为什么需要这个脚本：
// 1. `ng g ng-alain:plugin icon` 只扫模板里的 `<nz-icon nzType="...">`，
//    **TS 字符串**形式的引用（ST 的 `icon: 'cloud-upload'`、菜单的 `icon.value`）扫不到；
// 2. 生成器还有一份内部白名单（见 node_modules/ng-alain/plugin/plugin.icon.js 的 WHITE_ICONS），
//    白名单里的图标即使被模板引用也不会写进 style-icons-auto.ts；
// 3. @delon/theme 22 的 provideAlain() 只补 6 个图标，并不包含那份白名单。
// 三者叠加的结果就是运行时报 `the icon xxx-o does not exist or is not registered`（`-o` 是
// @ant-design/icons-angular 给 Outline 主题自动补的后缀）。
//
// 单元测试跑在浏览器里（@angular/build:unit-test + Playwright），拿不到文件系统，
// 所以这条校验只能放在 Node 脚本里，由 pre-commit 与 CI 调用。

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 项目根目录（本脚本在 scripts/ 下） */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** 源码根目录 */
const SRC = join(ROOT, 'src');

/**
 * `nzType` 里出现的**非图标**取值
 *
 * ng-zorro 的 `nzType` 是通用属性名：`nz-button` 用它表示按钮类型、`nz-alert` 表示状态色、
 * `nz-progress` 表示形态、`nz-form` 表示布局。不剔除这些会有一堆假阳性。
 */
const NON_ICON_NZ_TYPE = new Set([
  'primary',
  'default',
  'dashed',
  'link',
  'text',
  'success',
  'info',
  'warning',
  'error',
  'line',
  'circle',
  'card',
  'inline',
  'flex',
  'vertical',
  'horizontal',
  'grid',
  'bordered',
]);

/**
 * 递归列出待扫描的源码文件
 *
 * @param {string} dir 起始目录
 * @returns {string[]} 文件绝对路径
 */
function sourceFilesOf(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return sourceFilesOf(path);
    }
    // 测试文件与图标登记表自身不算「引用方」（登记表里全是图标名，扫了等于自己校验自己）
    if (/\.spec\.ts$/.test(entry) || /^style-icons(-auto)?\.ts$/.test(entry)) {
      return [];
    }
    return /\.(ts|html)$/.test(entry) ? [path] : [];
  });
}

/**
 * 从登记表里取出已注册的图标名
 *
 * 只做文本解析：登记表里 `import { XxxOutline } from '@ant-design/icons-angular/icons'` 的
 * 标识符去掉主题后缀转 kebab 即运行时名字（`CloudUploadOutline` → `cloud-upload`）。
 *
 * @param {string} content 文件内容
 * @returns {string[]} 图标名（不含主题后缀）
 */
function registeredIconsOf(content) {
  const block = content.match(/import\s*\{([\s\S]*?)\}\s*from\s*'@ant-design\/icons-angular\/icons'/);
  if (!block) {
    return [];
  }
  return block[1]
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) =>
      id
        .replace(/(Outline|Fill|TwoTone)$/, '')
        // 驼峰转 kebab：ApiOutline → api、CloudUploadOutline → cloud-upload
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .toLowerCase(),
    );
}

/**
 * 收集一份源码里被引用的图标名
 *
 * @param {string} content 文件内容
 * @returns {Map<string, number>} 图标名 → 首次出现的行号（1 起）
 */
function iconRefsOf(content) {
  /** 图标名 → 行号 */
  const refs = new Map();
  content.split(/\r?\n/).forEach((line, index) => {
    const lineNo = index + 1;
    /** 注释行里出现图标名只是说明文字，不算引用 */
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      return;
    }
    const add = (name) => {
      if (!refs.has(name)) {
        refs.set(name, lineNo);
      }
    };

    // <nz-icon nzType="search" />
    for (const match of line.matchAll(/nzType\s*=\s*"([^"{}]+)"/g)) {
      const name = match[1].trim();
      if (!NON_ICON_NZ_TYPE.has(name)) {
        add(name);
      }
    }
    // 三元绑定：[nzType]="focus() ? 'arrow-down' : 'search'"
    for (const match of line.matchAll(/\[nzType\]\s*=\s*"([^"]*)"/g)) {
      for (const literal of match[1].matchAll(/'([a-z0-9-]+)'/g)) {
        if (!NON_ICON_NZ_TYPE.has(literal[1])) {
          add(literal[1]);
        }
      }
    }
    // ST 按钮：icon: 'cloud-upload'（菜单的 `icon: { type: 'icon', value: 'home' }` 不会匹配）
    for (const match of line.matchAll(/\bicon\s*:\s*'([a-z0-9-]+)'/g)) {
      add(match[1]);
    }
  });
  return refs;
}

/** 已注册的图标名 */
const registered = new Set(
  ['style-icons.ts', 'style-icons-auto.ts'].flatMap((file) =>
    registeredIconsOf(readFileSync(join(SRC, file), 'utf8')),
  ),
);

/** 漏注册的引用，形如 `src/app/.../ssl.component.ts:130 cloud-upload` */
const missing = [];
/** 引用到的图标个数（去重后） */
const referenced = new Set();
/** 被扫描的文件数 */
const files = sourceFilesOf(SRC);

for (const file of files) {
  for (const [name, line] of iconRefsOf(readFileSync(file, 'utf8'))) {
    referenced.add(name);
    if (!registered.has(name)) {
      missing.push(`${relative(ROOT, file).split('\\').join('/')}:${line} ${name}`);
    }
  }
}

if (missing.length > 0) {
  console.error('✗ 以下图标被引用但没有注册（运行时抛 "the icon xxx-o does not exist"）：');
  for (const item of missing) {
    console.error(`  ${item}`);
  }
  console.error('\n修法：模板 / 行内模板里的加到 src/style-icons-auto.ts（或跑 yarn icon 重新生成）；');
  console.error('      TS 字符串、生成器白名单、组件内部的加到 src/style-icons.ts。');
  process.exit(1);
}

console.log(`✓ 图标注册完整：扫描 ${files.length} 个文件，引用 ${referenced.size} 个图标，全部已注册`);
