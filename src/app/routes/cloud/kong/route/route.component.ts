import { ChangeDetectionStrategy, Component, type Type } from '@angular/core';
import type { STColumn } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';
import { map, zip, type Observable } from 'rxjs';

import { KongObjectComponent } from '../object/object.component';
import type { KongObject } from '../object/object.types';
import { KongRouteEditComponent } from './edit/route-edit.component';

/**
 * KONG 路由管理组件
 *
 * 注：Kong 的路由只存服务的 `{ id }`，列表里要显示服务名必须自己拼，故 `load()` 里多查一次服务清单
 */
@Component({
  selector: 'kong-route',
  templateUrl: '../object/object.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class KongRouteComponent extends KongObjectComponent {
  override readonly type = 'routes' as const;
  override readonly name = '路由';

  /** 业务列 */
  protected override businessColumns(): STColumn[] {
    return [
      { title: '名称', index: 'name' },
      { title: '服务', index: 'service_name' },
      {
        title: '域名',
        type: 'widget',
        widget: { type: 'array', params: ({ record }) => ({ value: record['hosts'] }) },
      },
      {
        title: '路径',
        type: 'widget',
        widget: { type: 'array', params: ({ record }) => ({ value: record['paths'] }) },
      },
      {
        title: '协议',
        type: 'widget',
        widget: { type: 'array', params: ({ record }) => ({ value: record['protocols'] }) },
      },
    ];
  }

  /** 编辑弹窗组件 */
  protected override editComponent(): Type<unknown> {
    return KongRouteEditComponent;
  }

  /**
   * 拉取路由清单（补服务名）
   *
   * @returns 路由清单
   */
  protected override load(): Observable<KongObject[]> {
    return zip(
      this.objectSrv.objects(this.kongId, 'routes'),
      this.objectSrv.objects(this.kongId, 'services'),
    ).pipe(
      map(([routes, services]) => {
        /** 服务ID → 服务名 */
        const names = new Map<string, string>();
        for (const item of services) {
          names.set(String(item['id']), String(item['name'] ?? ''));
        }
        return routes.map((item) => {
          /** 路由绑定的服务 */
          const service = item['service'] as { id?: string } | null | undefined;
          return {
            ...item,
            service_name: names.get(String(service?.id ?? '')) ?? '无',
          };
        });
      }),
    );
  }
}
