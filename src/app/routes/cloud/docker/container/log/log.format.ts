import { type AnsiStyle, type LogLevel, ansiSpansOf, cssOf, levelOf, stripAnsi } from './log.ansi';
import type { DockerLogLine } from '../../object/object.types';

/**
 * 前端缓冲上限（行）
 *
 * 注：与后端网关的环形缓冲同口径 —— 两侧不一致会让界面上的行数比服务端「多」或「少」，
 * 排查时非常容易误判
 */
export const LOG_BUFFER_MAX = 5000;

/**
 * 单次渲染上限（行）
 *
 * 注：DOM 行数与日志量无关，只渲染尾部这一段；更早的内容仍留在缓冲里（可搜索、可下载），
 * 上翻时通过「加载更早」扩窗。不引虚拟滚动是为了避免多一个未验证的模块依赖
 */
export const LOG_RENDER_MAX = 800;

/** 日志过滤条件 */
export interface DockerLogFilter {
  /** 关键字，注：大小写不敏感，同时匹配正文与时间戳 */
  keyword?: string;
  /** 是否显示 stdout，缺省 true */
  stdout?: boolean;
  /** 是否显示 stderr，缺省 true */
  stderr?: boolean;
}

/** 高亮分片 */
export interface LogTextChunk {
  /** 片段文本 */
  text: string;
  /** 是否命中关键字（命中片段用 `<mark>` 渲染） */
  hit: boolean;
}

/**
 * 时间戳 → 本地时钟文本
 *
 * 注 1：只显示 `HH:mm:ss.SSS`，日期部分由抽屉头部展示 —— 日志绝大多数是同一天的，
 * 每行都带完整日期会挤掉正文
 * 注 2：daemon 给的是纳秒精度（9 位小数），`Date` 只认到毫秒，先截断再解析；
 * 解析不了的（脏数据）原样返回，不显示成 `Invalid Date`
 *
 * @param ts RFC3339 时间戳，空串表示该行没有时间戳
 * @returns 本地时钟文本
 */
export function clockOf(ts: string): string {
  if (ts === '') {
    return '';
  }
  /** 归一到毫秒精度 */
  const normalized = ts.replace(/(\.\d{3})\d+/, '$1');
  /** 毫秒时间戳 */
  const time = Date.parse(normalized);
  if (Number.isNaN(time)) {
    return ts;
  }
  /** 时间对象 */
  const date = new Date(time);
  /**
   * 补零
   *
   * @param value 数字
   * @param size 位数
   * @returns 定长文本
   */
  const pad = (value: number, size = 2): string => String(value).padStart(size, '0');
  return [
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
    pad(date.getMilliseconds(), 3),
  ].join('.');
}

/**
 * 行 → 单行文本
 *
 * 注：返回的是**剥离 ANSI 后**的纯文本 —— 悬停提示、复制、下载都走这里，
 * 带 `\x1b[32m` 的原文粘到别处只会是乱码
 *
 * @param line 日志行
 * @param withTimestamp 是否带上原始时间戳
 * @returns 文本
 */
export function lineTextOf(line: DockerLogLine, withTimestamp = true): string {
  /** 正文 */
  const text = stripAnsi(line.text);
  return withTimestamp && line.ts !== '' ? `${line.ts} ${text}` : text;
}

/**
 * 按流与关键字过滤
 *
 * @param lines 日志行
 * @param filter 过滤条件
 * @returns 过滤后的行
 */
export function filterOf(
  lines: readonly DockerLogLine[],
  filter: DockerLogFilter = {},
): DockerLogLine[] {
  /** 归一后的关键字 */
  const needle = (filter.keyword ?? '').trim().toLowerCase();
  /** 是否显示 stdout */
  const showOut = filter.stdout !== false;
  /** 是否显示 stderr */
  const showErr = filter.stderr !== false;
  if (needle === '' && showOut && showErr) {
    return [...lines];
  }
  return lines.filter((line) => {
    if (line.stream === 'stderr' ? !showErr : !showOut) {
      return false;
    }
    if (needle === '') {
      return true;
    }
    return line.text.toLowerCase().includes(needle) || line.ts.toLowerCase().includes(needle);
  });
}

/**
 * 关键字分片（用于安全高亮）
 *
 * 注：**不能用 `innerHTML` 拼日志** —— 日志内容不可信（容器里的程序可以打印任意字符串），
 * 拼接等于把 XSS 交给被监控的进程。这里切成「命中 / 未命中」片段，模板用 `<mark>` 包住命中段
 *
 * @param text 正文
 * @param keyword 关键字
 * @returns 分片，注：无命中时返回单段原文本
 */
export function chunksOf(text: string, keyword: string): LogTextChunk[] {
  /** 归一后的关键字 */
  const needle = keyword.trim().toLowerCase();
  if (needle === '') {
    return [{ text, hit: false }];
  }
  /** 用于查找的副本，注：`toLowerCase` 对少数语言会改变长度，日志以中英文为主，可接受 */
  const haystack = text.toLowerCase();
  /** 分片 */
  const chunks: LogTextChunk[] = [];
  /** 当前扫描位置 */
  let start = 0;
  for (;;) {
    /** 命中位置 */
    const index = haystack.indexOf(needle, start);
    if (index === -1) {
      break;
    }
    if (index > start) {
      chunks.push({ text: text.slice(start, index), hit: false });
    }
    chunks.push({ text: text.slice(index, index + needle.length), hit: true });
    start = index + needle.length;
  }
  if (start < text.length) {
    chunks.push({ text: text.slice(start), hit: false });
  }
  return chunks.length === 0 ? [{ text, hit: false }] : chunks;
}

/**
 * 渲染分片
 *
 * 注：一个分片 = 一段样式一致的文本，模板用 `<span [ngStyle]>` 渲染；
 * 关键字高亮是**同一层**的标记，不再单独包 `<mark>`，否则样式与高亮会互相覆盖
 */
export interface LogSpan {
  /** 片段文本 */
  text: string;
  /** 是否命中关键字 */
  hit: boolean;
  /** 内联样式，`null` 表示用面板默认色 */
  css: Record<string, string> | null;
  /** 原文样式，注：仅用于测试与判断，模板不直接读 */
  style: AnsiStyle | null;
}

/** 待渲染的一行 */
export interface DockerLogRow {
  /** 原始行 */
  line: DockerLogLine;
  /** 分片 */
  spans: LogSpan[];
  /** 语义级别，注：仅当本行没有 ANSI 样式时给出，避免覆盖程序自己的配色 */
  level: LogLevel;
}

/**
 * 行 → 渲染分片
 *
 * 注 1：ANSI 的样式可以跨行继承（某行以 `\x1b[31m` 开头却没在行尾重置时，
 * 后续行都该是红的 —— 多行堆栈就是这么来的），所以这里按顺序逐行传递样式
 * 注 2：级别只在「本行没有任何 ANSI 样式」时兜底 —— 程序自己上过色说明它有自己的
 * 语义，再用关键字覆盖只会打架
 *
 * @param lines 日志行
 * @param keyword 关键字
 * @returns 渲染行
 */
export function renderRowsOf(lines: readonly DockerLogLine[], keyword: string): DockerLogRow[] {
  /** 上一行遗留的样式 */
  let carry: AnsiStyle | null = null;
  return lines.map((line) => {
    /** 解析结果 */
    const parsed = ansiSpansOf(line.text, carry);
    carry = parsed.carry;
    /** 是否做过格式化 */
    const styled = parsed.spans.some((piece) => piece.style !== null);
    /** 分片 */
    const spans: LogSpan[] = [];
    /** 纯文本，注：用于级别判定 */
    let plain = '';
    for (const piece of parsed.spans) {
      plain += piece.text;
      for (const chunk of chunksOf(piece.text, keyword)) {
        spans.push({
          text: chunk.text,
          hit: chunk.hit,
          css: cssOf(piece.style, chunk.hit),
          style: piece.style,
        });
      }
    }
    return { line, spans, level: styled ? '' : levelOf(plain) };
  });
}

/**
 * 拼接下载文本
 *
 * @param lines 日志行
 * @returns 带原始时间戳的全文，注：末尾补换行，便于直接接 shell 工具
 */
export function downloadTextOf(lines: readonly DockerLogLine[]): string {
  if (lines.length === 0) {
    return '';
  }
  return `${lines.map((line) => lineTextOf(line, true)).join('\n')}\n`;
}

/**
 * 取最后一行的非空时间戳
 *
 * @param lines 日志行
 * @returns 最后一行的时间戳，没有时为空间串
 */
export function lastTsOf(lines: readonly DockerLogLine[]): string {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    /** 当前行 */
    const line = lines[index];
    if (line.ts !== '') {
      return line.ts;
    }
  }
  return '';
}

/**
 * 裁剪到缓冲上限（丢最旧的）
 *
 * @param lines 日志行
 * @param max 上限
 * @returns 裁剪后的行
 */
export function trimOf(
  lines: readonly DockerLogLine[],
  max: number = LOG_BUFFER_MAX,
): DockerLogLine[] {
  return lines.length <= max ? [...lines] : lines.slice(lines.length - max);
}

/**
 * 合并增量
 *
 * 注：`since` 在 daemon 侧是**闭区间**，重连时边界那一行会重复一次，故按时间戳做二次去重。
 * 字符串比较对同一 daemon 的同一格式成立（小数位数一致）；位数不同时（极少）可能漏一行，
 * 这个代价远小于「整段重复」
 *
 * @param current 当前缓冲
 * @param incoming 新增行
 * @param lastTs 当前缓冲最后一行的时戳
 * @returns 合并并裁剪后的行
 */
export function mergeOf(
  current: readonly DockerLogLine[],
  incoming: readonly DockerLogLine[],
  lastTs: string,
): DockerLogLine[] {
  if (incoming.length === 0) {
    return [...current];
  }
  /** 真正新增的行 */
  const fresh =
    lastTs === '' ? [...incoming] : incoming.filter((line) => line.ts === '' || line.ts > lastTs);
  if (fresh.length === 0) {
    return [...current];
  }
  return trimOf([...current, ...fresh]);
}
