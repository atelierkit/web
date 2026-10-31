import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import { SFSchema, SFUISchema } from '@delon/form';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';

import { CloudProvider, CloudService, KeyPayload } from '../../cloud.service';

/** 密钥弹窗入参 */
interface KeyEditData {
  /** 密钥ID，注：缺省表示新建 */
  id?: number;
}

/** 服务商下拉项，注：SF 的 enum 要求 { label, value } 结构 */
interface ProviderOption {
  /** 展示文案 */
  label: string;
  /** 服务商标识 */
  value: CloudProvider;
}

/** 服务商下拉项，注：与后端 KEY_PROVIDERS 保持一致 */
const PROVIDER_OPTIONS: ProviderOption[] = [
  { label: '腾讯云', value: 'tencent' },
  { label: '阿里云', value: 'aliyun' },
  { label: '亚马逊', value: 'aws' },
];

/**
 * 密钥编辑组件
 *
 * 注：详情接口不下发 secret，故编辑态不回填、留空即不修改；
 * 新建态必须填 secret，否则后端 `KeyCreateDto` 会拒
 */
@Component({
  selector: 'cloud-key-edit',
  templateUrl: './edit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class CloudKeyEditComponent implements OnInit {
  private readonly cloudSrv = inject(CloudService);
  private readonly modalRef = inject(NzModalRef);
  private readonly msgSrv = inject(NzMessageService);
  /** 弹窗入参 */
  private readonly data = inject<KeyEditData>(NZ_MODAL_DATA);

  /** 待编辑的密钥ID，注：为空表示新建 */
  readonly recordId = this.data?.id;
  /** 是否编辑态 */
  readonly editable = !!this.recordId;
  /** 表单数据，注：为 null 表示详情尚未就绪，SF 模板据此显示加载态 */
  readonly formData = signal<Record<string, unknown> | null>(
    this.editable ? null : { provider: 'tencent', status: true },
  );

  /** 表单 schema */
  readonly schema: SFSchema = {
    properties: {
      name: { type: 'string', title: '名称', maxLength: 50 },
      description: { type: 'string', title: '说明', maxLength: 200 },
      provider: {
        type: 'string',
        title: '服务商',
        enum: PROVIDER_OPTIONS,
        default: 'tencent',
      },
      key: { type: 'string', title: 'key', maxLength: 200 },
      secret: {
        type: 'string',
        title: 'secret',
        maxLength: 200,
        // 注：@delon/form 22 无独立 password widget，用 string widget 的 type 属性渲染密码框
        ui: { type: 'password' },
      },
      status: { type: 'boolean', title: '状态' },
      // 注：审计字段放在表单末尾做只读展示（对齐旧私有项目），仅在编辑态出现；
      // 它们不属于可提交内容，`save()` 里是显式构造 payload，不会被带出去
      ...(this.editable
        ? {
            // 注：值仍是后端原样的毫秒时间戳，格式化交给 `at` 小部件（shared/json-schema/at）
            createAt: { type: 'number', title: '创建时间' },
            updateAt: { type: 'number', title: '更新时间' },
          }
        : {}),
    },
    // 注：必填项与后端 DTO 对齐 —— 编辑态不提交 secret（留空即不改），故不设为必填
    required: this.editable
      ? ['name', 'description', 'provider', 'key', 'status']
      : ['name', 'description', 'provider', 'key', 'secret', 'status'],
  };

  /** 表单样式 */
  readonly ui: SFUISchema = {
    '*': { spanLabelFixed: 110, grid: { span: 24 } },
    $name: { placeholder: '便于识别的名称，如「腾讯云主账号」' },
    $description: { placeholder: '这把密钥用来做什么' },
    $provider: { widget: 'radio', styleType: 'button', buttonStyle: 'solid' },
    $key: { placeholder: '访问密钥 ID（AccessKeyId / AK）' },
    $secret: {
      placeholder: this.editable ? '留空表示不修改当前 secret' : '访问密钥 Secret',
    },
    $status: { checkedChildren: '启用', unCheckedChildren: '禁用' },
    // 注：text 小部件（`sf-text`）只把值当纯文本渲染，天然只读 —— 旧私有项目 `$id` 就是这么做的；
    // 它同时令 `ui._required = false`，所以这两个字段也不会参与必填校验
    $createAt: { widget: 'at' },
    $updateAt: { widget: 'at' },
  };

  /** 页面初始化 */
  ngOnInit(): void {
    if (!this.recordId) {
      return;
    }
    this.cloudSrv.key(this.recordId).subscribe({
      next: (key) => {
        this.formData.set({
          name: key.name,
          description: key.description,
          provider: key.provider,
          key: key.key,
          status: key.status,
          // 注：只读项给的是格式化后的文本，SF 只负责展示
          createAt: key.create?.at ?? null,
          updateAt: key.update?.at ?? null,
        });
      },
      error: (err: unknown) => {
        // 详情取不到时弹窗无法继续编辑，提示后关闭
        this.msgSrv.error(apiErrorMessage(err, '加载密钥详情失败，请稍后重试！'));
        this.close();
      },
    });
  }

  /**
   * 保存密钥（新建或更新）
   *
   * @param value SF 表单提交值
   */
  save(value: Record<string, unknown>): void {
    /** 提交信息 */
    const payload: KeyPayload = {
      name: String(value['name'] ?? '').trim(),
      description: String(value['description'] ?? '').trim(),
      provider: value['provider'] as CloudProvider,
      key: String(value['key'] ?? '').trim(),
      status: value['status'] as boolean,
    };
    /** 本次填写的 secret，注：编辑态留空表示保持原值，故不带这个字段 */
    const secret = String(value['secret'] ?? '').trim();
    if (secret !== '') {
      payload.secret = secret;
    }
    if (this.recordId) {
      this.cloudSrv.updateKey(this.recordId, payload).subscribe({
        next: () => this.done('保存成功'),
        error: (err: unknown) =>
          this.msgSrv.error(apiErrorMessage(err, '保存密钥失败，请稍后重试！')),
      });
      return;
    }
    this.cloudSrv.createKey(payload).subscribe({
      next: () => this.done('创建成功'),
      error: (err: unknown) =>
        this.msgSrv.error(apiErrorMessage(err, '创建密钥失败，请稍后重试！')),
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
