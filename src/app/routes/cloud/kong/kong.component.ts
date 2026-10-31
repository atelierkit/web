import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { apiErrorMessage } from '@core';
import { STColumn, STColumnTag, STData } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';

import { CloudKong, CloudService } from '../cloud.service';
import { CloudKongDiagnoseComponent } from './diagnose/diagnose.component';
import { CloudKongEditComponent } from './edit/edit.component';
import { CloudKongLogComponent } from './log/log.component';

/**
 * KONG 网关站点管理组件
 *
 * 注：这里只管站点本身（增删改查、变更历史、连通性诊断）；站点下的对象管理
 * （路由 / 服务 / 用户 / 上游 / 证书 / 插件）在 `kong/:id` 下，由「管理」按钮进入
 */
@Component({
  selector: 'cloud-kong',
  templateUrl: './kong.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class CloudKongComponent implements OnInit {
  private readonly cloudSrv = inject(CloudService);
  private readonly modalSrv = inject(NzModalService);
  private readonly msgSrv = inject(NzMessageService);
  private readonly router = inject(Router);

  /** 站点清单 */
  readonly data = signal<CloudKong[]>([]);
  /** 加载标记 */
  readonly loading = signal(true);

  /** 列定义 */
  readonly columns: STColumn[] = [
    { title: 'ID', index: 'id' },
    { title: '名称', index: 'name' },
    { title: '说明', index: 'description' },
    { title: '地址', index: 'url' },
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
          text: '管理',
          type: 'link',
          click: (record: STData) => this.manage(record as CloudKong),
        },
        {
          text: '变更历史',
          type: 'link',
          click: (record: STData) => this.openLog(record as CloudKong),
        },
        {
          text: '诊断',
          type: 'link',
          click: (record: STData) => this.openDiagnose(record as CloudKong),
        },
        {
          text: '编辑',
          type: 'link',
          click: (record: STData) => this.open(record as CloudKong),
        },
      ],
    },
  ];

  /** 页面初始化 */
  ngOnInit(): void {
    this.fresh();
  }

  /** 加载站点清单 */
  fresh(): void {
    this.loading.set(true);
    this.cloudSrv.kongs().subscribe({
      next: (rows) => {
        this.data.set(rows);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        // 失败时须复位加载态，否则表格会一直转圈
        this.loading.set(false);
        this.msgSrv.error(apiErrorMessage(err, '加载网关列表失败，请稍后重试！'));
      },
    });
  }

  /**
   * 打开创建 / 编辑弹窗
   *
   * @param record 待编辑的站点，缺省表示新建
   */
  open(record?: CloudKong): void {
    this.modalSrv
      .create<CloudKongEditComponent, { id?: number }, boolean>({
        nzContent: CloudKongEditComponent,
        nzData: { id: record?.id },
        nzTitle: record ? '编辑站点' : '创建站点',
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

  /**
   * 进入站点对象管理
   *
   * @param record 站点
   */
  manage(record: CloudKong): void {
    void this.router.navigate(['/cloud/kong', record.id, 'dashboard']);
  }

  /**
   * 打开变更历史弹窗
   *
   * @param record 站点
   */
  openLog(record: CloudKong): void {
    this.modalSrv.create<CloudKongLogComponent, { id: number }, void>({
      nzContent: CloudKongLogComponent,
      nzData: { id: record.id },
      nzTitle: `「${record.name}」的变更历史`,
      nzFooter: null,
      nzWidth: 760,
    });
  }

  /**
   * 打开诊断弹窗（许可报告 + 已启用插件）
   *
   * @param record 站点
   */
  openDiagnose(record: CloudKong): void {
    this.modalSrv.create<CloudKongDiagnoseComponent, { id: number }, void>({
      nzContent: CloudKongDiagnoseComponent,
      nzData: { id: record.id },
      nzTitle: `「${record.name}」的诊断`,
      nzFooter: null,
      nzWidth: 760,
    });
  }
}
