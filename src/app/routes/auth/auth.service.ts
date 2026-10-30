import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/** 对象的创建 / 更新审计信息 */
export interface AuthAudit {
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

/** 角色 */
export interface AuthRole {
  /** 角色标识 */
  id: string;
  /** 名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 排序号 */
  sort: number;
  /** 状态，true表示启用 */
  status: boolean;
  /** 更新信息 */
  update?: Partial<AuthAudit>;
}

/** 角色提交信息 */
export interface RolePayload {
  /** 角色标识 */
  id: string;
  /** 名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 状态，true表示启用 */
  status: boolean;
}

/** 角色排序项 */
export interface RoleSortItem {
  /** 角色标识 */
  id: string;
  /** 排序号 */
  sort: number;
}

/** 用户 */
export interface AuthUser {
  /** 用户ID */
  id: number;
  /** 登录用户名 */
  username: string;
  /** 昵称 */
  name: string;
  /** 头像URL */
  avatar: string;
  /** 电子邮箱，注：可选资料，未填写时为 null */
  email: string | null;
  /** 状态，true表示启用 */
  status: boolean;
  /** 授权角色 */
  roles: string[];
  /** 更新信息 */
  update?: Partial<AuthAudit>;
}

/** 用户创建信息 */
export interface UserCreatePayload {
  /** 登录用户名 */
  username: string;
  /** 登录密码（明文提交，服务端负责哈希） */
  password: string;
  /** 昵称 */
  name?: string;
  /** 头像URL */
  avatar?: string;
  /** 电子邮箱 */
  email?: string;
  /** 状态，true表示启用 */
  status?: boolean;
  /** 授权角色 */
  roles?: string[];
}

/** 用户修改信息，注：管理端不含改密，改密走用户自己的设置页或邮箱重置 */
export interface UserUpdatePayload {
  /** 昵称 */
  name?: string;
  /** 头像URL */
  avatar?: string;
  /** 电子邮箱，注：空串表示清空 */
  email?: string;
  /** 状态，true表示启用 */
  status?: boolean;
  /** 授权角色 */
  roles?: string[];
}

/** 令牌，注：后端存储在 Redis 哈希里，字段值一律为字符串 */
export interface AuthToken {
  /** 用户ID */
  id: string;
  /** 令牌随机码 */
  code: string;
  /** 有效期（分钟），0 表示长期有效 */
  valid: string;
  /** 过期时间戳（毫秒），0 表示长期有效 */
  expired: string;
  /** 创建时间戳（毫秒） */
  createAt: string;
  /** 更新时间戳（毫秒） */
  updateAt: string;
}

/**
 * 访问控制服务（管理端接口）
 *
 * 注：所有接口都要求管理员角色，服务端由 `TokenGuard` 依据 `@Allow('admin')` 校验；
 * 前端只负责展示与错误提示，不做权限判定
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  /**
   * 获取角色清单
   *
   * @returns 角色清单
   */
  roles(): Observable<AuthRole[]> {
    return this.http.get<AuthRole[]>('auth/role/index');
  }

  /**
   * 获取角色详情
   *
   * @param id 角色标识
   * @returns 角色详情
   */
  role(id: string): Observable<AuthRole> {
    return this.http.get<AuthRole>(`auth/role/show/${id}`);
  }

  /**
   * 创建角色
   *
   * @param value 角色信息
   * @returns 新角色标识
   */
  createRole(value: RolePayload): Observable<unknown> {
    return this.http.post('auth/role/create', value);
  }

  /**
   * 更新角色
   *
   * @param id 角色标识
   * @param value 角色信息
   * @returns 角色标识
   */
  updateRole(id: string, value: RolePayload): Observable<unknown> {
    return this.http.post(`auth/role/update/${id}`, value);
  }

  /**
   * 保存角色排序
   *
   * @param values 排序后的角色清单
   * @returns 处理结果
   */
  sortRoles(values: RoleSortItem[]): Observable<unknown> {
    return this.http.post('auth/role/sort', values);
  }

  /**
   * 获取用户清单
   *
   * @param operateId 操作序号，注：-1 表示取全量
   * @returns 用户清单
   */
  users(operateId = -1): Observable<AuthUser[]> {
    return this.http.get<AuthUser[]>('auth/user/index', { params: { operateId } });
  }

  /**
   * 获取用户详情
   *
   * @param id 用户ID
   * @returns 用户详情
   */
  user(id: number): Observable<AuthUser> {
    return this.http.get<AuthUser>(`auth/user/show/${id}`);
  }

  /**
   * 创建用户
   *
   * @param value 用户信息（含登录用户名与密码）
   * @returns 新用户ID
   */
  createUser(value: UserCreatePayload): Observable<unknown> {
    return this.http.post('auth/user/create', value);
  }

  /**
   * 更新用户资料与权限
   *
   * @param id 用户ID
   * @param value 用户信息
   * @returns 用户ID
   */
  updateUser(id: number, value: UserUpdatePayload): Observable<unknown> {
    return this.http.post(`auth/user/update/${id}`, value);
  }

  /**
   * 获取令牌清单
   *
   * @returns 令牌清单
   */
  tokens(): Observable<AuthToken[]> {
    return this.http.get<AuthToken[]>('auth/token/index');
  }

  /**
   * 作废令牌
   *
   * @param token 待作废的令牌
   * @returns 作废令牌数
   */
  destroyToken(token: AuthToken): Observable<unknown> {
    return this.http.delete(`auth/token/${token.id}:${token.code}`);
  }
}
