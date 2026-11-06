import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import type { SFSchema, SFUISchema } from '@delon/form';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';

import { type ContactItem, AliyunService } from '../../aliyun.service';

/** 编辑弹窗入参 */
export interface ContactEditData {
  /** 联系人，缺省表示新建 */
  contact?: ContactItem;
}

/** 联系人表单组件，注：新建与编辑共用一个表单，按是否带 `contact` 区分 */
@Component({
  selector: 'aliyun-contact-edit',
  templateUrl: './edit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class AliyunContactEditComponent implements OnInit {
  private readonly aliyunSrv = inject(AliyunService);
  private readonly msgSrv = inject(NzMessageService);
  private readonly modalRef = inject(NzModalRef);
  /** 弹窗入参 */
  private readonly data = inject<ContactEditData>(NZ_MODAL_DATA);

  /** 表单数据 */
  readonly formData = signal<Record<string, unknown> | null>(null);
  /** 提交中标记 */
  readonly loading = signal(false);

  /** 表单 schema */
  readonly schema: SFSchema = {
    properties: {
      name: {
        type: 'string',
        title: '备注名',
        description: '便于区分，如「个人」「公司」',
        maxLength: 32,
      },
      username: { type: 'string', title: '姓名', maxLength: 64 },
      phone: { type: 'string', title: '手机号', pattern: '^1[3-9][0-9]{9}$' },
      email: { type: 'string', title: '邮箱', format: 'email' },
      province: {
        type: 'string',
        title: '省份',
        description: '拼音，如 zhejiang',
      },
      city: { type: 'string', title: '城市', description: '拼音，如 hangzhou' },
      isDefault: {
        type: 'boolean',
        title: '设为默认',
        description: '同一时间只有一个默认项，申请时会被预选',
      },
      status: { type: 'boolean', title: '启用', default: true },
    },
    required: ['username', 'phone', 'email', 'province', 'city'],
  };

  /** 表单样式 */
  readonly ui: SFUISchema = {
    '*': { spanLabelFixed: 100, grid: { span: 24 } },
    $name: { placeholder: '例如：个人' },
    $phone: { placeholder: '11 位手机号' },
    $email: { placeholder: '例如 admin@example.com' },
    $province: { placeholder: '例如 zhejiang' },
    $city: { placeholder: '例如 hangzhou' },
    $isDefault: { widget: 'switch' },
    $status: { widget: 'switch' },
  };

  /** 页面初始化 */
  ngOnInit(): void {
    /** 待编辑的联系人 */
    const contact = this.data.contact;
    this.formData.set(
      contact
        ? {
            name: contact.name,
            username: contact.username,
            phone: contact.phone,
            email: contact.email,
            province: contact.province,
            city: contact.city,
            isDefault: contact.isDefault,
            status: contact.status !== false,
          }
        : { status: true, isDefault: false },
    );
  }

  /**
   * 提交表单
   *
   * @param value 表单值
   */
  save(value: Record<string, unknown>): void {
    /** 联系人信息 */
    const payload = {
      name: String(value['name'] ?? ''),
      username: String(value['username'] ?? ''),
      email: String(value['email'] ?? ''),
      phone: String(value['phone'] ?? ''),
      province: String(value['province'] ?? ''),
      city: String(value['city'] ?? ''),
      isDefault: value['isDefault'] === true,
      status: value['status'] !== false,
    };
    /** 待编辑的联系人 */
    const contact = this.data.contact;
    this.loading.set(true);
    /** 请求 */
    const request = contact
      ? this.aliyunSrv.updateContact(contact.id, payload)
      : this.aliyunSrv.createContact(payload);
    request.subscribe({
      next: () => {
        this.loading.set(false);
        this.msgSrv.success(contact ? '联系人已更新' : '联系人已创建');
        this.modalRef.close(true);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.msgSrv.error(apiErrorMessage(err, '保存失败，请稍后重试！'));
      },
    });
  }

  /** 关闭弹窗 */
  close(): void {
    this.modalRef.close(false);
  }
}
