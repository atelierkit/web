import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { SFSchema, SFUISchema } from '@delon/form';
import { SHARED_IMPORTS } from '@shared';

import { KongObjectEditComponent } from '../../object/edit/object-edit.component';
import type { KongObject } from '../../object/object.types';

/** KONG 服务编辑弹窗 */
@Component({
  selector: 'kong-service-edit',
  templateUrl: '../../object/edit/object-edit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class KongServiceEditComponent extends KongObjectEditComponent {
  override readonly name = '服务';

  /** 表单 schema */
  override readonly schema: SFSchema = {
    properties: {
      name: { type: 'string', title: '名称', maxLength: 200 },
      url: {
        type: 'string',
        title: '地址',
        description: '协议://主机:端口/路径，如 http://192.168.1.10:8080/api',
      },
      connect_timeout: { type: 'number', title: '连接超时', minimum: 1 },
      read_timeout: { type: 'number', title: '读超时', minimum: 1 },
      write_timeout: { type: 'number', title: '写超时', minimum: 1 },
      retries: { type: 'number', title: '重试次数', minimum: 0 },
      enabled: { type: 'boolean', title: '启用' },
    },
    required: ['name', 'url'],
  };

  /** 表单样式 */
  override readonly ui: SFUISchema = {
    '*': { spanLabelFixed: 100, spanLabel: 6, spanControl: 18, grid: { span: 12 } },
    $url: { grid: { span: 24 } },
    $connect_timeout: { grid: { span: 6 } },
    $read_timeout: { grid: { span: 6 } },
    $write_timeout: { grid: { span: 6 } },
    $retries: { grid: { span: 6 } },
  };

  /**
   * 详情 → 表单值
   *
   * 注：Kong 的 `url` 只是写入用的简写字段，读回来的是拆开的 `protocol` / `host` / `port` / `path`，
   * 这里拼回一个完整地址给表单（与旧私有项目一致）
   *
   * @param row 详情
   * @returns 表单初值
   */
  protected override normalize(row: KongObject): Record<string, unknown> {
    return {
      ...row,
      url: `${String(row['protocol'])}://${String(row['host'])}:${String(row['port'])}${String(row['path'] ?? '')}`,
    };
  }

  /**
   * 表单值 → 提交数据
   *
   * @param value 表单值
   * @returns 提交给 Kong 的服务数据
   */
  protected override payload(value: Record<string, unknown>): Record<string, unknown> {
    return this.compact({
      name: value['name'],
      url: value['url'],
      connect_timeout: value['connect_timeout'],
      read_timeout: value['read_timeout'],
      write_timeout: value['write_timeout'],
      // 注：表单里有「重试次数」，旧私有项目的 params() 漏了它（改了不生效），这里补上
      retries: value['retries'],
      enabled: value['enabled'],
    });
  }
}
