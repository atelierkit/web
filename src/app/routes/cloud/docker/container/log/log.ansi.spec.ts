import { describe, expect, it } from 'vitest';

import { ansiSpansOf, cssOf, levelOf, stripAnsi } from './log.ansi';

/** 转义符，注：写字面量 `\x1b` 会被 lint 判成控制字符，统一用 Unicode 转义 */
const ESC = '\u001b';

/**
 * 造一段 SGR 序列
 *
 * @param codes 参数
 * @returns 序列文本
 */
function sgrOf(codes: string): string {
  return `${ESC}[${codes}m`;
}

/**
 * 造一段非 SGR 的 CSI 序列
 *
 * @param params 参数
 * @param final 终止字节
 * @returns 序列文本
 */
function csiOf(params: string, final: string): string {
  return `${ESC}[${params}${final}`;
}

/**
 * 取分片文本
 *
 * @param text 原始文本
 * @returns 分片文本数组
 */
function textsOf(text: string): string[] {
  return ansiSpansOf(text).spans.map((piece) => piece.text);
}

describe('ansiSpansOf', () => {
  it('无控制符的普通行原样返回一段，不复制样式对象', () => {
    /** 结果 */
    const result = ansiSpansOf('hello world');
    expect(result.spans).toEqual([{ text: 'hello world', style: null }]);
    expect(result.carry).toBeNull();
  });

  it('空串给空数组', () => {
    expect(ansiSpansOf('').spans).toEqual([]);
  });

  it('16 色前景：文本被切段，颜色只作用于被包裹的部分', () => {
    /** 结果 */
    const result = ansiSpansOf(`a${sgrOf('32')}green${sgrOf('0')}b`);
    expect(result.spans.map((piece) => piece.text)).toEqual(['a', 'green', 'b']);
    expect(result.spans[0].style).toBeNull();
    expect(result.spans[1].style?.fg).toBe('#0dbc79');
    expect(result.spans[2].style).toBeNull();
    expect(result.carry).toBeNull();
  });

  it('亮色 90-97 与背景 40-47 各自落到 fg / bg', () => {
    /** 结果 */
    const result = ansiSpansOf(`${sgrOf('91;44')}x`);
    expect(result.spans[0].style?.fg).toBe('#f14c4c');
    expect(result.spans[0].style?.bg).toBe('#2472c8');
  });

  it('组合参数：0 重置后同组里的颜色仍然生效', () => {
    /** 结果 */
    const result = ansiSpansOf(`${sgrOf('0;32;1')}x`);
    expect(result.spans[0].style?.fg).toBe('#0dbc79');
    expect(result.spans[0].style?.bold).toBe(true);
  });

  it('空参数等同于重置', () => {
    /** 结果 */
    const result = ansiSpansOf(`${sgrOf('31')}x${sgrOf('')}y`);
    expect(result.spans[1].style).toBeNull();
  });

  it('256 色：5 号模式按下标取色（16-231 色立方、232-255 灰阶）', () => {
    expect(ansiSpansOf(`${sgrOf('38;5;196')}x`).spans[0].style?.fg).toBe('#ff0000');
    expect(ansiSpansOf(`${sgrOf('38;5;16')}x`).spans[0].style?.fg).toBe('#000000');
    expect(ansiSpansOf(`${sgrOf('38;5;46')}x`).spans[0].style?.fg).toBe('#00ff00');
    // 注：232 起是 24 级灰阶，第一级为 #080808
    expect(ansiSpansOf(`${sgrOf('38;5;232')}x`).spans[0].style?.fg).toBe('#080808');
    expect(ansiSpansOf(`${sgrOf('38;5;255')}x`).spans[0].style?.fg).toBe('#eeeeee');
    // 越界色号不作为，保持默认前景
    expect(ansiSpansOf(`${sgrOf('38;5;300')}x`).spans[0].style).toBeNull();
  });

  it('256 色：0-15 复用基础调色板', () => {
    expect(ansiSpansOf(`${sgrOf('48;5;9')}x`).spans[0].style?.bg).toBe('#f14c4c');
  });

  it('真彩：2 号模式拼 #rrggbb，通道值越界被钳制', () => {
    expect(ansiSpansOf(`${sgrOf('38;2;18;52;86')}x`).spans[0].style?.fg).toBe('#123456');
    expect(ansiSpansOf(`${sgrOf('48;2;300;0;0')}x`).spans[0].style?.bg).toBe('#ff0000');
  });

  it('未知的扩展色模式只跳过模式位，后续参数照常解释', () => {
    /** 结果 */
    const result = ansiSpansOf(`${sgrOf('38;9;31')}x`);
    expect(result.spans[0].style?.fg).toBe('#cd3131');
  });

  it('属性开关：加粗/暗淡/斜体/下划线可开可关', () => {
    expect(ansiSpansOf(`${sgrOf('1')}x`).spans[0].style?.bold).toBe(true);
    expect(ansiSpansOf(`${sgrOf('2')}x`).spans[0].style?.dim).toBe(true);
    expect(ansiSpansOf(`${sgrOf('3')}x`).spans[0].style?.italic).toBe(true);
    expect(ansiSpansOf(`${sgrOf('4')}x`).spans[0].style?.underline).toBe(true);
    expect(ansiSpansOf(`${sgrOf('1;22')}x`).spans[0].style).toBeNull();
    expect(ansiSpansOf(`${sgrOf('3;23')}x`).spans[0].style).toBeNull();
    expect(ansiSpansOf(`${sgrOf('4;24')}x`).spans[0].style).toBeNull();
    expect(ansiSpansOf(`${sgrOf('31;39')}x`).spans[0].style).toBeNull();
    expect(ansiSpansOf(`${sgrOf('41;49')}x`).spans[0].style).toBeNull();
  });

  it('跨行继承：行尾未重置的颜色带到下一行（多行堆栈）', () => {
    /** 第一行 */
    const first = ansiSpansOf(`${sgrOf('31')}boom`);
    expect(first.carry?.fg).toBe('#cd3131');
    /** 第二行，注：以第一行的 carry 为初值 */
    const second = ansiSpansOf('  at main', first.carry);
    expect(second.spans[0].style?.fg).toBe('#cd3131');
  });

  it('非 SGR 的 CSI 一律丢弃，不留可见残字', () => {
    expect(textsOf(`${csiOf('2', 'J')}cleared`)).toEqual(['cleared']);
    expect(textsOf(`a${csiOf('', 'K')}b`)).toEqual(['ab']);
    expect(textsOf(`${csiOf('1;1', 'H')}home`)).toEqual(['home']);
    expect(textsOf(`${csiOf('?25', 'l')}hidden`)).toEqual(['hidden']);
  });

  it('OSC 序列整段丢弃（BEL 与 ST 两种结束符）', () => {
    expect(textsOf(`${ESC}]0;title${'\u0007'}body`)).toEqual(['body']);
    expect(textsOf(`${ESC}]8;;http://x${ESC}\\link`)).toEqual(['link']);
    // 未闭合的 OSC 吃到行尾
    expect(textsOf(`head${ESC}]0;never`)).toEqual(['head']);
  });

  it('字符集选择与单字符 ESC 序列不留下字符', () => {
    expect(textsOf(`${ESC}(Blatin`)).toEqual(['latin']);
    expect(textsOf(`${ESC}=keypad`)).toEqual(['keypad']);
    expect(textsOf(`${ESC}#8line`)).toEqual(['line']);
  });

  it('被截断的序列丢弃残缺部分，不抛错', () => {
    expect(textsOf('head\u001b[32')).toEqual(['head']);
    expect(textsOf('head\u001b')).toEqual(['head']);
  });

  it('行内回车按「最后一次覆盖」处理（进度条）', () => {
    expect(textsOf('10%\r50%\r100%')).toEqual(['100%']);
    // 回车之前的内容连同其样式一起丢弃
    expect(textsOf(`${sgrOf('31')}old\rnew`)).toEqual(['new']);
  });

  it('相邻同样式的片段合并，减少 DOM 节点', () => {
    /** 结果 */
    const result = ansiSpansOf(`${sgrOf('32')}a${sgrOf('32')}b`);
    expect(result.spans).toHaveLength(1);
    expect(result.spans[0].text).toBe('ab');
  });
});

describe('stripAnsi', () => {
  it('去掉颜色与非 SGR 序列，保留正文', () => {
    expect(stripAnsi(`${sgrOf('32')}ok${sgrOf('0')} ${csiOf('2', 'K')}done`)).toBe('ok done');
  });

  it('普通文本原样返回（不建多余对象）', () => {
    expect(stripAnsi('plain')).toBe('plain');
  });

  it('回车覆盖同样生效', () => {
    expect(stripAnsi('10%\r100%')).toBe('100%');
  });
});

describe('levelOf', () => {
  it('行首级别词（大写、带时间戳前缀、带方括号）', () => {
    expect(levelOf('ERROR conn refused')).toBe('error');
    expect(levelOf('2026-11-04T01:12:02.455Z WARN pool near limit')).toBe('warn');
    expect(levelOf('[info] server started')).toBe('info');
    expect(levelOf('  - debug: cache hit')).toBe('debug');
  });

  it('别名归一：fatal/panic/critical → error，notice → info，trace → debug', () => {
    expect(levelOf('FATAL boom')).toBe('error');
    expect(levelOf('panic: nil pointer')).toBe('error');
    expect(levelOf('notice: reloaded')).toBe('info');
    expect(levelOf('trace: sql')).toBe('debug');
  });

  it('结构化日志的 level= 与 JSON 写法', () => {
    expect(levelOf('time=1 level=error msg=boom')).toBe('error');
    expect(levelOf('{"level":"warn","msg":"slow"}')).toBe('warn');
  });

  it('识别不出时给空串，不做全文模糊匹配', () => {
    expect(levelOf('GET /orders/error/42 200')).toBe('');
    expect(levelOf('')).toBe('');
    // 注：Map 查表避开原型属性，`constructor` 不该被当成级别
    expect(levelOf('constructor failed')).toBe('');
  });

  it('同一行有多个级别词时取行首那个', () => {
    expect(levelOf('INFO retry after error')).toBe('info');
  });
});

describe('cssOf', () => {
  it('默认样式给 null', () => {
    expect(cssOf(null, false)).toBeNull();
  });

  it('颜色与属性映射到内联样式', () => {
    expect(
      cssOf(
        { fg: '#ff0000', bg: '#000000', bold: true, dim: true, italic: true, underline: true },
        false,
      ),
    ).toEqual({
      color: '#ff0000',
      'background-color': '#000000',
      'font-weight': '600',
      'font-style': 'italic',
      'text-decoration': 'underline',
      opacity: '0.7',
    });
  });

  it('命中关键字时不套用原文前景与背景（高亮块要统一的对比度）', () => {
    /** 样式 */
    const css = cssOf(
      { fg: '#00ff00', bg: '#123456', bold: false, dim: false, italic: false, underline: false },
      true,
    );
    expect(css).toBeNull();
  });
});

describe('真机样本对撞', () => {
  it('git --color=always 的分支装饰：无参重置 `\\x1b[m` 也要认', () => {
    /** 真实字节，注：取自 `git -c color.ui=always log -1 --oneline --decorate` */
    const raw = `${ESC}[33m340eb0f${ESC}[m${ESC}[1;36mHEAD${ESC}[m`;
    /** 结果 */
    const result = ansiSpansOf(raw);
    expect(result.spans.map((piece) => piece.text)).toEqual(['340eb0f', 'HEAD']);
    expect(result.spans[0].style?.fg).toBe('#e5e510');
    expect(result.spans[1].style?.fg).toBe('#11a8cd');
    expect(result.spans[1].style?.bold).toBe(true);
    expect(result.carry).toBeNull();
  });

  it('node util.inspect(colors:true)：39 恢复默认、90 亮黑', () => {
    /** 真实字节，注：取自 `console.log(util.inspect(obj, { colors: true }))` */
    const raw =
      `{ a: ${ESC}[33m1${ESC}[39m, b: ${ESC}[32m's'${ESC}[39m, ` +
      `c: [ ${ESC}[33mtrue${ESC}[39m, ${ESC}[90mundefined${ESC}[39m ] }`;
    /** 结果 */
    const result = ansiSpansOf(raw);
    expect(result.spans.map((piece) => piece.text)).toEqual([
      '{ a: ',
      '1',
      ', b: ',
      "'s'",
      ', c: [ ',
      'true',
      ', ',
      'undefined',
      ' ] }',
    ]);
    expect(result.spans[1].style?.fg).toBe('#e5e510');
    expect(result.spans[7].style?.fg).toBe('#767676');
    // 39 之后回到默认前景
    expect(result.spans[2].style).toBeNull();
  });

  it('tsc / eslint 风格的一行错误：真彩不必，1;31 与 0 就够了', () => {
    /** 真实字节，注：`tsc` 与多数 linter 的错误行就是这个形状 */
    const raw = `${ESC}[1;31merror${ESC}[0m TS2322: Type mismatch`;
    /** 结果 */
    const result = ansiSpansOf(raw);
    expect(result.spans.map((piece) => piece.text)).toEqual(['error', ' TS2322: Type mismatch']);
    expect(result.spans[0].style).toEqual({
      fg: '#cd3131',
      bg: '',
      bold: true,
      dim: false,
      italic: false,
      underline: false,
    });
  });
});
