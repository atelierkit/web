import { describe, expect, it } from 'vitest';

import {
  LOG_BUFFER_MAX,
  chunksOf,
  clockOf,
  downloadTextOf,
  filterOf,
  lastTsOf,
  lineTextOf,
  mergeOf,
  trimOf,
} from './log.format';
import type { DockerLogLine } from '../../object/object.types';

/**
 * 造一行日志
 *
 * @param text 正文
 * @param extra 覆盖项
 * @returns 日志行
 */
function lineOf(text: string, extra: Partial<DockerLogLine> = {}): DockerLogLine {
  return { ts: '', stream: 'stdout', text, ...extra };
}

describe('clockOf', () => {
  it('纳秒精度先截到毫秒，与 3 位小数的结果一致', () => {
    expect(clockOf('2026-11-04T01:12:01.338912345Z')).toBe(clockOf('2026-11-04T01:12:01.338Z'));
    expect(clockOf('2026-11-04T01:12:01.338Z')).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
  });

  it('空串给空串，解析不了的原样返回（不显示 Invalid Date）', () => {
    expect(clockOf('')).toBe('');
    expect(clockOf('not-a-time')).toBe('not-a-time');
  });

  it('带时区偏移的时间戳按本地时区显示', () => {
    expect(clockOf('2026-11-04T09:12:01.500+08:00')).toBe(clockOf('2026-11-04T01:12:01.500Z'));
  });
});

describe('lineTextOf', () => {
  it('默认带原始时间戳，也可只取正文', () => {
    /** 日志行 */
    const line = lineOf('hello', { ts: '2026-11-04T01:12:01.3Z' });
    expect(lineTextOf(line)).toBe('2026-11-04T01:12:01.3Z hello');
    expect(lineTextOf(line, false)).toBe('hello');
  });

  it('没有时间戳的行不拼多余的空格', () => {
    expect(lineTextOf(lineOf('hello'))).toBe('hello');
  });
});

describe('filterOf', () => {
  /** 三段日志 */
  const lines = [
    lineOf('boot ok'),
    lineOf('ERROR boom', { stream: 'stderr' }),
    lineOf('GET /health 200'),
  ];

  it('缺省返回全部（且是新数组，避免调用方误改缓冲）', () => {
    /** 结果 */
    const result = filterOf(lines);
    expect(result).toEqual(lines);
    expect(result).not.toBe(lines);
  });

  it('按流过滤', () => {
    expect(filterOf(lines, { stderr: false }).map((line) => line.text)).toEqual([
      'boot ok',
      'GET /health 200',
    ]);
    expect(filterOf(lines, { stdout: false }).map((line) => line.text)).toEqual(['ERROR boom']);
  });

  it('关键字大小写不敏感，正文与时间戳都参与匹配', () => {
    expect(filterOf(lines, { keyword: 'error' }).map((line) => line.text)).toEqual(['ERROR boom']);
    /** 带时间戳的行 */
    const stamped = [lineOf('x', { ts: '2026-11-04T01:12:01Z' })];
    expect(filterOf(stamped, { keyword: '2026-11-04' })).toHaveLength(1);
  });

  it('两个条件同时生效', () => {
    expect(filterOf(lines, { keyword: 'e', stdout: false })).toHaveLength(1);
  });
});

describe('chunksOf', () => {
  it('空关键字返回单段未命中', () => {
    expect(chunksOf('abc', '  ')).toEqual([{ text: 'abc', hit: false }]);
  });

  it('多次命中时切成交替片段', () => {
    expect(chunksOf('aXbXc', 'x')).toEqual([
      { text: 'a', hit: false },
      { text: 'X', hit: true },
      { text: 'b', hit: false },
      { text: 'X', hit: true },
      { text: 'c', hit: false },
    ]);
  });

  it('命中在行首 / 行尾时不产生空片段', () => {
    expect(chunksOf('ab', 'a')).toEqual([
      { text: 'a', hit: true },
      { text: 'b', hit: false },
    ]);
    expect(chunksOf('ab', 'b')).toEqual([
      { text: 'a', hit: false },
      { text: 'b', hit: true },
    ]);
  });

  it('无命中时返回整段（模板照常渲染纯文本）', () => {
    expect(chunksOf('abc', 'zzz')).toEqual([{ text: 'abc', hit: false }]);
  });

  it('HTML 片段按普通文本切片（不会被当成标签）', () => {
    expect(chunksOf('<script>x</script>', 'script')).toEqual([
      { text: '<', hit: false },
      { text: 'script', hit: true },
      { text: '>x</', hit: false },
      { text: 'script', hit: true },
      { text: '>', hit: false },
    ]);
  });
});

describe('downloadTextOf', () => {
  it('带原始时间戳，末尾补换行', () => {
    expect(downloadTextOf([lineOf('a', { ts: 'T1' }), lineOf('b', { ts: 'T2' })])).toBe(
      'T1 a\nT2 b\n',
    );
  });

  it('空内容给空串（不产出只有一个换行的文件）', () => {
    expect(downloadTextOf([])).toBe('');
  });
});

describe('lastTsOf', () => {
  it('从后往前找第一个非空时间戳', () => {
    expect(lastTsOf([lineOf('a', { ts: 'T1' }), lineOf('b'), lineOf('c')])).toBe('T1');
    expect(lastTsOf([lineOf('a')])).toBe('');
  });
});

describe('trimOf', () => {
  it('超限时丢最旧的', () => {
    /** 三条 */
    const lines = [lineOf('1'), lineOf('2'), lineOf('3')];
    expect(trimOf(lines, 2).map((line) => line.text)).toEqual(['2', '3']);
  });

  it('未超限时返回副本（不共享引用）', () => {
    /** 一条 */
    const lines = [lineOf('1')];
    /** 结果 */
    const result = trimOf(lines);
    expect(result).toEqual(lines);
    expect(result).not.toBe(lines);
    expect(LOG_BUFFER_MAX).toBe(5000);
  });
});

describe('mergeOf', () => {
  it('按最后一行时间戳去重（since 是闭区间，边界行会重复）', () => {
    /** 当前 */
    const current = [lineOf('a', { ts: 'T1' }), lineOf('b', { ts: 'T2' })];
    /** 增量，注：T2 是重复的边界行 */
    const incoming = [lineOf('b', { ts: 'T2' }), lineOf('c', { ts: 'T3' })];
    expect(mergeOf(current, incoming, 'T2').map((line) => line.text)).toEqual(['a', 'b', 'c']);
  });

  it('没有历史时直接接上', () => {
    expect(mergeOf([], [lineOf('a', { ts: 'T1' })], '').map((line) => line.text)).toEqual(['a']);
  });

  it('全部重复时不改变缓冲', () => {
    /** 当前 */
    const current = [lineOf('a', { ts: 'T2' })];
    expect(mergeOf(current, [lineOf('a', { ts: 'T1' })], 'T2')).toEqual(current);
  });

  it('合并后仍受缓冲上限约束', () => {
    /** 当前 */
    const current = [lineOf('1'), lineOf('2')];
    /** 增量 */
    const incoming = [lineOf('3'), lineOf('4')];
    expect(mergeOf(current, incoming, '').length).toBe(4);
  });
});
