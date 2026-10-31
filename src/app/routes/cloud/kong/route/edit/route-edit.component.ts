import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { SFSchema, SFUISchema } from '@delon/form';
import { SHARED_IMPORTS } from '@shared';
import { map } from 'rxjs';

import { KongObjectEditComponent } from '../../object/edit/object-edit.component';
import type { KongObject } from '../../object/object.types';

/** KONG 路由编辑弹窗 */
@Component({
  selector: 'kong-route-edit',
  templateUrl: '../../object/edit/object-edit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class KongRouteEditComponent extends KongObjectEditComponent {
  override readonly name = '路由';

  /** 表单 schema */
  override readonly schema: SFSchema = {
    properties: {
      name: { type: 'string', title: '名称', maxLength: 200 },
      methods: {
        type: 'string',
        title: '方法',
        enum: [
          'GET',
          'POST',
          'PUT',
          'DELETE',
          'PATCH',
          'HEAD',
          'OPTIONS',
          'CONNECT',
          'TRACE',
          'PURGE',
        ],
      },
      protocols: {
        type: 'string',
        title: '协议',
        // 注：多选控件的初值必须是数组，给字符串会导致新建路由时提交成 `"http"`（Kong 要求数组）
        default: ['http'],
        enum: [
          { label: 'HTTP', value: 'http' },
          { label: 'HTTPS', value: 'https' },
        ],
      },
      path_handling: {
        type: 'string',
        title: '路径处理规则',
        default: 'v0',
        enum: ['v0', 'v1'],
      },
      strip_path: { type: 'boolean', title: '路径去除' },
      preserve_host: { type: 'boolean', title: '域名透传' },
      request_buffering: { type: 'boolean', title: '请求缓冲' },
      response_buffering: { type: 'boolean', title: '响应缓冲' },
      hosts: { type: 'string', title: '域名', min: 1, max: 50 },
      paths: { type: 'string', title: '路径', min: 1, max: 50 },
      service: {
        type: 'object',
        properties: { id: { type: 'string', title: '服务' } },
      },
    },
    required: ['name'],
  };

  /** 表单样式 */
  override readonly ui: SFUISchema = {
    '*': { spanLabelFixed: 110, spanLabel: 6, spanControl: 18, grid: { span: 24 } },
    $methods: { widget: 'select', mode: 'multiple' },
    $protocols: { widget: 'select', mode: 'multiple' },
    $path_handling: { widget: 'select', grid: { span: 12 } },
    $strip_path: { grid: { span: 6 } },
    $preserve_host: { grid: { span: 6 } },
    $request_buffering: { grid: { span: 6 } },
    $response_buffering: { grid: { span: 6 } },
    $hosts: { widget: 'list' },
    $paths: { widget: 'list' },
    $service: {
      $id: {
        widget: 'select',
        asyncData: () =>
          this.objectSrv.objects(this.kongId, 'services').pipe(
            map((items) => [
              { label: '无', value: '' },
              ...items.map((item) => ({
                label: String(item['name'] ?? ''),
                value: String(item['id'] ?? ''),
              })),
            ]),
          ),
      },
      grid: { span: 24 },
    },
  };

  /**
   * 详情 → 表单值
   *
   * 注：路由没绑服务时 Kong 返回 `service: null`，直接交给嵌套表单绑定会取不到 `id`
   *
   * @param row 详情
   * @returns 表单初值
   */
  protected override normalize(row: KongObject): Record<string, unknown> {
    /** 关联服务 */
    const service = row['service'] as { id?: string } | null | undefined;
    return { ...row, service: { id: service?.id ?? '' } };
  }

  /**
   * 表单值 → 提交数据
   *
   * @param value 表单值
   * @returns 提交给 Kong 的路由数据
   */
  protected override payload(value: Record<string, unknown>): Record<string, unknown> {
    /** 关联服务，注：空串表示不绑服务，Kong 用 `null` 解绑 */
    const service = value['service'] as { id?: string } | null | undefined;
    return this.compact({
      name: value['name'],
      methods: value['methods'],
      protocols: value['protocols'],
      path_handling: value['path_handling'],
      strip_path: value['strip_path'],
      preserve_host: value['preserve_host'],
      request_buffering: value['request_buffering'],
      response_buffering: value['response_buffering'],
      hosts: value['hosts'] ?? [],
      paths: value['paths'] ?? [],
      service: service?.id ? { id: service.id } : null,
    });
  }
}
