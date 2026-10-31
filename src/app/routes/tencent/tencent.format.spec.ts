import { describe, expect, it } from 'vitest';

import {
  DOMAIN_STATUS_TAG,
  FIREWALL_ACTION_TAG,
  SSL_STATUS_TAG,
  TENCENT_TABS,
  businessError,
  canRenew,
  rulePayload,
  tabIndexOf,
} from './tencent.format';
import type { FirewallRule } from './tencent.service';

describe('tencent.format', () => {
  describe('tabIndexOf', () => {
    it('一级页面各自命中自己的标签', () => {
      expect(tabIndexOf('/tencent/3/ssl')).toBe(0);
      expect(tabIndexOf('/tencent/3/domain')).toBe(1);
      expect(tabIndexOf('/tencent/3/lighthouse/ap-guangzhou')).toBe(2);
    });

    it('二级页面高亮到父级标签（DNS 记录属于域名、防火墙属于轻量服务器）', () => {
      expect(tabIndexOf('/tencent/3/dns/D_FREE/example.com')).toBe(1);
      expect(tabIndexOf('/tencent/3/firewall/ap-guangzhou/lhins-1')).toBe(2);
    });

    it('认不出的地址回落到第一个标签', () => {
      expect(tabIndexOf('/tencent/3')).toBe(0);
      expect(tabIndexOf('/tencent/3/unknown')).toBe(0);
      expect(tabIndexOf('')).toBe(0);
    });

    it('标签清单与页面路由顺序一致', () => {
      expect(TENCENT_TABS.map((item) => item.path)).toEqual(['ssl', 'domain', 'lighthouse']);
    });
  });

  describe('businessError', () => {
    it('没有响应时给出可读提示', () => {
      expect(businessError(null)).toBe('接口没有返回内容，请稍后重试！');
    });

    it('业务错误取腾讯云的 Message', () => {
      expect(businessError({ Error: { Code: 'AuthFailure', Message: '签名错误' } })).toBe(
        '签名错误',
      );
    });

    it('没有 Message 时给兜底文案', () => {
      expect(businessError({ Error: {} })).toBe('腾讯云接口调用失败！');
    });

    it('成功响应返回空串（调用方据此判定成功）', () => {
      expect(businessError({ RequestId: 'rid' })).toBe('');
    });
  });

  describe('canRenew', () => {
    /** 参照时间 */
    const now = new Date('2026-10-31T00:00:00');

    it('已过期或一个月内到期时提示续期', () => {
      expect(canRenew('2026-10-01 00:00:00', now)).toBe(true);
      expect(canRenew('2026-11-15 00:00:00', now)).toBe(true);
    });

    it('还剩一个月以上时不提示', () => {
      expect(canRenew('2026-12-31 00:00:00', now)).toBe(false);
    });

    it('空值或脏数据不提示（历史证书的时间字段可能为空）', () => {
      expect(canRenew(undefined, now)).toBe(false);
      expect(canRenew('', now)).toBe(false);
      expect(canRenew('not-a-date', now)).toBe(false);
    });
  });

  describe('rulePayload', () => {
    it('只提交腾讯云声明过的字段，Port 转成字符串', () => {
      /** 表格行，注：Port 给数字模拟「从表格取到非字符串值」的情况 */
      const rows = [
        {
          Protocol: 'TCP',
          Port: 22,
          CidrBlock: '0.0.0.0/0',
          Action: 'ACCEPT',
          FirewallRuleDescription: 'SSH',
          // 表格行还带着腾讯云返回的其它字段
          AppType: 'SSH',
        },
      ] as unknown as FirewallRule[];
      expect(rulePayload(rows)).toEqual([
        {
          Protocol: 'TCP',
          Action: 'ACCEPT',
          FirewallRuleDescription: 'SSH',
          Port: '22',
          CidrBlock: '0.0.0.0/0',
        },
      ]);
    });

    it('空端口 / 空来源不提交（腾讯云对空串判参数非法）', () => {
      expect(
        rulePayload([{ Protocol: 'ALL', Port: '', CidrBlock: '', Ipv6CidrBlock: '' }]),
      ).toEqual([{ Protocol: 'ALL' }]);
    });
  });

  describe('状态标签', () => {
    it('证书、域名、防火墙的取值与腾讯云一致', () => {
      expect(SSL_STATUS_TAG[1]).toEqual({ text: '已通过', color: 'green' });
      expect(DOMAIN_STATUS_TAG['ENABLE']).toEqual({ text: '正常', color: 'green' });
      expect(FIREWALL_ACTION_TAG['DROP']).toEqual({ text: '丢弃', color: 'red' });
    });
  });
});
