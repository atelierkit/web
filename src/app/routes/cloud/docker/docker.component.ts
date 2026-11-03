import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { apiErrorMessage } from '@core';
import { STColumn, STColumnTag, STData } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';

import { CloudDocker, CloudService } from '../cloud.service';
import { CloudDockerDiagnoseComponent } from './diagnose/diagnose.component';
import { CloudDockerEditComponent } from './edit/edit.component';
import { CloudDockerLogComponent } from './log/log.component';

/**
 * Docker 宿主机管理组件
 *
 * 注：这里只管宿主机本身（增删改查、变更历史、连通性诊断）；宿主机下的容器 / 镜像 /
 * 数据卷 / 网络在 `docker/:id` 下，由「管理」按钮进入
 */
@Component({
  selector: 'cloud-docker',
  templateUrl: './docker.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class CloudDockerComponent implements OnInit {
  private readonly cloudSrv = inject(CloudService);
  private readonly modalSrv = inject(NzModalService);
  private readonly msgSrv = inject(NzMessageService);
  private readonly router = inject(Router);

  /** 宿主机清单 */
  readonly data = signal<CloudDocker[]>([]);
  /** 加载标记 */
  readonly loading = signal(true);

  /** 列定义 */
  readonly columns: STColumn[] = [
    { title: 'ID', index: 'id', width: 70 },
    { title: '名称', index: 'name' },
    { title: '说明', index: 'description' },
    { title: '地址', index: 'endpoint' },
    {
      title: 'TLS',
      index: 'tls',
      width: 90,
      type: 'tag',
      tag: {
        true: { text: '启用', color: 'green' },
        false: { text: '关闭', color: 'default' },
      } as STColumnTag,
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
      title: '创建时间',
      index: 'create.at',
      width: 170,
      type: 'date',
      dateFormat: 'yyyy-MM-dd HH:mm:ss',
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
          text: '管理',
          type: 'link',
          click: (record: STData) => this.manage(record as CloudDocker),
        },
        {
          text: '诊断',
          type: 'link',
          click: (record: STData) => this.openDiagnose(record as CloudDocker),
        },
        {
          text: '变更历史',
          type: 'link',
          click: (record: STData) => this.openLog(record as CloudDocker),
        },
        {
          text: '编辑',
          type: 'link',
          click: (record: STData) => this.open(record as CloudDocker),
        },
      ],
    },
  ];

  /** 页面初始化 */
  ngOnInit(): void {
    this.fresh();
  }

  /** 加载宿主机清单 */
  fresh(): void {
    this.loading.set(true);
    this.cloudSrv.dockers().subscribe({
      next: (rows) => {
        this.data.set(rows);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        // 失败时须复位加载态，否则表格会一直转圈
        this.loading.set(false);
        this.msgSrv.error(apiErrorMessage(err, '加载宿主机列表失败，请稍后重试！'));
      },
    });
  }

  /**
   * 打开创建 / 编辑弹窗
   *
   * @param record 待编辑的宿主机，缺省表示新建
   */
  open(record?: CloudDocker): void {
    this.modalSrv
      .create<CloudDockerEditComponent, { id?: number }, boolean>({
        nzContent: CloudDockerEditComponent,
        nzData: { id: record?.id },
        nzTitle: record ? '编辑宿主机' : '创建宿主机',
        nzFooter: null,
        nzWidth: 720,
      })
      .afterClose.subscribe((saved) => {
        // 仅在保存成功时刷新，取消关闭不动列表
        if (saved) {
          this.fresh();
        }
      });
  }

  /**
   * 进入宿主机资源管理
   *
   * @param record 宿主机
   */
  manage(record: CloudDocker): void {
    void this.router.navigate(['/cloud/docker', record.id, 'dashboard']);
  }

  /**
   * 打开变更历史弹窗
   *
   * @param record 宿主机
   */
  openLog(record: CloudDocker): void {
    this.modalSrv.create<CloudDockerLogComponent, { id: number }, void>({
      nzContent: CloudDockerLogComponent,
      nzData: { id: record.id },
      nzTitle: `「${record.name}」的变更历史`,
      nzFooter: null,
      nzWidth: 820,
    });
  }

  /**
   * 打开连通性诊断弹窗
   *
   * @param record 宿主机
   */
  openDiagnose(record: CloudDocker): void {
    this.modalSrv.create<CloudDockerDiagnoseComponent, { id: number }, void>({
      nzContent: CloudDockerDiagnoseComponent,
      nzData: { id: record.id },
      nzTitle: `「${record.name}」的连通性诊断`,
      nzFooter: null,
      nzWidth: 760,
    });
  }
}
