import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import { SFSchema, SFUISchema } from '@delon/form';
import { formatDateTime, SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';

import { CloudService, KongPayload } from '../../cloud.service';

/** 站点弹窗入参 */
interface KongEditData {
  /** 站点ID，注：缺省表示新建 */
  id?: number;
}

/**
 * KONG 网关站点编辑组件
 *
 * 注：`url` 必须是能从后端访问到的 Admin API 地址（默认 8001 端口），不是浏览器访问的地址
 */
@Component({
  selector: 'cloud-kong-edit',
  templateUrl: './edit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class CloudKongEditComponent implements OnInit {
  private readonly cloudSrv = inject(CloudService);
  private readonly modalRef = inject(NzModalRef);
  private readonly msgSrv = inject(NzMessageService);
  /** 弹窗入参 */
  private readonly data = inject<KongEditData>(NZ_MODAL_DATA);

  /** 待编辑的站点ID，注：为空表示新建 */
  readonly recordId = this.data?.id;
  /** 是否编辑态 */
  readonly editable = !!this.recordId;
  /** 表单数据，注：为 null 表示详情尚未就绪，SF 模板据此显示加载态 */
  readonly formData = signal<Record<string, unknown> | null>(
    this.editable ? null : { status: true },
  );

  /** 表单 schema */
  readonly schema: SFSchema = {
    properties: {
      name: { type: 'string', title: '名称', maxLength: 50 },
      description: { type: 'string', title: '说明', maxLength: 200 },
      url: { type: 'string', title: '地址', maxLength: 200, format: 'uri' },
      status: { type: 'boolean', title: '状态' },
      // 注：审计字段放在表单末尾做只读展示（对齐旧私有项目），仅在编辑态出现；
      // 它们不属于可提交内容，`save()` 里是显式构造 payload，不会被带出去
      ...(this.editable
        ? {
            createAt: { type: 'string', title: '创建时间' },
            updateAt: { type: 'string', title: '更新时间' },
          }
        : {}),
    },
    required: ['name', 'description', 'url', 'status'],
  };

  /** 表单样式 */
  readonly ui: SFUISchema = {
    '*': { spanLabelFixed: 110, grid: { span: 24 } },
    $name: { placeholder: '便于识别的名称，如「本地网关」' },
    $description: { placeholder: '这个网关做什么用' },
    $url: { placeholder: 'http://192.168.1.10:8001（Admin API 地址）' },
    $status: { checkedChildren: '启用', unCheckedChildren: '禁用' },
    // 注：text 小部件（`sf-text`）只把值当纯文本渲染，天然只读 —— 旧私有项目 `$id` 就是这么做的；
    // 它同时令 `ui._required = false`，所以这两个字段也不会参与必填校验
    $createAt: { widget: 'text' },
    $updateAt: { widget: 'text' },
  };

  /** 页面初始化 */
  ngOnInit(): void {
    if (!this.recordId) {
      return;
    }
    this.cloudSrv.kong(this.recordId).subscribe({
      next: (kong) => {
        this.formData.set({
          name: kong.name,
          description: kong.description,
          url: kong.url,
          status: kong.status,
          // 注：只读项给的是格式化后的文本，SF 只负责展示
          createAt: formatDateTime(kong.create?.at),
          updateAt: formatDateTime(kong.update?.at),
        });
      },
      error: (err: unknown) => {
        // 详情取不到时弹窗无法继续编辑，提示后关闭
        this.msgSrv.error(apiErrorMessage(err, '加载站点详情失败，请稍后重试！'));
        this.close();
      },
    });
  }

  /**
   * 保存站点（新建或更新）
   *
   * @param value SF 表单提交值
   */
  save(value: Record<string, unknown>): void {
    /** 提交信息 */
    const payload: KongPayload = {
      name: String(value['name'] ?? '').trim(),
      description: String(value['description'] ?? '').trim(),
      url: String(value['url'] ?? '').trim(),
      status: value['status'] as boolean,
    };
    if (this.recordId) {
      this.cloudSrv.updateKong(this.recordId, payload).subscribe({
        next: () => this.done('保存成功'),
        error: (err: unknown) =>
          this.msgSrv.error(apiErrorMessage(err, '保存站点失败，请稍后重试！')),
      });
      return;
    }
    this.cloudSrv.createKong(payload).subscribe({
      next: () => this.done('创建成功'),
      error: (err: unknown) =>
        this.msgSrv.error(apiErrorMessage(err, '创建站点失败，请稍后重试！')),
    });
  }

  /** 关闭弹窗 */
  close(): void {
    this.modalRef.close(false);
  }

  /**
   * 保存成功后的收尾
   *
   * @param text 提示文案
   */
  private done(text: string): void {
    this.msgSrv.success(text);
    this.modalRef.close(true);
  }
}
