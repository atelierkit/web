import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import type { STColumn, STData } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';

import { maskEmail, maskPhone } from '../aliyun.format';
import { type ContactItem, AliyunService } from '../aliyun.service';
import { AliyunContactEditComponent } from './edit/edit.component';

/**
 * 申请联系人页
 *
 * 注 1：这些联系人就是申请证书时要手填的那几套信息，存下来供下拉复用
 * 注 2：**不提供删除** —— 通用控制器只有增改查，删除请用「停用」（停用的不进申请下拉），
 * 与云服务密钥一致
 */
@Component({
  selector: 'aliyun-contact',
  templateUrl: './contact.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class AliyunContactComponent implements OnInit {
  private readonly aliyunSrv = inject(AliyunService);
  private readonly modalSrv = inject(NzModalService);
  private readonly msgSrv = inject(NzMessageService);

  /** 联系人清单 */
  readonly data = signal<ContactItem[]>([]);
  /** 加载标记 */
  readonly loading = signal(true);

  /** 列定义 */
  readonly columns: STColumn[] = [
    {
      title: '备注名',
      index: 'name',
      format: (record: STData) => (record['name'] as string) || '-',
    },
    { title: '姓名', index: 'username' },
    {
      title: '手机号',
      index: 'phone',
      format: (record: STData) => maskPhone(record['phone'] as string),
    },
    {
      title: '邮箱',
      index: 'email',
      format: (record: STData) => maskEmail(record['email'] as string),
    },
    { title: '省份', index: 'province' },
    { title: '城市', index: 'city' },
    {
      title: '默认',
      index: 'isDefault',
      type: 'tag',
      width: 90,
      tag: {
        true: { text: '默认', color: 'green' },
        false: { text: '-', color: 'default' },
      },
    },
    {
      title: '状态',
      index: 'status',
      type: 'tag',
      width: 90,
      tag: {
        true: { text: '启用', color: 'green' },
        false: { text: '停用', color: 'red' },
      },
    },
    {
      title: '操作',
      fixed: 'right',
      width: 240,
      buttons: [
        {
          text: '编辑',
          icon: 'edit',
          click: (record: STData) => this.open(record as ContactItem),
        },
        {
          text: '设为默认',
          icon: 'star',
          iif: (record: STData) => record['isDefault'] !== true,
          click: (record: STData) => this.setDefault(record as ContactItem),
        },
        {
          text: '停用',
          icon: 'stop',
          iif: (record: STData) => record['status'] !== false,
          click: (record: STData) => this.toggle(record as ContactItem),
        },
        {
          text: '启用',
          icon: 'check',
          iif: (record: STData) => record['status'] === false,
          click: (record: STData) => this.toggle(record as ContactItem),
        },
      ],
    },
  ];

  /** 页面初始化 */
  ngOnInit(): void {
    this.fresh();
  }

  /** 加载联系人清单 */
  fresh(): void {
    this.loading.set(true);
    this.aliyunSrv.contacts().subscribe({
      next: (rows) => {
        this.data.set(rows ?? []);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.msgSrv.error(apiErrorMessage(err, '加载联系人失败，请稍后重试！'));
      },
    });
  }

  /**
   * 打开新建 / 编辑弹窗
   *
   * @param record 联系人，缺省表示新建
   */
  open(record?: ContactItem): void {
    this.modalSrv
      .create<AliyunContactEditComponent, { contact?: ContactItem }, boolean>({
        nzContent: AliyunContactEditComponent,
        nzData: { contact: record },
        nzTitle: record ? '编辑联系人' : '新增联系人',
        nzFooter: null,
        nzWidth: 640,
      })
      .afterClose.subscribe((saved) => {
        if (saved) {
          this.fresh();
        }
      });
  }

  /**
   * 设为默认
   *
   * @param record 联系人
   */
  setDefault(record: ContactItem): void {
    this.aliyunSrv.updateContact(record.id, { isDefault: true }).subscribe({
      next: () => {
        this.msgSrv.success('已设为默认联系人');
        this.fresh();
      },
      error: (err: unknown) => this.msgSrv.error(apiErrorMessage(err, '设置失败，请稍后重试！')),
    });
  }

  /**
   * 切换启用状态
   *
   * @param record 联系人
   */
  toggle(record: ContactItem): void {
    this.aliyunSrv.updateContact(record.id, { status: record.status === false }).subscribe({
      next: () => {
        this.msgSrv.success(record.status === false ? '已启用' : '已停用');
        this.fresh();
      },
      error: (err: unknown) => this.msgSrv.error(apiErrorMessage(err, '操作失败，请稍后重试！')),
    });
  }
}
