import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import { STColumn, STColumnTag, STData } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';

import { CloudKey, CloudService } from '../cloud.service';
import { CloudKeyEditComponent } from './edit/edit.component';

/**
 * 密钥管理组件
 *
 * 提供云服务商访问密钥的清单展示与创建 / 编辑入口；密钥 Secret 不出库，
 * 清单与详情都只有访问密钥 ID（`key`）
 */
@Component({
  selector: 'cloud-key',
  templateUrl: './key.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class CloudKeyComponent implements OnInit {
  private readonly cloudSrv = inject(CloudService);
  private readonly modalSrv = inject(NzModalService);
  private readonly msgSrv = inject(NzMessageService);

  /** 密钥清单 */
  readonly data = signal<CloudKey[]>([]);
  /** 加载标记 */
  readonly loading = signal(true);

  /** 列定义 */
  readonly columns: STColumn[] = [
    { title: 'ID', index: 'id' },
    { title: '名称', index: 'name' },
    { title: '说明', index: 'description' },
    {
      title: '服务商',
      index: 'provider',
      type: 'tag',
      tag: {
        tencent: { text: '腾讯云', color: 'blue' },
        aliyun: { text: '阿里云', color: 'orange' },
        aws: { text: '亚马逊', color: 'geekblue' },
      } as STColumnTag,
    },
    { title: 'key', index: 'key' },
    {
      title: '状态',
      index: 'status',
      type: 'tag',
      tag: {
        true: { text: '启用', color: 'green' },
        false: { text: '禁用', color: 'red' },
      } as STColumnTag,
    },
    { title: '创建时间', index: 'create.at', type: 'date', dateFormat: 'yyyy-MM-dd HH:mm:ss' },
    { title: '更新时间', index: 'update.at', type: 'date', dateFormat: 'yyyy-MM-dd HH:mm:ss' },
    {
      title: '操作',
      buttons: [
        {
          text: '编辑',
          type: 'link',
          click: (record: STData) => this.open(record as CloudKey),
        },
      ],
    },
  ];

  /** 页面初始化 */
  ngOnInit(): void {
    this.fresh();
  }

  /** 加载密钥清单 */
  fresh(): void {
    this.loading.set(true);
    this.cloudSrv.keys().subscribe({
      next: (rows) => {
        this.data.set(rows);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        // 失败时须复位加载态，否则表格会一直转圈
        this.loading.set(false);
        this.msgSrv.error(apiErrorMessage(err, '加载密钥列表失败，请稍后重试！'));
      },
    });
  }

  /**
   * 打开创建 / 编辑弹窗
   *
   * @param record 待编辑的密钥，缺省表示新建
   */
  open(record?: CloudKey): void {
    this.modalSrv
      .create<CloudKeyEditComponent, { id?: number }, boolean>({
        nzContent: CloudKeyEditComponent,
        nzData: { id: record?.id },
        nzTitle: record ? '编辑密钥' : '创建密钥',
        nzFooter: null,
        nzWidth: 640,
      })
      .afterClose.subscribe((saved) => {
        // 仅在保存成功时刷新，取消关闭不动列表
        if (saved) {
          this.fresh();
        }
      });
  }
}
