/**
 * 日志的 ANSI 转义序列解析
 *
 * 注 1：容器日志里出现 `\x1b[32m` 这类序列时，浏览器不会把它当颜色 ——
 * ESC 本身不可见，后面的 `[32m` 是普通字符，会原样显示成乱码残字。
 * 所以「剥离」与「着色」必须一起做：只着色不剥离，非 SGR 序列（清屏、清行、
 * 光标归位，进度条与构建输出里大量出现）仍会漏成可见字符
 * 注 2：本模块只产出「片段 + 样式」，不碰 DOM、不拼 HTML —— 日志内容不可信，
 * 交给模板用文本节点渲染
 */

/** ANSI 样式，注：`null` 表示终端默认样式，比全空对象更省事 */
export interface AnsiStyle {
  /** 前景色（`#rrggbb`），空串表示用默认前景 */
  fg: string;
  /** 背景色（`#rrggbb`），空串表示不设背景 */
  bg: string;
  /** 加粗 */
  bold: boolean;
  /** 暗淡 */
  dim: boolean;
  /** 斜体 */
  italic: boolean;
  /** 下划线 */
  underline: boolean;
}

/** 文本片段 */
export interface AnsiPiece {
  /** 片段文本，注：控制序列已剥离 */
  text: string;
  /** 片段样式 */
  style: AnsiStyle | null;
}

/** 单行解析结果 */
export interface AnsiResult {
  /** 片段 */
  spans: AnsiPiece[];
  /** 行尾仍生效的样式，注：颜色可以跨行继承，供下一行作为初值 */
  carry: AnsiStyle | null;
}

/** 日志级别 */
export type LogLevel = '' | 'error' | 'warn' | 'info' | 'debug';

/** 转义符 */
const ESC = '\u001b';

/** 响铃，注：OSC 序列的结束符之一 */
const BEL = '\u0007';

/**
 * 基础 16 色
 *
 * 注：不用终端里那种纯 `#000000` / `#000080` —— 日志面板固定深色底，
 * 纯黑前景等于不可见、深蓝贴近背景色；这里取 VS Code 深色终端的调色板，
 * 既接近常见 CLI 观感，又保证在 `#1e1e1e` 上可读
 */
const ANSI_COLORS: readonly string[] = [
  '#5c5c5c',
  '#cd3131',
  '#0dbc79',
  '#e5e510',
  '#2472c8',
  '#bc3fbc',
  '#11a8cd',
  '#e5e5e5',
  '#767676',
  '#f14c4c',
  '#23d18b',
  '#f5f543',
  '#3b8eea',
  '#d670d6',
  '#29b8db',
  '#ffffff',
];

/** 256 色的 6×6×6 色立方档位 */
const CUBE_LEVELS: readonly number[] = [0, 95, 135, 175, 215, 255];

/**
 * 行首级别词的前缀字符，注：只允许空白、时间戳、括号等，出现字母即停止
 *
 * 注：**不能带 `i` 标志** —— 字符类里的 `T`/`Z`（时间戳分隔符）在大写不敏感下
 * 会连带匹配小写的 `t`/`z`，`trace: ...` 这类行首词会被吃掉首字母
 */
const LEVEL_HEAD = /^[\s\d\-:.,TZ[\]()|*#>/]*([A-Za-z]+)/;

/** 行内 `level=error` / `"level":"error"` 形式 */
const LEVEL_INLINE = /\blevel"?\s*[:=]\s*"?([a-z]+)/i;

/** 级别别名，注：用 `Map` 而非对象字面量 —— 对象会把 `constructor` 之类原型属性当成命中 */
const LEVEL_ALIAS: ReadonlyMap<string, LogLevel> = new Map<string, LogLevel>([
  ['fatal', 'error'],
  ['panic', 'error'],
  ['critical', 'error'],
  ['crit', 'error'],
  ['error', 'error'],
  ['err', 'error'],
  ['emerg', 'error'],
  ['warn', 'warn'],
  ['warning', 'warn'],
  ['info', 'info'],
  ['notice', 'info'],
  ['debug', 'debug'],
  ['trace', 'debug'],
  ['verbose', 'debug'],
]);

/**
 * 新建空样式
 *
 * @returns 全默认的样式
 */
function blankStyleOf(): AnsiStyle {
  return { fg: '', bg: '', bold: false, dim: false, italic: false, underline: false };
}

/**
 * 通道值 → 两位十六进制
 *
 * @param channel 通道值，超出 0-255 或被钳制
 * @returns 两位十六进制
 */
function hexOf(channel: number): string {
  /** 归一后的通道值，注：脏数据（NaN）按 0 处理，否则会拼出 `NaN` */
  const value = Number.isFinite(channel) ? Math.min(255, Math.max(0, Math.round(channel))) : 0;
  return value.toString(16).padStart(2, '0');
}

/**
 * RGB → `#rrggbb`
 *
 * @param red 红
 * @param green 绿
 * @param blue 蓝
 * @returns 颜色文本
 */
function rgbOf(red: number, green: number, blue: number): string {
  return `#${hexOf(red)}${hexOf(green)}${hexOf(blue)}`;
}

/**
 * 256 色索引 → 颜色
 *
 * 注：0-15 用上面的调色板，16-231 是 6×6×6 色立方，232-255 是 24 级灰阶
 *
 * @param index 色号
 * @returns 颜色文本，越界时为空串
 */
function colorOf(index: number): string {
  if (!Number.isFinite(index) || index < 0) {
    return '';
  }
  if (index < 16) {
    return ANSI_COLORS[index] ?? '';
  }
  if (index < 232) {
    /** 色立方内的偏移 */
    const offset = index - 16;
    return rgbOf(
      CUBE_LEVELS[Math.floor(offset / 36)],
      CUBE_LEVELS[Math.floor(offset / 6) % 6],
      CUBE_LEVELS[offset % 6],
    );
  }
  if (index < 256) {
    /** 灰阶值 */
    const gray = 8 + (index - 232) * 10;
    return rgbOf(gray, gray, gray);
  }
  return '';
}

/**
 * 样式是否等价
 *
 * @param left 样式
 * @param right 样式
 * @returns 是否等价
 */
function sameStyleOf(left: AnsiStyle | null, right: AnsiStyle | null): boolean {
  if (left === null || right === null) {
    return left === right;
  }
  return (
    left.fg === right.fg &&
    left.bg === right.bg &&
    left.bold === right.bold &&
    left.dim === right.dim &&
    left.italic === right.italic &&
    left.underline === right.underline
  );
}

/**
 * 全默认样式归一为 `null`
 *
 * 注：`\x1b[22m` 这类「关闭某属性」的码在默认样式上执行后会产生一个全空对象，
 * 若不归一，后面判断「这行有没有样式」就会误判成程序做过格式化
 *
 * @param style 样式
 * @returns 归一后的样式
 */
function normalizeOf(style: AnsiStyle | null): AnsiStyle | null {
  if (style === null) {
    return null;
  }
  /** 是否仍是全默认 */
  const blank =
    style.fg === '' &&
    style.bg === '' &&
    !style.bold &&
    !style.dim &&
    !style.italic &&
    !style.underline;
  return blank ? null : style;
}

/**
 * 应用一组 SGR 参数
 *
 * @param style 当前样式
 * @param params SGR 参数（`\x1b[` 与 `m` 之间的数字）
 * @returns 新样式，注：不修改入参
 */
function applySgrOf(style: AnsiStyle | null, params: readonly number[]): AnsiStyle | null {
  /** 工作副本，注：写时复制 —— 整个循环里只在首次真正改动时才克隆 */
  let next = style;
  /** 参数游标 */
  let index = 0;

  /**
   * 取得可写样式
   *
   * @returns 可写样式
   */
  const edit = (): AnsiStyle => {
    if (next === null) {
      next = blankStyleOf();
    } else if (next === style) {
      next = { ...next };
    }
    return next;
  };

  while (index < params.length) {
    /** 当前参数 */
    const code = params[index];
    index += 1;
    if (code === 0) {
      next = null;
      continue;
    }
    if (code === 1) {
      edit().bold = true;
      continue;
    }
    if (code === 2) {
      edit().dim = true;
      continue;
    }
    if (code === 3) {
      edit().italic = true;
      continue;
    }
    if (code === 4) {
      edit().underline = true;
      continue;
    }
    if (code === 22) {
      /** 关闭加粗与暗淡 */
      const target = edit();
      target.bold = false;
      target.dim = false;
      continue;
    }
    if (code === 23) {
      edit().italic = false;
      continue;
    }
    if (code === 24) {
      edit().underline = false;
      continue;
    }
    if (code >= 30 && code <= 37) {
      edit().fg = ANSI_COLORS[code - 30] ?? '';
      continue;
    }
    if (code === 39) {
      edit().fg = '';
      continue;
    }
    if (code >= 40 && code <= 47) {
      edit().bg = ANSI_COLORS[code - 40] ?? '';
      continue;
    }
    if (code === 49) {
      edit().bg = '';
      continue;
    }
    if (code >= 90 && code <= 97) {
      edit().fg = ANSI_COLORS[code - 90 + 8] ?? '';
      continue;
    }
    if (code >= 100 && code <= 107) {
      edit().bg = ANSI_COLORS[code - 100 + 8] ?? '';
      continue;
    }
    if (code === 38 || code === 48) {
      /** 扩展色模式：5=256 色，2=真彩 */
      const mode = params[index];
      /** 解析出的颜色 */
      let color = '';
      if (mode === 5) {
        color = colorOf(params[index + 1]);
        index += 2;
      } else if (mode === 2) {
        color = rgbOf(params[index + 1], params[index + 2], params[index + 3]);
        index += 4;
      } else {
        // 注：未知模式只跳过模式位，后面的参数按普通码继续解释，避免整行丢色
        index += 1;
      }
      /** 目标属性 */
      const target = edit();
      if (code === 38) {
        target.fg = color;
      } else {
        target.bg = color;
      }
      continue;
    }
    // 其余（闪烁 5、隐藏 8、删除线 9、双下划线 21 等）对日志无意义，忽略
  }
  return normalizeOf(next);
}

/**
 * 解析一行里的 ANSI 序列
 *
 * 注 1：行内 `\r`（进度条重绘）按终端语义的**近似**处理 —— 丢弃回车之前的内容，
 * 只保留最后一次覆盖后的文本。严格执行覆盖需要逐字符建格，收益不足以抵消复杂度，
 * 且常见的递增式进度条在两种做法下结果一致
 * 注 2：非 SGR 的 CSI（`\x1b[2J` 清屏、`\x1b[K` 清行、`\x1b[H` 归位）、OSC（设标题）
 * 与字符集选择序列一律丢弃 —— 它们在 DOM 里没有对应语义，留着就是乱码
 *
 * @param text 原始文本
 * @param carry 上一行遗留的样式
 * @returns 片段与行尾样式
 */
export function ansiSpansOf(text: string, carry: AnsiStyle | null = null): AnsiResult {
  /** 输出片段 */
  const spans: AnsiPiece[] = [];
  /** 当前样式 */
  let style = carry;
  /** 待输出的文本 */
  let buffer = '';
  /** 扫描位置 */
  let index = 0;

  /**
   * 收尾当前文本段
   */
  const flush = (): void => {
    if (buffer === '') {
      return;
    }
    /** 上一段 */
    const last = spans[spans.length - 1];
    // 注：样式相同的相邻段合并，减少 DOM 节点（一行里几十个 `\x1b[32m` 很常见）
    if (last !== undefined && sameStyleOf(last.style, style)) {
      last.text += buffer;
    } else {
      spans.push({ text: buffer, style });
    }
    buffer = '';
  };

  // 注：无控制符的普通行占绝大多数，直接短路，省掉整个扫描
  if (!text.includes(ESC) && !text.includes('\r')) {
    return { spans: text === '' ? [] : [{ text, style }], carry: style };
  }

  while (index < text.length) {
    /** 当前字符 */
    const char = text[index];
    if (char === '\r') {
      spans.length = 0;
      buffer = '';
      index += 1;
      continue;
    }
    if (char !== ESC) {
      buffer += char;
      index += 1;
      continue;
    }
    /** 序列引导字符 */
    const lead = text[index + 1];
    if (lead === '[') {
      /** 游标 */
      let cursor = index + 2;
      /** 参数字节（0x30-0x3F） */
      let params = '';
      while (cursor < text.length) {
        /** 字节码 */
        const code = text.charCodeAt(cursor);
        if (code < 0x30 || code > 0x3f) {
          break;
        }
        params += text[cursor];
        cursor += 1;
      }
      // 中间字节（0x20-0x2F），日志里基本没有，跳过即可
      while (cursor < text.length) {
        /** 字节码 */
        const code = text.charCodeAt(cursor);
        if (code < 0x20 || code > 0x2f) {
          break;
        }
        cursor += 1;
      }
      if (cursor >= text.length) {
        // 注：序列被截断（后端单行 16 KB 上限会造成这种尾部），丢弃残缺部分并结束扫描
        break;
      }
      /** 终止字节 */
      const final = text[cursor];
      index = cursor + 1;
      if (final !== 'm') {
        continue;
      }
      flush();
      /** SGR 参数，注：空参等同于 0（重置） */
      const codes =
        params === '' ? [0] : params.split(/[;:]/).map((item) => (item === '' ? 0 : Number(item)));
      style = applySgrOf(
        style,
        codes.filter((item) => Number.isFinite(item)),
      );
      continue;
    }
    if (lead === ']') {
      /** OSC：直到 BEL 或 ST 结束 */
      let cursor = index + 2;
      while (cursor < text.length) {
        if (text[cursor] === BEL) {
          cursor += 1;
          break;
        }
        if (text[cursor] === ESC && text[cursor + 1] === '\\') {
          cursor += 2;
          break;
        }
        cursor += 1;
      }
      index = cursor;
      continue;
    }
    if (lead === '(' || lead === ')' || lead === '#') {
      // 字符集选择 / 行属性：两个字符的定长序列
      index += 3;
      continue;
    }
    // 其余单字符 ESC 序列（`\x1b=` 键盘模式、`\x1b>` 等）
    index += 2;
  }
  flush();
  return { spans, carry: style };
}

/**
 * 剥离全部 ANSI 序列
 *
 * 注：复制、下载与悬停提示都用这个 —— 带 ESC 的文本粘到聊天窗口或文档里是乱码
 *
 * @param text 原始文本
 * @returns 纯文本
 */
export function stripAnsi(text: string): string {
  if (!text.includes(ESC) && !text.includes('\r')) {
    return text;
  }
  return ansiSpansOf(text)
    .spans.map((piece) => piece.text)
    .join('');
}

/**
 * 行首级别词
 *
 * @param text 纯文本
 * @returns 级别，识别不出时为空串
 */
export function levelOf(text: string): LogLevel {
  if (text === '') {
    return '';
  }
  /** 行首锚定的级别词，注：日志级别几乎总在行首（时间戳之后），比全文搜索准确得多 */
  const head = LEVEL_HEAD.exec(text);
  if (head !== null) {
    /** 归一结果 */
    const hit = LEVEL_ALIAS.get(head[1].toLowerCase());
    if (hit !== undefined) {
      return hit;
    }
  }
  /** 结构化日志的 `level=error` 写法 */
  const inline = LEVEL_INLINE.exec(text);
  if (inline !== null) {
    /** 归一结果 */
    const hit = LEVEL_ALIAS.get(inline[1].toLowerCase());
    if (hit !== undefined) {
      return hit;
    }
  }
  return '';
}

/**
 * 样式 → 内联样式对象
 *
 * 注：关键字命中时**不套用原文颜色与背景** —— 高亮块需要统一的前景/背景对比，
 * 否则一段绿字叠在黄底上基本看不清
 *
 * @param style 样式
 * @param hit 是否命中关键字
 * @returns 内联样式，全默认时为 `null`
 */
export function cssOf(style: AnsiStyle | null, hit: boolean): Record<string, string> | null {
  if (style === null) {
    return null;
  }
  /** 内联样式 */
  const css: Record<string, string> = {};
  if (!hit) {
    if (style.fg !== '') {
      css['color'] = style.fg;
    }
    if (style.bg !== '') {
      css['background-color'] = style.bg;
    }
  }
  if (style.bold) {
    css['font-weight'] = '600';
  }
  if (style.italic) {
    css['font-style'] = 'italic';
  }
  if (style.underline) {
    css['text-decoration'] = 'underline';
  }
  if (style.dim) {
    css['opacity'] = '0.7';
  }
  return Object.keys(css).length === 0 ? null : css;
}
