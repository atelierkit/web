import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { cleanQuery } from './admin.format';

/** 对象的创建 / 更新审计信息 */
export interface AdminAudit {
  /** 操作用户ID */
  userId: number;
  /** 操作类型 */
  operate: string;
  /** 操作序号 */
  operateId: number;
  /** 请求日志ID */
  reqId: number;
  /** 操作时间 */
  at: number;
}

/** 系统配置，注：`value` 是各配置自己的 JSON 结构（应用配置 / 备案配置各不相同） */
export interface AdminSetting {
  /** 配置编码，即主键 */
  code: string;
  /** 配置值 */
  value: Record<string, unknown>;
  /** 状态，true表示启用 */
  status: boolean;
  /** 创建信息 */
  create?: Partial<AdminAudit>;
  /** 更新信息 */
  update?: Partial<AdminAudit>;
}

/** 系统配置提交信息 */
export interface SettingPayload {
  /** 配置编码 */
  code: string;
  /** 配置值 */
  value: unknown;
  /** 状态，true表示启用 */
  status: boolean;
}

/** 操作日志查询条件 */
export interface OperateQuery {
  /** 起始时间（毫秒时间戳），缺省为最近 24 小时 */
  start?: number;
  /** 截止时间（毫秒时间戳），缺省为当前时间 */
  end?: number;
  /** 操作用户ID，注：0 表示系统操作 */
  userId?: number;
  /** 操作对象 */
  name?: string;
  /** 操作类型 */
  operate?: string;
  /** 页码 */
  pi?: number;
  /** 每页条数 */
  ps?: number;
}

/** 操作日志记录，注：`email` 由后端按 `userId` 补上，用户已删时为 null */
export interface OperateRow {
  /** 操作序号 */
  id: number;
  /** 操作对象 */
  name: string;
  /** 操作类型 */
  operate: string;
  /** 操作用户ID，0 表示系统 / 未登录 */
  userId: number;
  /** 操作备注 */
  remark: string;
  /** 操作时间（毫秒时间戳） */
  at: number;
  /** 操作用户邮箱 */
  email?: string | null;
}

/** 操作日志字典项 */
export interface OperateOptionItem {
  /** 用户ID */
  value: number;
  /** 展示文案 */
  label: string;
}

/** 操作日志字典 */
export interface OperateOptions {
  /** 操作用户 */
  users: OperateOptionItem[];
  /** 操作对象取值清单 */
  names: string[];
  /** 操作类型取值清单 */
  operates: string[];
}

/** 请求日志查询条件 */
export interface ReqQuery {
  /** 起始时间（毫秒时间戳），缺省为最近 24 小时 */
  start?: number;
  /** 截止时间（毫秒时间戳），缺省为当前时间 */
  end?: number;
  /** 请求用户ID，注：0 表示未登录请求 */
  userId?: number;
  /** 请求路径（不含 query string） */
  path?: string;
  /** 控制器名 */
  controller?: string;
  /** 方法名 */
  action?: string;
  /** 结果筛选：true 为成功（2xx），false 为异常（非 2xx） */
  success?: boolean;
  /** 精确状态码 */
  status?: number;
  /** 页码 */
  pi?: number;
  /** 每页条数 */
  ps?: number;
}

/** 请求日志记录，注：`email` 由后端按 `userId` 补上，未登录时为 null */
export interface ReqRow {
  /** 请求ID */
  reqId: number;
  /** 请求路径 */
  url: string;
  /** 控制器名 */
  controller: string;
  /** 方法名 */
  action: string;
  /** HTTP 状态码 */
  status: number;
  /** 请求耗时（毫秒） */
  duration: number;
  /** 请求用户ID，0 表示未登录 */
  userId: number;
  /** 请求用户邮箱 */
  email?: string | null;
  /** 客户端IP */
  clientIp: string;
  /** 服务端IP */
  serverIp: string;
  /** 请求时间（毫秒时间戳） */
  startAt: number;
  /** 响应时间（毫秒时间戳） */
  endAt: number;
}

/** 分页结果 */
export interface AdminPageResult<T> {
  /** 当前页数据 */
  data: T[];
  /** 满足条件的总记录数 */
  total: number;
}

/**
 * 管理员服务（管理端接口）
 *
 * 注 1：接口前缀统一为 `admin/`（配置 / 操作日志 / 请求日志），全部要求 `admin` 角色，
 * 服务端由 `TokenGuard` 依据 `@Allow('admin')` 校验，前端只负责展示与错误提示
 * 注 2：两个日志接口的查询条件先过 `cleanQuery`，否则后台下拉被清空后留下的空串会被当成「等于空串」的条件
 */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);

  /**
   * 获取配置清单
   *
   * @param operateId 操作序号，注：-1 表示取全量
   * @returns 配置清单
   */
  settings(operateId = -1): Observable<AdminSetting[]> {
    return this.http.get<AdminSetting[]>('admin/setting/index', {
      params: { operateId },
    });
  }

  /**
   * 获取单个配置
   *
   * @param code 配置编码
   * @returns 配置详情，注：未配置时后端回 404，调用方据此转为新建
   */
  setting(code: string): Observable<AdminSetting> {
    return this.http.get<AdminSetting>(`admin/setting/show/${code}`);
  }

  /**
   * 创建配置
   *
   * @param value 配置信息
   * @returns 新配置编码
   */
  createSetting(value: SettingPayload): Observable<unknown> {
    return this.http.post('admin/setting/create', value);
  }

  /**
   * 更新配置
   *
   * @param code 配置编码
   * @param value 配置信息
   * @returns 配置编码
   */
  updateSetting(code: string, value: SettingPayload): Observable<unknown> {
    return this.http.post(`admin/setting/update/${code}`, value);
  }

  /**
   * 按条件分页查询操作日志
   *
   * @param value 查询条件
   * @returns 操作日志清单与总条数
   */
  operates(value: OperateQuery): Observable<AdminPageResult<OperateRow>> {
    return this.http.post<AdminPageResult<OperateRow>>(
      'admin/operate/index',
      cleanQuery(value as Record<string, unknown>),
    );
  }

  /**
   * 获取操作日志字典（操作用户 / 操作对象 / 操作类型）
   *
   * @returns 查询表单的下拉字典
   */
  operateOptions(): Observable<OperateOptions> {
    return this.http.get<OperateOptions>('admin/operate/options');
  }

  /**
   * 按条件分页查询请求日志
   *
   * @param value 查询条件
   * @returns 请求日志清单与总条数
   */
  reqs(value: ReqQuery): Observable<AdminPageResult<ReqRow>> {
    return this.http.post<AdminPageResult<ReqRow>>(
      'admin/req/index',
      cleanQuery(value as Record<string, unknown>),
    );
  }

  /**
   * 获取请求路径字典
   *
   * @returns 请求路径清单
   */
  reqPaths(): Observable<string[]> {
    return this.http.get<string[]>('admin/req/url');
  }

  /**
   * 获取请求用户字典
   *
   * @returns 请求用户清单
   */
  reqUsers(): Observable<OperateOptionItem[]> {
    return this.http.get<OperateOptionItem[]>('admin/req/user');
  }

  /**
   * 获取控制器字典
   *
   * @returns 控制器清单
   */
  reqControllers(): Observable<string[]> {
    return this.http.get<string[]>('admin/req/controller');
  }

  /**
   * 获取指定控制器的方法名字典
   *
   * @param controller 控制器名
   * @returns 方法名清单
   */
  reqActions(controller: string): Observable<string[]> {
    return this.http.get<string[]>(`admin/req/action/${encodeURIComponent(controller)}`);
  }
}
