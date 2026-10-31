import { ChangeDetectionStrategy, Component, type Type } from '@angular/core';
import type { STColumn, STColumnTag } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';
import { map, zip, type Observable } from 'rxjs';

import { KongObjectComponent } from '../object/object.component';
import type { KongObject } from '../object/object.types';
import { KongPluginEditComponent } from './edit/plugin-edit.component';

/**
 * KONG 插件管理组件
 *
 * 注：插件的 `route` / `service` / `consumer` 都只存 `{ id }`，列表要显示名字得自己拼，
 * 故 `load()` 里一并查三张清单
 */
@Component({
  selector: 'kong-plugin',
  templateUrl: '../object/object.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class KongPluginComponent extends KongObjectComponent {
  override readonly type = 'plugins' as const;
  override readonly name = '插件';

  /** 业务列 */
  protected override businessColumns(): STColumn[] {
    return [
      { title: '名称', index: 'name' },
      {
        title: '协议',
        type: 'widget',
        widget: { type: 'array', params: ({ record }) => ({ value: record['protocols'] }) },
      },
      { title: '路由', index: 'route_name' },
      { title: '服务', index: 'service_name' },
      { title: '用户', index: 'consumer_name' },
      {
        title: '状态',
        index: 'enabled',
        width: 100,
        type: 'tag',
        tag: {
          true: { text: '启用', color: 'green' },
          false: { text: '禁用', color: 'red' },
        } as STColumnTag,
      },
    ];
  }

  /** 编辑弹窗组件 */
  protected override editComponent(): Type<unknown> {
    return KongPluginEditComponent;
  }

  /**
   * 拉取插件清单（补路由 / 服务 / 用户名）
   *
   * @returns 插件清单
   */
  protected override load(): Observable<KongObject[]> {
    return zip(
      this.objectSrv.objects(this.kongId, 'plugins'),
      this.objectSrv.objects(this.kongId, 'routes'),
      this.objectSrv.objects(this.kongId, 'services'),
      this.objectSrv.objects(this.kongId, 'consumers'),
    ).pipe(
      map(([plugins, routes, services, consumers]) => {
        /** 各类型对象的 ID → 展示名 */
        const names = new Map<string, Map<string, string>>();
        names.set('route', this.nameOf(routes, 'name'));
        names.set('service', this.nameOf(services, 'name'));
        // 注：消费者没有必有 name，用用户名兜底
        names.set('consumer', this.nameOf(consumers, 'username'));
        return plugins.map((item) => ({
          ...item,
          route_name: this.lookup(names, 'route', item['route']),
          service_name: this.lookup(names, 'service', item['service']),
          consumer_name: this.lookup(names, 'consumer', item['consumer']),
        }));
      }),
    );
  }

  /**
   * 构建 ID → 名称的映射
   *
   * @param rows 对象清单
   * @param field 取名字段
   * @returns 映射
   */
  private nameOf(rows: readonly KongObject[], field: string): Map<string, string> {
    /** 映射 */
    const map = new Map<string, string>();
    for (const item of rows) {
      map.set(String(item['id']), String(item[field] ?? ''));
    }
    return map;
  }

  /**
   * 查关联对象的名字
   *
   * @param names 各类型的映射表
   * @param type 关联类型
   * @param relation 插件上的关联字段
   * @returns 名字，未绑定时为「无」
   */
  private lookup(names: Map<string, Map<string, string>>, type: string, relation: unknown): string {
    /** 关联对象 */
    const id = (relation as { id?: string } | null | undefined)?.id;
    if (!id) {
      return '无';
    }
    return names.get(type)?.get(id) || '无';
  }
}
