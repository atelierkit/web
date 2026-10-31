import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { apiErrorMessage } from '@core';
import { STColumn, STColumnTag, STData } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';

import { AdminService, AdminSetting } from '../../admin.service';

/** 有专属编辑页的配置编码，注：其余配置只在此处查看，改值要先给它做页面 */
const EDITABLE_CODES = ['app', 'icp'];

/**
 * 配置列表组件
 *
 * 注：配置是按编码聚合的 JSON，各编码的 `value` 结构不同（应用配置是名称/说明、备案是所有者/备案号），
 * 因此列表只做只读展示，改值走各自的编辑页（`/admin/app`、`/admin/icp`）
 */
@Component({
  selector: 'admin-setting-list',
  templateUrl: './list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class AdminSettingListComponent implements OnInit {
  private readonly adminSrv = inject(AdminService);
  private readonly msgSrv = inject(NzMessageService);
  private readonly router = inject(Router);

  /** 配置清单 */
  readonly data = signal<AdminSetting[]>([]);
  /** 加载标记 */
  readonly loading = signal(true);

  /** 列定义 */
  readonly columns: STColumn[] = [
    { title: '键值', index: 'code', width: 160 },
    { title: '名称', index: ['value', 'name'] },
    { title: '描述', index: ['value', 'description'] },
    {
      title: '状态',
      index: 'status',
      width: 100,
      type: 'tag',
      tag: {
        true: { text: '启用', color: 'green' },
        false: { text: '禁用', color: 'red' },
      } as STColumnTag,
    },
    {
      title: '更新时间',
      index: 'update.at',
      width: 180,
      type: 'date',
      dateFormat: 'yyyy-MM-dd HH:mm:ss',
    },
    {
      title: '操作',
      width: 100,
      buttons: [
        {
          text: '编辑',
          type: 'link',
          // 注：没有专属编辑页的编码不显示入口，避免点进去是空白页
          iif: (record: STData) => EDITABLE_CODES.includes(String(record['code'])),
          click: (record: STData) => this.open(record),
        },
      ],
    },
  ];

  /** 页面初始化 */
  ngOnInit(): void {
    this.fresh();
  }

  /** 加载配置清单 */
  fresh(): void {
    this.loading.set(true);
    this.adminSrv.settings().subscribe({
      next: (rows) => {
        this.data.set(rows);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        // 失败时须复位加载态，否则表格会一直转圈
        this.loading.set(false);
        this.msgSrv.error(apiErrorMessage(err, '加载配置列表失败，请稍后重试！'));
      },
    });
  }

  /**
   * 打开配置的编辑页
   *
   * @param record 配置记录
   */
  open(record: STData): void {
    void this.router.navigate(['/admin', String(record['code'])]);
  }
}
