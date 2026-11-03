import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import type {
  KubernetesAction,
  KubernetesActionOptions,
  KubernetesObject,
  KubernetesObjectType,
} from './object.types';

/**
 * 集群下的资源服务
 *
 * 注 1：写操作走 `action` 一个端点，动作名由后端白名单映射成固定的方法与路径，
 * 前端无法指定路径（与 Docker 的对象服务同一安全模型）
 * 注 2：全部走 POST + 请求体 —— 资源类型、命名空间、资源名与动作参数都要随请求走
 * 注 3：接口前缀与集群控制器同为 `cloud/kubernetes`，资源类接口在 `cloud/kubernetes/object/` 下
 */
@Injectable({ providedIn: 'root' })
export class KubernetesObjectService {
  private readonly http = inject(HttpClient);

  /**
   * 获取资源清单
   *
   * @param kubernetesId 集群ID
   * @param type 资源类型
   * @param namespace 命名空间，注：空串表示全部命名空间（集群级资源忽略）
   * @returns 资源清单
   */
  objects<T extends KubernetesObject = KubernetesObject>(
    kubernetesId: number,
    type: KubernetesObjectType,
    namespace = '',
  ): Observable<T[]> {
    return this.http.post<T[]>('cloud/kubernetes/object/index', {
      kubernetesId,
      type,
      namespace,
    });
  }

  /**
   * 获取资源详情
   *
   * @param kubernetesId 集群ID
   * @param type 资源类型
   * @param id 资源名
   * @param namespace 命名空间
   * @returns 资源详情
   */
  object<T extends KubernetesObject = KubernetesObject>(
    kubernetesId: number,
    type: KubernetesObjectType,
    id: string,
    namespace = '',
  ): Observable<T> {
    return this.http.post<T>('cloud/kubernetes/object/show', {
      kubernetesId,
      type,
      id,
      namespace,
    });
  }

  /**
   * 执行资源动作
   *
   * @param kubernetesId 集群ID
   * @param type 资源类型
   * @param id 资源名
   * @param action 动作
   * @param options 动作参数
   * @param namespace 命名空间
   */
  action(
    kubernetesId: number,
    type: KubernetesObjectType,
    id: string,
    action: KubernetesAction,
    options: KubernetesActionOptions = {},
    namespace = '',
  ): Observable<void> {
    return this.http.post<void>('cloud/kubernetes/object/action', {
      kubernetesId,
      type,
      id,
      action,
      namespace,
      replicas: options.replicas,
      gracePeriod: options.gracePeriod,
    });
  }
}
