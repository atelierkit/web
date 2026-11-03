import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import type {
  DockerAction,
  DockerActionOptions,
  DockerObject,
  DockerObjectType,
} from './object.types';

/**
 * Docker 宿主机下的资源服务
 *
 * 注 1：与 KONG 的对象服务刻意不同 —— Docker 的各资源不是同构 REST，写操作走
 * `action` 一个端点，动作名由后端白名单映射成固定的方法与路径，前端无法指定路径
 * 注 2：全部走 POST + 请求体 —— 资源类型、资源 ID 与动作参数都要随请求走，塞 URL 不合适
 * 注 3：接口前缀与宿主机控制器同为 `cloud/docker`，资源类接口在 `cloud/docker/object/` 下
 */
@Injectable({ providedIn: 'root' })
export class DockerObjectService {
  private readonly http = inject(HttpClient);

  /**
   * 获取资源清单
   *
   * @param dockerId 宿主机ID
   * @param type 资源类型
   * @returns 资源清单
   */
  objects<T extends DockerObject = DockerObject>(
    dockerId: number,
    type: DockerObjectType,
  ): Observable<T[]> {
    return this.http.post<T[]>('cloud/docker/object/index', {
      dockerId,
      type,
    });
  }

  /**
   * 获取资源详情
   *
   * @param dockerId 宿主机ID
   * @param type 资源类型
   * @param id 资源ID
   * @returns 资源详情
   */
  object<T extends DockerObject = DockerObject>(
    dockerId: number,
    type: DockerObjectType,
    id: string,
  ): Observable<T> {
    return this.http.post<T>('cloud/docker/object/show', {
      dockerId,
      type,
      id,
    });
  }

  /**
   * 执行资源动作
   *
   * @param dockerId 宿主机ID
   * @param type 资源类型
   * @param id 资源ID
   * @param action 动作
   * @param options 动作参数
   */
  action(
    dockerId: number,
    type: DockerObjectType,
    id: string,
    action: DockerAction,
    options: DockerActionOptions = {},
  ): Observable<void> {
    return this.http.post<void>('cloud/docker/object/action', {
      dockerId,
      type,
      id,
      action,
      force: options.force,
      timeout: options.timeout,
    });
  }
}
