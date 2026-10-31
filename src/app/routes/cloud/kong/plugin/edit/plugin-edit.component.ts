import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { SFSchema, SFSchemaEnum, SFUISchema } from '@delon/form';
import { SHARED_IMPORTS } from '@shared';
import { map, type Observable } from 'rxjs';

import { KongObjectEditComponent } from '../../object/edit/object-edit.component';
import type { KongObject, KongObjectType } from '../../object/object.types';

/**
 * KONG 插件编辑弹窗
 *
 * 注 1：只支持 `cors` 与 `redirect` 两类插件的配置表单 —— 其余插件的 config 结构各不相同，
 * 没有通用表单可做（旧私有项目也是只做这两个）
 * 注 2：`cors` / `redirect` 两份子表单按所选插件名互斥显示（`visibleIf`），提交时再按名字收进
 * `config`，见 `payload()`
 */
@Component({
  selector: 'kong-plugin-edit',
  templateUrl: '../../object/edit/object-edit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class KongPluginEditComponent extends KongObjectEditComponent {
  override readonly name = '插件';

  /** 表单 schema */
  override readonly schema: SFSchema = {
    properties: {
      name: {
        type: 'string',
        title: '插件',
        enum: [
          { label: 'redirect（重定向）', value: 'redirect' },
          { label: 'cors（跨域）', value: 'cors' },
        ],
        default: 'redirect',
      },
      protocols: {
        type: 'string',
        title: '协议',
        default: ['http'],
        enum: [
          { label: 'HTTP', value: 'http' },
          { label: 'HTTPS', value: 'https' },
          { label: 'GRPC', value: 'grpc' },
          { label: 'GRPCS', value: 'grpcs' },
        ],
      },
      enabled: { type: 'boolean', title: '状态', default: true },
      route: {
        type: 'object',
        properties: { id: { type: 'string', title: '路由' } },
      },
      service: {
        type: 'object',
        properties: { id: { type: 'string', title: '服务' } },
      },
      consumer: {
        type: 'object',
        properties: { id: { type: 'string', title: '用户' } },
      },
      cors: {
        type: 'object',
        properties: {
          origins: { type: 'string', title: 'origins', default: ['*'] },
          headers: { type: 'string', title: 'headers', default: [] },
          exposed_headers: { type: 'string', title: 'exposed_headers', default: [] },
          methods: {
            type: 'string',
            title: 'methods',
            default: [
              'GET',
              'HEAD',
              'PUT',
              'PATCH',
              'POST',
              'DELETE',
              'OPTIONS',
              'TRACE',
              'CONNECT',
            ],
            enum: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS', 'TRACE', 'CONNECT'],
          },
          max_age: { type: 'number', title: 'max_age', default: 0 },
          credentials: { type: 'boolean', title: 'credentials', default: false },
          private_network: {
            type: 'boolean',
            title: 'private_network',
            default: false,
          },
          preflight_continue: {
            type: 'boolean',
            title: 'preflight_continue',
            default: false,
          },
        },
      },
      redirect: {
        type: 'object',
        properties: {
          location: { type: 'string', title: '重定向地址' },
          status_code: {
            type: 'number',
            title: '状态码',
            enum: [
              { label: '永久重定向（301）', value: 301 },
              { label: '临时重定向（302）', value: 302 },
            ],
          },
          keep_incoming_path: { type: 'boolean', title: '透传路径参数' },
        },
      },
    },
    required: ['name', 'protocols', 'enabled'],
  };

  /** 表单样式 */
  override readonly ui: SFUISchema = {
    '*': { spanLabelFixed: 150, spanLabel: 6, spanControl: 18, grid: { span: 24 } },
    $name: { widget: 'radio', styleType: 'button', buttonStyle: 'solid' },
    $protocols: { widget: 'select', mode: 'multiple' },
    $route: {
      $id: { widget: 'select', asyncData: this.optionsOf('routes', 'name') },
      grid: { span: 24 },
    },
    $service: {
      $id: { widget: 'select', asyncData: this.optionsOf('services', 'name') },
      grid: { span: 24 },
    },
    $consumer: {
      $id: { widget: 'select', asyncData: this.optionsOf('consumers', 'username') },
      grid: { span: 24 },
    },
    $cors: {
      '*': { spanLabelFixed: 200, grid: { span: 12 } },
      visibleIf: { name: ['cors'] },
      $origins: { widget: 'list', optionalHelp: 'Access-Control-Allow-Origin' },
      $headers: { widget: 'list', optionalHelp: 'Access-Control-Allow-Headers' },
      $exposed_headers: {
        widget: 'list',
        optionalHelp: 'Access-Control-Expose-Headers',
      },
      $methods: {
        widget: 'select',
        mode: 'multiple',
        optionalHelp: 'Access-Control-Allow-Methods',
      },
      $max_age: { optionalHelp: '缓存时间，单位秒' },
      $credentials: { optionalHelp: 'Access-Control-Allow-Credentials' },
      $private_network: {
        optionalHelp: 'Access-Control-Allow-Private-Network',
      },
      $preflight_continue: { optionalHelp: '是否把 OPTIONS 预检请求转发给上游' },
    },
    $redirect: {
      '*': { spanLabelFixed: 110, grid: { span: 24 } },
      visibleIf: { name: ['redirect'] },
      $status_code: { widget: 'select' },
      $keep_incoming_path: {
        checkedChildren: '透传',
        unCheckedChildren: '不透传',
      },
    },
  };

  /**
   * 详情 → 表单值
   *
   * 注 1：Kong 把插件配置统一放在 `config` 里，表单按插件名拆成 `cors` / `redirect` 两份子表单
   * 注 2：三个关联字段可能是 `null`，转成 `{ id: '' }` 才能被嵌套表单绑定
   *
   * @param row 详情
   * @returns 表单初值
   */
  protected override normalize(row: KongObject): Record<string, unknown> {
    /** 插件名 */
    const name = String(row['name'] ?? '');
    /** 插件配置 */
    const config = row['config'] as Record<string, unknown> | undefined;
    return {
      ...row,
      route: { id: this.relationId(row['route']) },
      service: { id: this.relationId(row['service']) },
      consumer: { id: this.relationId(row['consumer']) },
      cors: name === 'cors' ? config : undefined,
      redirect: name === 'redirect' ? config : undefined,
    };
  }

  /**
   * 表单值 → 提交数据
   *
   * @param value 表单值
   * @returns 提交给 Kong 的插件数据
   */
  protected override payload(value: Record<string, unknown>): Record<string, unknown> {
    /** 插件名 */
    const name = String(value['name'] ?? '');
    /** 插件配置，注：只取当前插件名对应的那份子表单 */
    const config =
      name === 'cors'
        ? ((value['cors'] as Record<string, unknown> | undefined) ?? {})
        : name === 'redirect'
          ? ((value['redirect'] as Record<string, unknown> | undefined) ?? {})
          : {};
    return this.compact({
      name,
      protocols: value['protocols'],
      enabled: value['enabled'],
      route: this.relationOf(value['route']),
      service: this.relationOf(value['service']),
      consumer: this.relationOf(value['consumer']),
      config,
    });
  }

  /**
   * 构建下拉选项加载器
   *
   * @param type 对象类型
   * @param field 取展示名的字段
   * @returns `asyncData` 需要的工厂
   */
  private optionsOf(type: KongObjectType, field: string): () => Observable<SFSchemaEnum[]> {
    return () =>
      this.objectSrv.objects(this.kongId, type).pipe(
        map((items) => [
          { label: '无', value: '' },
          ...items.map((item) => ({
            label: String(item[field] ?? ''),
            value: String(item['id'] ?? ''),
          })),
        ]),
      );
  }

  /**
   * 取关联对象的 ID
   *
   * @param relation 关联字段
   * @returns 对象ID，未绑定时为空串
   */
  private relationId(relation: unknown): string {
    const id = (relation as { id?: string } | null | undefined)?.id;
    return id ?? '';
  }

  /**
   * 关联对象转为提交形态
   *
   * @param relation 表单里的关联值
   * @returns `{ id }` 或 `null`（Kong 用 `null` 解绑）
   */
  private relationOf(relation: unknown): { id: string } | null {
    /** 对象ID */
    const id = (relation as { id?: string } | null | undefined)?.id;
    return id ? { id } : null;
  }
}
