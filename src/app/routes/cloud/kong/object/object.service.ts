import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import type { KongObject, KongObjectType } from './object.types';

/**
 * KONG 站点下的对象服务
 *
 * 注 1：Kong 各对象在 Admin API 上是同一套 REST 形状，故一个服务管全部类型，与后端
 * `ObjectService` 对称；对象数据整份透传，前端不建模字段
 * 注 2：全部走 POST + 请求体 —— 对象类型、对象 ID 与对象数据都要随请求走，塞 URL 不合适
 * 注 3：接口前缀与站点控制器同为 `cloud/kong`，对象类接口在 `cloud/kong/object/` 下
 */
@Injectable({ providedIn: 'root' })
export class KongObjectService {
  private readonly http = inject(HttpClient);

  /**
   * 获取对象清单
   *
   * 注：后端会翻完所有分页，这里拿到的就是全量
   *
   * @param kongId 站点ID
   * @param type 对象类型
   * @returns 对象清单
   */
  objects<T extends KongObject = KongObject>(
    kongId: number,
    type: KongObjectType,
  ): Observable<T[]> {
    return this.http.post<T[]>('cloud/kong/object/index', { kongId, type });
  }

  /**
   * 获取对象详情
   *
   * @param kongId 站点ID
   * @param type 对象类型
   * @param id 对象ID
   * @returns 对象详情
   */
  object<T extends KongObject = KongObject>(
    kongId: number,
    type: KongObjectType,
    id: string,
  ): Observable<T> {
    return this.http.post<T>('cloud/kong/object/show', { kongId, type, id });
  }

  /**
   * 创建对象
   *
   * @param kongId 站点ID
   * @param type 对象类型
   * @param value 对象数据
   * @returns 创建结果
   */
  create(
    kongId: number,
    type: KongObjectType,
    value: Record<string, unknown>,
  ): Observable<KongObject> {
    return this.http.post<KongObject>('cloud/kong/object/create', {
      kongId,
      type,
      value,
    });
  }

  /**
   * 更新对象
   *
   * @param kongId 站点ID
   * @param type 对象类型
   * @param id 对象ID
   * @param value 对象数据，注：Kong 用 PATCH，未提交的字段保持原值
   * @returns 更新结果
   */
  update(
    kongId: number,
    type: KongObjectType,
    id: string,
    value: Record<string, unknown>,
  ): Observable<KongObject> {
    return this.http.post<KongObject>('cloud/kong/object/update', {
      kongId,
      type,
      id,
      value,
    });
  }

  /**
   * 删除对象
   *
   * @param kongId 站点ID
   * @param type 对象类型
   * @param id 对象ID
   */
  destroy(kongId: number, type: KongObjectType, id: string): Observable<void> {
    return this.http.post<void>('cloud/kong/object/destroy', {
      kongId,
      type,
      id,
    });
  }
}
