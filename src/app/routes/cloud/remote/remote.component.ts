import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { apiErrorMessage } from '@core';
import { STColumn, STColumnTag, STData } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';

import { CloudRemote, CloudService } from '../cloud.service';
import { CloudRemoteDiagnoseComponent } from './diagnose/diagnose.component';
import { CloudRemoteEditComponent } from './edit/edit.component';
import { CloudRemoteLogComponent } from './log/log.component';
import { authText, fingerprintText } from './remote.format';

/**
 * 远程主机管理组件
 *
 * 注：这里只管主机本身（增删改查、变更历史、连通性诊断）；终端在 `remote/:id/terminal`，
 * 由「连接」按钮进入
 */
@Component({
  selector: 'cloud-remote',
  templateUrl: './remote.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class CloudRemoteComponent implements OnInit {
  private readonly cloudSrv = inject(CloudService);
  private readonly modalSrv = inject(NzModalService);
  private readonly msgSrv = inject(NzMessageService);
  private readonly router = inject(Router);

  /** 主机清单 */
  readonly data = signal<CloudRemote[]>([]);
  /** 加载标记 */
  readonly loading = signal(true);

  /** 列定义 */
  readonly columns: STColumn[] = [
    { title: 'ID', index: 'id', width: 60 },
    { title: '名称', index: 'name' },
    { title: '说明', index: 'description' },
    // 注：地址与端口合成一列 —— 两列都短，分开摆反而要横向滚动
    {
      title: '地址',
      index: 'host',
      width: 200,
      format: (item: STData) => `${String(item['host'] ?? '')}:${String(item['port'] ?? '')}`,
    },
    { title: '用户', index: 'username', width: 120 },
    {
      title: '鉴权',
      index: 'authType',
      width: 90,
      format: (item: STData) => authText(String(item['authType'] ?? '')),
    },
    {
      title: '主机指纹',
      index: 'fingerprint',
      width: 190,
      format: (item: STData) => fingerprintText(String(item['fingerprint'] ?? '')),
    },
    {
      title: '状态',
      index: 'status',
      width: 90,
      type: 'tag',
      tag: {
        true: { text: '启用', color: 'green' },
        false: { text: '禁用', color: 'red' },
      } as STColumnTag,
    },
    {
      title: '更新时间',
      index: 'update.at',
      width: 170,
      type: 'date',
      dateFormat: 'yyyy-MM-dd HH:mm:ss',
    },
    {
      title: '操作',
      buttons: [
        {
          text: '连接',
          type: 'link',
          click: (record: STData) => this.openTerminal(record as CloudRemote),
        },
        {
          text: '诊断',
          type: 'link',
          click: (record: STData) => this.openDiagnose(record as CloudRemote),
        },
        {
          text: '变更历史',
          type: 'link',
          click: (record: STData) => this.openLog(record as CloudRemote),
        },
        {
          text: '编辑',
          type: 'link',
          click: (record: STData) => this.open(record as CloudRemote),
        },
      ],
    },
  ];

  /** 页面初始化 */
  ngOnInit(): void {
    this.fresh();
  }

  /** 加载主机清单 */
  fresh(): void {
    this.loading.set(true);
    this.cloudSrv.remotes().subscribe({
      next: (rows) => {
        this.data.set(rows);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        // 失败时须复位加载态，否则表格会一直转圈
        this.loading.set(false);
        this.msgSrv.error(apiErrorMessage(err, '加载主机列表失败，请稍后重试！'));
      },
    });
  }

  /**
   * 打开创建 / 编辑弹窗
   *
   * @param record 待编辑的主机，缺省表示新建
   */
  open(record?: CloudRemote): void {
    this.modalSrv
      .create<CloudRemoteEditComponent, { id?: number }, boolean>({
        nzContent: CloudRemoteEditComponent,
        nzData: { id: record?.id },
        nzTitle: record ? '编辑主机' : '创建主机',
        nzFooter: null,
        nzWidth: 760,
      })
      .afterClose.subscribe((saved) => {
        // 仅在保存成功时刷新，取消关闭不动列表
        if (saved) {
          this.fresh();
        }
      });
  }

  /**
   * 进入终端
   *
   * @param record 主机
   */
  openTerminal(record: CloudRemote): void {
    void this.router.navigate(['/cloud/remote', record.id, 'terminal']);
  }

  /**
   * 打开变更历史弹窗
   *
   * @param record 主机
   */
  openLog(record: CloudRemote): void {
    this.modalSrv.create<CloudRemoteLogComponent, { id: number }, void>({
      nzContent: CloudRemoteLogComponent,
      nzData: { id: record.id },
      nzTitle: `「${record.name}」的变更历史`,
      nzFooter: null,
      nzWidth: 860,
    });
  }

  /**
   * 打开连通性诊断弹窗
   *
   * @param record 主机
   */
  openDiagnose(record: CloudRemote): void {
    this.modalSrv.create<CloudRemoteDiagnoseComponent, { id: number }, boolean>({
      nzContent: CloudRemoteDiagnoseComponent,
      nzData: { id: record.id },
      nzTitle: `「${record.name}」的连通性诊断`,
      nzFooter: null,
      nzWidth: 780,
    });
  }
}
