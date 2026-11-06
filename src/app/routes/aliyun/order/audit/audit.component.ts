import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { apiErrorMessage } from '@core';
import type { SFComponent, SFSchema, SFSchemaEnum, SFUISchema } from '@delon/form';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { BehaviorSubject } from 'rxjs';

import { type ContactItem, AliyunService } from '../../aliyun.service';

/** 申请弹窗入参 */
export interface SslAuditData {
  /** 密钥ID */
  keyId: number;
  /** 订单实例ID */
  instanceId: string;
}

/**
 * DV 证书申请组件
 *
 * 注 1：联系人信息可从「联系人」页的备选里选，选中后自动回填 —— 省市要拼音、手机号有格式，
 * 每次手填既慢又易错
 * 注 2：提交成功只代表「资料已提交」，域名验证还要去 DNS 服务商加记录，见「查看状态」
 */
@Component({
  selector: 'aliyun-order-audit',
  templateUrl: './audit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class AliyunOrderAuditComponent implements OnInit {
  private readonly aliyunSrv = inject(AliyunService);
  private readonly msgSrv = inject(NzMessageService);
  private readonly modalRef = inject(NzModalRef);
  /** 弹窗入参 */
  private readonly data = inject<SslAuditData>(NZ_MODAL_DATA);

  /** 表单实例，注：选联系人后要回填 */
  @ViewChild('sf') private readonly sf?: SFComponent;

  /** 表单数据 */
  readonly formData = signal<Record<string, unknown> | null>(null);
  /** 提交中标记 */
  readonly loading = signal(false);
  /** 联系人备选 */
  private contacts: ContactItem[] = [];
  /** 联系人下拉数据，注：异步加载，用 BehaviorSubject 让下拉自己跟上 */
  private readonly contactOptions = new BehaviorSubject<SFSchemaEnum[]>([]);

  /** 表单 schema */
  readonly schema: SFSchema = {
    properties: {
      pick: {
        type: 'string',
        title: '选择联系人',
        description: '从「联系人」页维护的备选里选，选中后自动回填下面的信息',
      },
      InstanceId: { type: 'string', title: '订单实例ID' },
      Domain: {
        type: 'string',
        title: '申请域名',
        description: '单个域名，例如 kong.marbleqi.top',
      },
      DomainVerifyType: {
        type: 'string',
        title: '验证方式',
        default: 'DNS',
        enum: [
          { value: 'DNS', label: 'DNS 验证（推荐）' },
          { value: 'FILE', label: '文件验证' },
        ],
      },
      Username: { type: 'string', title: '申请人姓名' },
      Mobile: { type: 'string', title: '手机号' },
      Email: { type: 'string', title: '邮箱' },
      Province: { type: 'string', title: '省份', description: '拼音，如 zhejiang' },
      City: { type: 'string', title: '城市', description: '拼音，如 hangzhou' },
    },
    required: ['Domain', 'DomainVerifyType', 'Username', 'Mobile', 'Email', 'Province', 'City'],
  };

  /** 表单样式 */
  readonly ui: SFUISchema = {
    '*': { spanLabelFixed: 110, grid: { span: 24 } },
    $pick: {
      widget: 'select',
      placeholder: '选择已保存的联系人（可跳过，直接手填）',
      change: (id: string) => this.fillContact(id),
      asyncData: () => this.contactOptions.asObservable(),
    },
    $InstanceId: { widget: 'text' },
    $Domain: { placeholder: '例如 kong.marbleqi.top' },
    $DomainVerifyType: { widget: 'radio', styleType: 'button', buttonStyle: 'solid' },
    $Mobile: { placeholder: '11 位手机号' },
    $Email: { placeholder: '例如 admin@example.com' },
    $Province: { placeholder: '例如 zhejiang' },
    $City: { placeholder: '例如 hangzhou' },
  };

  /** 页面初始化 */
  ngOnInit(): void {
    this.formData.set({
      InstanceId: this.data.instanceId,
      DomainVerifyType: 'DNS',
    });
    this.loadContacts();
  }

  /** 加载联系人备选，注：停用的不进入下拉 */
  private loadContacts(): void {
    this.aliyunSrv.contacts().subscribe({
      next: (rows) => {
        this.contacts = (rows ?? []).filter((item) => item.status !== false);
        this.contactOptions.next(
          this.contacts.map((item) => ({
            label: item.name || item.username,
            value: String(item.id),
          })),
        );
        // 默认选中：后端标记的默认项，没有就取第一项
        /** 默认联系人 */
        const preset = this.contacts.find((item) => item.isDefault) ?? this.contacts[0];
        if (preset) {
          // 注：sf 此时还没就绪（表单在下一轮渲染才建出来），推迟一帧再回填
          setTimeout(() => this.fillContact(String(preset.id)));
        }
      },
      // 注：没有联系人不是错误，用户可以直接手填
      error: () => undefined,
    });
  }

  /**
   * 把联系人信息回填到表单
   *
   * @param id 联系人ID
   */
  private fillContact(id: string): void {
    /** 联系人 */
    const contact = this.contacts.find((item) => String(item.id) === id);
    if (!contact || !this.sf) {
      return;
    }
    this.sf.setValue('/Username', contact.username);
    this.sf.setValue('/Mobile', contact.phone);
    this.sf.setValue('/Email', contact.email);
    this.sf.setValue('/Province', contact.province);
    this.sf.setValue('/City', contact.city);
  }

  /**
   * 提交申请
   *
   * @param value 表单值
   */
  save(value: Record<string, unknown>): void {
    this.loading.set(true);
    this.aliyunSrv
      .audit(this.data.keyId, {
        InstanceId: this.data.instanceId,
        Domain: String(value['Domain'] ?? '').trim(),
        DomainVerifyType: String(value['DomainVerifyType'] ?? 'DNS'),
        Username: String(value['Username'] ?? ''),
        Mobile: String(value['Mobile'] ?? ''),
        Email: String(value['Email'] ?? ''),
        Province: String(value['Province'] ?? ''),
        City: String(value['City'] ?? ''),
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.msgSrv.success('申请已提交，请到订单页「查看状态」获取 DNS 验证记录');
          this.modalRef.close(true);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.msgSrv.error(apiErrorMessage(err, '申请提交失败，请稍后重试！'));
        },
      });
  }

  /** 关闭弹窗 */
  close(): void {
    this.modalRef.close(false);
  }
}
