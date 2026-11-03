import { describe, expect, it } from 'vitest';

import {
  authText,
  bytesText,
  cpuText,
  isoTextOf,
  protocolText,
  rolesText,
  statusColor,
  statusText,
  verifyText,
} from './kubernetes.format';

describe('kubernetes.format', () => {
  describe('bytesText', () => {
    it('按 1024 进制换算，字节不带小数', () => {
      expect(bytesText(0)).toBe('0 B');
      expect(bytesText(512)).toBe('512 B');
      expect(bytesText(1024)).toBe('1.0 KB');
      expect(bytesText(8 * 1024 ** 3)).toBe('8.0 GB');
    });

    it('非法值与负数按 0 处理（老集群可能不给 capacity）', () => {
      expect(bytesText(Number.NaN)).toBe('0 B');
      expect(bytesText(-1)).toBe('0 B');
    });
  });

  describe('cpuText', () => {
    it('整数不带小数，小数保留一位', () => {
      expect(cpuText(4)).toBe('4 核');
      expect(cpuText(2.5)).toBe('2.5 核');
      expect(cpuText(0)).toBe('0 核');
      expect(cpuText(Number.NaN)).toBe('0 核');
    });
  });

  describe('isoTextOf', () => {
    it('ISO 字符串转本地时间', () => {
      /** 本地时区的 2026-11-03 08:00:00 */
      const value = new Date(2026, 10, 3, 8, 0, 0).toISOString();
      expect(isoTextOf(value)).toBe('2026-11-03 08:00:00');
    });

    it('空值与零值时间给横线', () => {
      expect(isoTextOf('')).toBe('-');
      expect(isoTextOf('0001-01-01T00:00:00Z')).toBe('-');
    });

    it('解析不了的字符串也给横线（不要把集群的怪值显示成 Invalid Date）', () => {
      expect(isoTextOf('not-a-date')).toBe('-');
    });
  });

  describe('statusText / statusColor', () => {
    it('常见状态给中文与颜色', () => {
      expect(statusText('Running')).toBe('运行中');
      expect(statusColor('Running')).toBe('green');
      expect(statusText('Pending')).toBe('等待中');
      expect(statusColor('Pending')).toBe('gold');
      expect(statusText('NotReady')).toBe('未就绪');
      expect(statusColor('NotReady')).toBe('red');
    });

    it('容器级故障原因不翻译（原文才是社区里的通用说法）', () => {
      expect(statusText('CrashLoopBackOff')).toBe('CrashLoopBackOff');
      expect(statusColor('CrashLoopBackOff')).toBe('red');
    });

    it('未收录的状态原样显示、颜色走默认', () => {
      expect(statusText('TerminatingX')).toBe('TerminatingX');
      expect(statusColor('weird')).toBe('default');
      expect(statusText('')).toBe('-');
    });
  });

  describe('authText / protocolText / verifyText / rolesText', () => {
    it('鉴权方式给中文说明', () => {
      expect(authText('token')).toBe('ServiceAccount Token');
      expect(authText('cert')).toBe('客户端证书');
      expect(authText('anonymous')).toBe('匿名（无凭据）');
      expect(authText('')).toBe('-');
      expect(authText('other')).toBe('other');
    });

    it('明文与加密分开描述（明文是要被看见的风险）', () => {
      expect(protocolText('https')).toBe('https（加密）');
      expect(protocolText('http')).toBe('http（明文）');
      expect(protocolText('')).toBe('-');
    });

    it('证书校验开关给中文', () => {
      expect(verifyText(true)).toBe('校验');
      expect(verifyText(false)).toBe('不校验');
    });

    it('没有角色标签的节点显示横线，而不是编造一个 worker', () => {
      expect(rolesText('')).toBe('-');
      expect(rolesText('control-plane,master')).toBe('control-plane,master');
    });
  });
});
