import type { STColumnTag } from '@delon/abc/st';
import { formatDateTime } from '@shared';

import type { OperateRow, ReqQuery, ReqRow } from './admin.service';

/**
 * 管理员页面用到的纯逻辑
 *
 * 注 1：抽成独立模块而不是写在组件里，是为了能在单元测试里直接覆盖 —— 组件文件 import 了
 * `SHARED_IMPORTS`，测试一旦加载它就会把整片页面模块带进覆盖率分母（实测全局语句覆盖率会掉十几个点）
 * 注 2：这里对 `admin.service` 只做 `import type`（编译期擦除），不会与服务的反向引用形成运行时循环
 */

/** 详情弹窗的一行 */
export interface DetailItem {
  /** 字段名 */
  label: string;
  /** 字段值 */
  value: string;
}

/** 请求日志查询表单取值，注：比接口参数多一个字符串形式的 `result`（success / error） */
export interface ReqForm extends Omit<ReqQuery, 'success' | 'pi' | 'ps'> {
  /** 结果筛选 */
  result?: string;
}

/** 操作对象中文标签映射 */
export const OPERATE_NAME_TAGS: STColumnTag = {
  stock: { text: '股票', color: 'blue' },
  k: { text: 'K线', color: 'blue' },
  day: { text: '交易日', color: 'blue' },
  sync: { text: '数据同步', color: 'cyan' },
  category: { text: '分组', color: 'geekblue' },
  product: { text: '产品', color: 'geekblue' },
  role: { text: '角色', color: 'purple' },
  user: { text: '用户', color: 'purple' },
  setting: { text: '配置', color: 'gold' },
  kong: { text: 'KONG站点', color: 'orange' },
  key: { text: '云密钥', color: 'orange' },
};

/** 操作类型中文标签映射 */
export const OPERATE_ACTION_TAGS: STColumnTag = {
  create: { text: '创建', color: 'green' },
  update: { text: '更新', color: 'blue' },
  sort: { text: '排序', color: 'cyan' },
  sync: { text: '同步', color: 'geekblue' },
  login: { text: '登录', color: 'green' },
  register: { text: '注册', color: 'green' },
  valid: { text: '令牌设置', color: 'gold' },
  email: { text: '邮箱变更', color: 'orange' },
};

/** 请求状态码标签映射，注：2xx 成功（绿）、3xx 缓存（蓝）、4xx 客户端错误（橙）、5xx 服务端错误（红） */
export const REQ_STATUS_TAGS: STColumnTag = {
  200: { text: '200 成功', color: 'green' },
  201: { text: '201 已创建', color: 'green' },
  204: { text: '204 无内容', color: 'green' },
  301: { text: '301 永久重定向', color: 'blue' },
  302: { text: '302 临时重定向', color: 'blue' },
  304: { text: '304 未修改', color: 'blue' },
  400: { text: '400 请求错误', color: 'orange' },
  401: { text: '401 未授权', color: 'orange' },
  403: { text: '403 禁止访问', color: 'orange' },
  404: { text: '404 不存在', color: 'orange' },
  409: { text: '409 冲突', color: 'orange' },
  422: { text: '422 校验失败', color: 'orange' },
  500: { text: '500 服务端错误', color: 'red' },
  502: { text: '502 网关错误', color: 'red' },
  503: { text: '503 服务不可用', color: 'red' },
  504: { text: '504 网关超时', color: 'red' },
};

/** 状态码下拉字典 */
export const REQ_STATUS_ENUM: Array<{ value: number; label: string }> = [
  { value: 200, label: '200 成功' },
  { value: 201, label: '201 已创建' },
  { value: 204, label: '204 无内容' },
  { value: 304, label: '304 未修改' },
  { value: 400, label: '400 请求错误' },
  { value: 401, label: '401 未授权' },
  { value: 403, label: '403 禁止访问' },
  { value: 404, label: '404 不存在' },
  { value: 409, label: '409 冲突' },
  { value: 422, label: '422 校验失败' },
  { value: 500, label: '500 服务端错误' },
];

/** 慢请求阈值（毫秒） */
export const SLOW_DURATION = 1000;

/**
 * 取标签映射的展示文案
 *
 * @param tags 标签映射
 * @param value 原始取值
 * @returns 中文文案；无映射时回落为原取值，空值返回空串
 */
function tagText(tags: STColumnTag, value?: string | number | null): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  return tags[String(value)]?.text ?? String(value);
}

/**
 * 操作对象 → 展示文案
 *
 * @param value 操作对象取值
 * @returns 中文文案，无映射时回落为原取值
 */
export function nameText(value?: string | null): string {
  return tagText(OPERATE_NAME_TAGS, value);
}

/**
 * 操作类型 → 展示文案
 *
 * @param value 操作类型取值
 * @returns 中文文案，无映射时回落为原取值
 */
export function operateText(value?: string | null): string {
  return tagText(OPERATE_ACTION_TAGS, value);
}

/**
 * 请求状态码 → 展示文案
 *
 * @param value 状态码
 * @returns 中文文案，无映射时回落为状态码本身
 */
export function statusText(value?: number | null): string {
  return tagText(REQ_STATUS_TAGS, value);
}

/**
 * 结果筛选取值 → 接口参数
 *
 * @param value 表单结果取值，`success` / `error` / 未选择
 * @returns true 为成功（2xx）、false 为异常（非 2xx），未选择时为 undefined（不传该条件）
 */
export function resultFilter(value?: string): boolean | undefined {
  if (value === 'success') {
    return true;
  }
  if (value === 'error') {
    return false;
  }
  return undefined;
}

/**
 * 清理查询条件
 *
 * 注：剔除空值，避免空串被后端当成有效条件；用户ID 的 0 是有意义取值（0 表示系统 / 未登录），必须保留，
 * 因此这里只按 `undefined` / `null` / `''` 剔除，不做真值判断
 *
 * @param value 查询条件
 * @returns 仅保留有效取值的查询条件
 */
export function cleanQuery<T extends Record<string, unknown>>(value: T): Partial<T> {
  /** 清理后的查询条件 */
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined || item === null || item === '') {
      continue;
    }
    result[key] = item;
  }
  return result as Partial<T>;
}

/**
 * 是否为慢请求
 *
 * @param duration 请求耗时（毫秒）
 * @param threshold 阈值，缺省 1000 毫秒
 * @returns 超过阈值时为 true
 */
export function isSlow(duration: number, threshold = SLOW_DURATION): boolean {
  return Number(duration) > threshold;
}

/**
 * 格式化用户展示
 *
 * @param record 日志记录，注：后端会补 email，取不到时按 userId 回落
 * @param emptyText 既无邮箱也无用户ID时的文案
 * @returns 用户展示文案
 */
export function userText(
  record: { email?: string | null; userId?: number | null },
  emptyText: string,
): string {
  if (record.email) {
    return record.email;
  }
  return record.userId ? `用户ID${record.userId}` : emptyText;
}

/**
 * 格式化毫秒时间戳
 *
 * @param at 毫秒时间戳
 * @returns 格式化后的时间文案，空值为 `-`
 */
export function timeText(at?: number | null): string {
  return formatDateTime(at) || '-';
}

/**
 * 组装请求日志的接口查询条件
 *
 * @param form 查询表单取值
 * @param pi 页码
 * @param ps 每页条数
 * @returns 接口查询条件
 */
export function buildReqQuery(form: ReqForm, pi: number, ps: number): ReqQuery {
  return {
    userId: form.userId,
    path: form.path,
    controller: form.controller,
    action: form.action,
    status: form.status,
    start: form.start,
    end: form.end,
    success: resultFilter(form.result),
    pi,
    ps,
  };
}

/**
 * 组装操作日志详情字段
 *
 * @param row 操作日志记录
 * @returns 详情字段清单
 */
export function operateDetailItems(row: OperateRow): DetailItem[] {
  return [
    { label: '操作序号', value: `${row.id ?? ''}` },
    { label: '操作对象', value: `${nameText(row.name)}（${row.name ?? ''}）` },
    { label: '操作类型', value: `${operateText(row.operate)}（${row.operate ?? ''}）` },
    { label: '操作用户', value: userText(row, '系统/未登录') },
    { label: '用户ID', value: `${row.userId ?? ''}` },
    { label: '操作备注', value: row.remark || '-' },
    { label: '操作时间', value: timeText(row.at) },
    { label: '时间戳', value: `${row.at ?? ''}` },
  ];
}

/**
 * 组装请求日志详情字段
 *
 * @param row 请求日志记录
 * @returns 详情字段清单
 */
export function reqDetailItems(row: ReqRow): DetailItem[] {
  return [
    { label: '请求ID', value: `${row.reqId ?? ''}` },
    { label: '请求路径', value: `${row.url ?? ''}` },
    { label: '控制器', value: `${row.controller ?? ''}` },
    { label: '方法名', value: `${row.action ?? ''}` },
    { label: '结果', value: statusText(row.status) },
    { label: '请求耗时', value: `${row.duration ?? 0}ms` },
    { label: '请求用户', value: userText(row, '未登录') },
    { label: '用户ID', value: `${row.userId ?? ''}` },
    { label: '客户端IP', value: `${row.clientIp ?? ''}` },
    { label: '服务端IP', value: `${row.serverIp ?? ''}` },
    { label: '请求时间', value: timeText(row.startAt) },
    { label: '响应时间', value: timeText(row.endAt) },
    { label: '请求时间戳', value: `${row.startAt ?? ''}` },
    { label: '响应时间戳', value: `${row.endAt ?? ''}` },
  ];
}
