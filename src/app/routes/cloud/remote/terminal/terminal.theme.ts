import type { ITheme } from '@xterm/xterm';

/**
 * 终端配色
 *
 * 注 1：固定用深色底 —— 这是终端该有的样子，且 ANSI 的 16 色在深底上才不易与页面背景混在一起；
 * 后台整体是浅色，一块深色终端面板反而是最常见的形态（与各类 Web 控制台一致）
 * 注 2：不跟随 `nz` 主题做两套 —— 后台目前没有暗色模式，多一套配色只会多一处没人验过的分支
 */
export const TERMINAL_THEME: ITheme = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#d4d4d4',
  cursorAccent: '#1e1e1e',
  selectionBackground: '#264f78',
  black: '#1e1e1e',
  red: '#f14c4c',
  green: '#4ec9b0',
  yellow: '#dcdcaa',
  blue: '#569cd6',
  magenta: '#c586c0',
  cyan: '#29b8db',
  white: '#d4d4d4',
  brightBlack: '#808080',
  brightRed: '#f48771',
  brightGreen: '#89d185',
  brightYellow: '#e5e510',
  brightBlue: '#6fb3e0',
  brightMagenta: '#d7a0e0',
  brightCyan: '#4ec9e0',
  brightWhite: '#ffffff',
};

/** 终端字体，注：优先等宽字体，兜底用系统等宽 */
export const TERMINAL_FONT =
  "'Cascadia Mono', 'JetBrains Mono', Consolas, 'Courier New', monospace";
