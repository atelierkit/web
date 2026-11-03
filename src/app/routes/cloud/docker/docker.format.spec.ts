import { describe, expect, it } from 'vitest';

import {
  bytesText,
  isoTextOf,
  protocolText,
  stateColor,
  stateText,
  timeTextOf,
  verifyText,
} from './docker.format';

describe('docker.format', () => {
  describe('bytesText', () => {
    it('按 1024 进制换算，字节不带小数', () => {
      expect(bytesText(0)).toBe('0 B');
      expect(bytesText(512)).toBe('512 B');
      expect(bytesText(1024)).toBe('1.0 KB');
      expect(bytesText(1536)).toBe('1.5 KB');
      expect(bytesText(1024 * 1024 * 1024 * 2.25)).toBe('2.3 GB');
    });

    it('非法值与负数按 0 处理（老 daemon 可能不返回 Size）', () => {
      expect(bytesText(Number.NaN)).toBe('0 B');
      expect(bytesText(-1)).toBe('0 B');
    });
  });

  describe('timeTextOf', () => {
    it('秒级时间戳转本地时间，零值给横线', () => {
      /** 本地时区的 2026-11-03 08:00:00 */
      const seconds = new Date(2026, 10, 3, 8, 0, 0).getTime() / 1000;
      expect(timeTextOf(seconds)).toBe('2026-11-03 08:00:00');
      expect(timeTextOf(0)).toBe('-');
      expect(timeTextOf(Number.NaN)).toBe('-');
    });
  });

  describe('isoTextOf', () => {
    it('ISO 字符串转本地时间', () => {
      /** 本地时区的 2026-11-03 08:00:00 */
      const value = new Date(2026, 10, 3, 8, 0, 0).toISOString();
      expect(isoTextOf(value)).toBe('2026-11-03 08:00:00');
    });

    it('Docker 的零值时间与空串都显示横线', () => {
      expect(isoTextOf('0001-01-01T00:00:00Z')).toBe('-');
      expect(isoTextOf('')).toBe('-');
    });

    it('解析不了的字符串原样返回（不要把 daemon 的怪值变成 NaN）', () => {
      expect(isoTextOf('not-a-date')).toBe('not-a-date');
    });
  });

  describe('stateText / stateColor', () => {
    it('常见状态给中文与颜色', () => {
      expect(stateText('running')).toBe('运行中');
      expect(stateColor('running')).toBe('green');
      expect(stateText('exited')).toBe('已停止');
      expect(stateColor('paused')).toBe('gold');
      expect(stateColor('dead')).toBe('red');
    });

    it('未收录的状态原样显示、颜色走默认', () => {
      expect(stateText('weird')).toBe('weird');
      expect(stateColor('weird')).toBe('default');
      expect(stateText('')).toBe('-');
    });
  });

  describe('protocolText / verifyText', () => {
    it('明文与加密分开描述（明文是要被看见的风险）', () => {
      expect(protocolText('https')).toBe('https（加密）');
      expect(protocolText('http')).toBe('http（明文）');
      expect(protocolText('ws')).toBe('ws');
      expect(protocolText('')).toBe('-');
    });

    it('证书校验开关给中文', () => {
      expect(verifyText(true)).toBe('校验');
      expect(verifyText(false)).toBe('不校验');
    });
  });
});
