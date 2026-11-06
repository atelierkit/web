import { describe, expect, it } from 'vitest';

import {
  ALIYUN_TABS,
  canApply,
  canCancel,
  dateOf,
  maskEmail,
  maskPhone,
  tabIndexOf,
  willExpire,
} from './aliyun.format';

describe('aliyun.format', () => {
  describe('tabIndexOf', () => {
    it('三个标签各自能被识别', () => {
      expect(ALIYUN_TABS.map((item) => item.path)).toEqual(['ssl', 'order', 'contact']);
      expect(tabIndexOf('/aliyun/3/ssl')).toBe(0);
      expect(tabIndexOf('/aliyun/3/order')).toBe(1);
      expect(tabIndexOf('/aliyun/3/contact')).toBe(2);
    });

    it('认不出时回落到证书页', () => {
      expect(tabIndexOf('/aliyun/3')).toBe(0);
      expect(tabIndexOf('/aliyun/3/unknown')).toBe(0);
    });
  });

  describe('maskPhone', () => {
    it('保留前三后四', () => {
      expect(maskPhone('13673618697')).toBe('136****8697');
    });

    it('长度不足时原样返回，不做半截掩码', () => {
      expect(maskPhone('12345')).toBe('12345');
      expect(maskPhone('')).toBe('');
      expect(maskPhone(undefined)).toBe('');
    });
  });

  describe('maskEmail', () => {
    it('保留前两位与整段域名', () => {
      expect(maskEmail('marbleqi@163.com')).toBe('ma***@163.com');
    });

    it('没有 @ 时原样返回', () => {
      expect(maskEmail('not-a-mail')).toBe('not-a-mail');
      expect(maskEmail('')).toBe('');
    });

    it('@ 位于开头时不掩码（避免产出怪异字符串）', () => {
      expect(maskEmail('@163.com')).toBe('@163.com');
    });
  });

  describe('canApply', () => {
    it('只有「待申请」且域名未占用才可申请', () => {
      expect(canApply({ status: 'PAYED', domain: '' })).toBe(true);
      expect(canApply({ status: 'PAYED' })).toBe(true);
    });

    it('已用掉额度或已离开待申请状态都不可申请', () => {
      expect(canApply({ status: 'PAYED', domain: 'a.com' })).toBe(false);
      expect(canApply({ status: 'ISSUED', domain: '' })).toBe(false);
      expect(canApply({ status: 'EXPIRED', domain: '' })).toBe(false);
      expect(canApply({})).toBe(false);
    });

    it('域名只有空白也视为未占用', () => {
      expect(canApply({ status: 'PAYED', domain: '  ' })).toBe(true);
    });
  });

  describe('canCancel', () => {
    it('待申请与审核中可取消', () => {
      expect(canCancel({ status: 'PAYED' })).toBe(true);
      expect(canCancel({ status: 'CHECKING' })).toBe(true);
    });

    it('已签发 / 已过期不可取消', () => {
      expect(canCancel({ status: 'ISSUED' })).toBe(false);
      expect(canCancel({ status: 'EXPIRED' })).toBe(false);
    });
  });

  describe('dateOf', () => {
    it('ISO 转 yyyy-MM-dd', () => {
      expect(dateOf('2026-11-06T00:00:00.000Z')).toBe('2026-11-06');
    });

    it('空值与非法值得到空串', () => {
      expect(dateOf('')).toBe('');
      expect(dateOf(undefined)).toBe('');
      expect(dateOf('not-a-date')).toBe('');
    });
  });

  describe('willExpire', () => {
    it('已过期算即将到期', () => {
      expect(willExpire('2020-01-01T00:00:00.000Z')).toBe(true);
    });

    it('远期证书不告警', () => {
      /** 一年后 */
      const later = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      expect(willExpire(later)).toBe(false);
    });

    it('空值与非法值不告警', () => {
      expect(willExpire('')).toBe(false);
      expect(willExpire('bad')).toBe(false);
    });
  });
});
