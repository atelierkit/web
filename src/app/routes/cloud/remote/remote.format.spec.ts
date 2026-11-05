import { describe, expect, it } from 'vitest';

import {
  authText,
  bandwidthText,
  bytesText,
  charsetText,
  chunksOf,
  errorTextOf,
  fingerprintText,
  keyFormatText,
  keyInspectText,
  netStateText,
  trustedText,
  uptimeText,
  usagePercent,
} from './remote.format';

describe('remote.format', () => {
  describe('authText / charsetText', () => {
    it('鉴权方式映射成中文', () => {
      expect(authText('password')).toBe('密码');
      expect(authText('key')).toBe('私钥');
      expect(authText('agent')).toBe('agent');
      expect(authText('')).toBe('-');
    });

    it('字符集按展示习惯大写', () => {
      expect(charsetText('utf-8')).toBe('UTF-8');
      expect(charsetText('gb18030')).toBe('GB18030');
      expect(charsetText('')).toBe('UTF-8');
    });
  });

  describe('netStateText', () => {
    it('三档状态各自有文案', () => {
      expect(netStateText('up')).toBe('已启用');
      expect(netStateText('down')).toBe('已停用');
      expect(netStateText('unknown')).toBe('未知');
    });

    it('没见过的取值不显示成「已停用」（取不到 ≠ 停用）', () => {
      expect(netStateText('')).toBe('未知');
    });
  });

  describe('bandwidthText', () => {
    it('速率带双工模式（真机 enp1s0 是 1000 Mb/s 全双工）', () => {
      expect(bandwidthText(1000, 'full', 'up')).toBe('1000 Mb/s · 全双工');
      expect(bandwidthText(100, 'half', 'up')).toBe('100 Mb/s · 半双工');
    });

    it('双工未知（虚拟设备 / 部分无线驱动）时只给速率，不硬塞「未知双工」', () => {
      expect(bandwidthText(2500, 'unknown', 'up')).toBe('2500 Mb/s');
      expect(bandwidthText(866, '', 'up')).toBe('866 Mb/s');
    });

    it('速率为 0 时按链路状态区分「未连接」与「未知速率」', () => {
      // 注：物理口网线没插时内核读 speed 返回 EINVAL，不能说成 0 带宽
      expect(bandwidthText(0, '', 'down')).toBe('未连接');
      expect(bandwidthText(0, '', 'unknown')).toBe('未知速率');
    });

    it('非法速率不打印 NaN', () => {
      expect(bandwidthText(Number.NaN, 'full', 'up')).toBe('未知速率');
    });
  });

  describe('bytesText', () => {
    it('按 1024 进制换算，字节不带小数', () => {
      expect(bytesText(0)).toBe('0 B');
      expect(bytesText(512)).toBe('512 B');
      expect(bytesText(1536)).toBe('1.5 KB');
      expect(bytesText(1024 * 1024 * 1024)).toBe('1.0 GB');
    });

    it('非法值退回 0 B', () => {
      expect(bytesText(Number.NaN)).toBe('0 B');
      expect(bytesText(-1)).toBe('0 B');
    });
  });

  describe('uptimeText', () => {
    it('按天 / 小时 / 分拆分', () => {
      expect(uptimeText(3 * 86400 + 4 * 3600 + 5 * 60)).toBe('3 天 4 小时 5 分');
      expect(uptimeText(3600)).toBe('1 小时 0 分');
      expect(uptimeText(59)).toBe('0 分');
    });

    it('0 与非法值给 -', () => {
      expect(uptimeText(0)).toBe('-');
      expect(uptimeText(Number.NaN)).toBe('-');
    });
  });

  describe('usagePercent', () => {
    it('按「总量减可用」算使用率', () => {
      expect(usagePercent(1000, 250)).toBe(75);
      expect(usagePercent(1000, 0)).toBe(100);
    });

    it('数据不全时给 0，不显示假进度', () => {
      expect(usagePercent(0, 0)).toBe(0);
      expect(usagePercent(1000, Number.NaN)).toBe(0);
    });
  });

  describe('fingerprintText', () => {
    it('缩写保留首尾便于人眼比对', () => {
      expect(fingerprintText('SHA256:ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0')).toBe(
        'SHA256:ungWv48B…AFa0',
      );
    });

    it('短指纹原样返回（不硬缩）', () => {
      expect(fingerprintText('SHA256:short')).toBe('SHA256:short');
    });

    it('空值给「未记录」', () => {
      expect(fingerprintText('')).toBe('未记录');
      expect(fingerprintText('   ')).toBe('未记录');
    });

    it('trustedText 区分已记录与未记录', () => {
      expect(trustedText('')).toBe('未记录');
      expect(trustedText('SHA256:abc')).toBe('已记录');
    });
  });

  describe('errorTextOf', () => {
    it('已登记的错误码给出「下一步该做什么」', () => {
      expect(errorTextOf('HOST_KEY_CHANGED')).toContain('信任新指纹');
      expect(errorTextOf('AUTH_FAILED')).toContain('认证失败');
      expect(errorTextOf('LIMIT_EXCEEDED')).toContain('上限');
    });

    it('未登记的错误码带出后端文案，不吞线索', () => {
      expect(errorTextOf('UNKNOWN', '磁盘满了')).toBe('磁盘满了');
      expect(errorTextOf('UNKNOWN')).toBe('连接失败，请稍后重试。');
    });
  });

  describe('keyFormatText / keyInspectText', () => {
    it('格式映射成用户认得的名字', () => {
      expect(keyFormatText('openssh')).toBe('OpenSSH');
      expect(keyFormatText('pkcs8')).toBe('PKCS#8');
      expect(keyFormatText('pem')).toContain('PEM');
      expect(keyFormatText('')).toBe('未知格式');
    });

    it('PKCS#8 明说「保存时自动转换」，用户不必自己找命令', () => {
      /** 预检结果 */
      const text = keyInspectText({
        format: 'pkcs8',
        converted: true,
        encrypted: false,
        fingerprint: 'SHA256:abc',
      });
      expect(text).toContain('PKCS#8');
      expect(text).toContain('自动转换');
      expect(text).toContain('口令一栏留空');
      expect(text).toContain('SHA256:abc');
    });

    it('加密私钥提示去填口令，且不出现「留空即可」这种相反的指引', () => {
      /** 预检结果 */
      const text = keyInspectText({
        format: 'openssh',
        converted: false,
        encrypted: true,
        fingerprint: 'SHA256:def',
      });
      expect(text).toContain('带口令');
      expect(text).not.toContain('留空即可');
      expect(text).not.toContain('自动转换');
    });
  });

  describe('chunksOf', () => {
    it('按上限切片，最后一片可以更短', () => {
      expect(chunksOf('abcdefg', 3)).toEqual(['abc', 'def', 'g']);
    });

    it('空串不产生分片', () => {
      expect(chunksOf('')).toEqual([]);
    });

    it('不丢字符（拼接后与原文一致）', () => {
      /** 原文 */
      const text = '中'.repeat(5000);
      expect(chunksOf(text, 4096).join('')).toBe(text);
    });
  });
});
