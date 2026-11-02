import { describe, expect, it } from 'vitest';

import {
  buildSettingPayload,
  cleanQuery,
  isNotFound,
  isSettingEditable,
  isSlow,
  nameText,
  operateDetailItems,
  operateText,
  reqDetailItems,
  resultFilter,
  statusText,
  timeText,
  toSettingForm,
  userText,
} from './admin.format';

describe('admin.format', () => {
  describe('标签文案', () => {
    it('命中映射时给中文，未命中回落原取值', () => {
      expect(nameText('setting')).toBe('配置');
      expect(nameText('unknown')).toBe('unknown');
      expect(operateText('update')).toBe('更新');
      expect(operateText('archive')).toBe('archive');
      expect(statusText(403)).toBe('403 禁止访问');
      expect(statusText(418)).toBe('418');
    });

    it('空值返回空串（详情里才不会拼出 undefined）', () => {
      expect(nameText(undefined)).toBe('');
      expect(nameText(null)).toBe('');
      expect(statusText(null)).toBe('');
    });
  });

  describe('resultFilter', () => {
    it('success / error 各转成 true / false，未选择为 undefined', () => {
      expect(resultFilter('success')).toBe(true);
      expect(resultFilter('error')).toBe(false);
      expect(resultFilter('')).toBeUndefined();
      expect(resultFilter(undefined)).toBeUndefined();
    });
  });

  describe('cleanQuery', () => {
    it('剔除 undefined / null / 空串，保留 0 与 false', () => {
      expect(
        cleanQuery({ userId: 0, success: false, name: '', action: null, path: undefined, pi: 1 }),
      ).toEqual({ userId: 0, success: false, pi: 1 });
    });

    it('原对象不被修改', () => {
      const value = { name: '', pi: 1 };
      cleanQuery(value);
      expect(value).toEqual({ name: '', pi: 1 });
    });
  });

  describe('isSlow', () => {
    it('超过阈值才算慢请求', () => {
      expect(isSlow(1000)).toBe(false);
      expect(isSlow(1001)).toBe(true);
      expect(isSlow(20, 10)).toBe(true);
    });
  });

  describe('userText', () => {
    it('优先邮箱，其次用户ID，都没有时用调用方给的文案', () => {
      expect(userText({ email: 'a@b.c', userId: 7 }, '系统/未登录')).toBe('a@b.c');
      expect(userText({ email: null, userId: 7 }, '系统/未登录')).toBe('用户ID7');
      expect(userText({ email: null, userId: 0 }, '系统/未登录')).toBe('系统/未登录');
    });
  });

  describe('timeText', () => {
    it('格式化为 yyyy-MM-dd HH:mm:ss，空值为 -', () => {
      expect(timeText(Date.now())).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      expect(timeText(0)).toBe('-');
      expect(timeText(undefined)).toBe('-');
    });
  });

  describe('详情字段', () => {
    it('操作日志详情带上中文标签与原取值', () => {
      const items = operateDetailItems({
        id: 9,
        name: 'setting',
        operate: 'update',
        userId: 7,
        remark: '',
        at: 0,
        email: 'a@b.c',
      });
      expect(items[1]).toEqual({ label: '操作对象', value: '配置（setting）' });
      expect(items[2]).toEqual({ label: '操作类型', value: '更新（update）' });
      expect(items[3]).toEqual({ label: '操作用户', value: 'a@b.c' });
      // 注：空备注要给占位符，否则详情里是一行空白
      expect(items[5]).toEqual({ label: '操作备注', value: '-' });
      expect(items[6]).toEqual({ label: '操作时间', value: '-' });
    });

    it('请求日志详情含耗时与两端时间', () => {
      const items = reqDetailItems({
        reqId: 3,
        url: '/admin/req/index',
        controller: 'AdminReqController',
        action: 'index',
        status: 500,
        duration: 1200,
        userId: 0,
        email: null,
        clientIp: '127.0.0.1',
        serverIp: '192.0.2.10',
        startAt: 0,
        endAt: 0,
      });
      expect(items[4]).toEqual({ label: '结果', value: '500 服务端错误' });
      expect(items[5]).toEqual({ label: '请求耗时', value: '1200ms' });
      expect(items[6]).toEqual({ label: '请求用户', value: '未登录' });
      expect(items[10]).toEqual({ label: '请求时间', value: '-' });
    });
  });

  describe('配置页', () => {
    it('只有 app / icp / email 有专属编辑页，其余编码不给入口', () => {
      expect(isSettingEditable('app')).toBe(true);
      expect(isSettingEditable('icp')).toBe(true);
      expect(isSettingEditable('email')).toBe(true);
      expect(isSettingEditable('other')).toBe(false);
      expect(isSettingEditable('')).toBe(false);
      expect(isSettingEditable(null)).toBe(false);
      expect(isSettingEditable(undefined)).toBe(false);
    });

    it('isNotFound 只认响应体上的 404（拦截器抛的是后端响应体，不是 HttpErrorResponse）', () => {
      expect(isNotFound({ status: 404, message: '配置不存在！' })).toBe(true);
      expect(isNotFound({ status: 500 })).toBe(false);
      // 注：status 0 是网络中断，不能当「尚未配置」处理，否则会静默转成新建态
      expect(isNotFound({ status: 0 })).toBe(false);
      expect(isNotFound(null)).toBe(false);
      expect(isNotFound(undefined)).toBe(false);
      expect(isNotFound('404')).toBe(false);
    });

    it('toSettingForm 回填配置值与两端时间戳', () => {
      expect(
        toSettingForm({
          code: 'icp',
          value: { owner: '示例公司', icp: '粤ICP备00000000号' },
          status: false,
          create: { at: 100 },
          update: { at: 200 },
        }),
      ).toEqual({
        value: { owner: '示例公司', icp: '粤ICP备00000000号' },
        status: false,
        createAt: 100,
        updateAt: 200,
      });
    });

    it('未配置时给空白表单，且状态默认启用', () => {
      const blank = { value: {}, status: true, createAt: null, updateAt: null };
      expect(toSettingForm()).toEqual(blank);
      expect(toSettingForm(null)).toEqual(blank);
      // 注：只有 value 没有审计信息时，两个时间戳都要给 null，模板才不会渲染出 undefined
      expect(toSettingForm({ code: 'app', value: { name: '示例' }, status: true })).toEqual({
        ...blank,
        value: { name: '示例' },
      });
    });

    it('buildSettingPayload 只取表单里的值与状态', () => {
      expect(
        buildSettingPayload('app', { value: { name: '示例' }, status: true, createAt: 100 }),
      ).toEqual({ code: 'app', value: { name: '示例' }, status: true });
    });

    it('开关没给出取值时按启用处理，显式关闭必须保留', () => {
      expect(buildSettingPayload('icp', { value: {} }).status).toBe(true);
      expect(buildSettingPayload('icp', { value: {}, status: undefined }).status).toBe(true);
      expect(buildSettingPayload('icp', { value: {}, status: false }).status).toBe(false);
    });
  });
});
