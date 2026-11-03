import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { apiErrorMessage } from '@core';
import { STColumn, STColumnTag, STData } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';

import { CloudKubernetes, CloudService } from '../cloud.service';
import { CloudKubernetesDiagnoseComponent } from './diagnose/diagnose.component';
import { CloudKubernetesEditComponent } from './edit/edit.component';
import { CloudKubernetesLogComponent } from './log/log.component';

/**
 * Kubernetes 集群管理组件
 *
 * 注：这里只管集群本身（增删改查、变更历史、连通性诊断）；集群里的命名空间 / 节点 / Pod /
 * 工作负载 / Service 在 `kubernetes/:id` 下，由「管理」按钮进入
 */
@Component({
  selector: 'cloud-kubernetes',
  templateUrl: './kubernetes.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class CloudKubernetesComponent implements OnInit {
  private readonly cloudSrv = inject(CloudService);
  private readonly modalSrv = inject(NzModalService);
  private readonly msgSrv = inject(NzMessageService);
  private readonly router = inject(Router);

  /** 集群清单 */
  readonly data = signal<CloudKubernetes[]>([]);
  /** 加载标记 */
  readonly loading = signal(true);

  /** 列定义 */
  readonly columns: STColumn[] = [
    { title: 'ID', index: 'id', width: 70 },
    { title: '名称', index: 'name' },
    { title: '说明', index: 'description' },
    { title: '地址', index: 'endpoint' },
    { title: '默认命名空间', index: 'namespace', width: 140 },
    {
      title: 'Token',
      index: 'hasToken',
      width: 90,
      type: 'tag',
      tag: {
        true: { text: '已配置', color: 'green' },
        false: { text: '无', color: 'default' },
      } as STColumnTag,
    },
    {
      title: '客户端证书',
      index: 'hasKey',
      width: 110,
      type: 'tag',
      tag: {
        true: { text: '已配置', color: 'green' },
        false: { text: '无', color: 'default' },
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
          click: (record: STData) => this.manage(record as CloudKubernetes),
        },
        {
          text: '诊断',
          type: 'link',
          click: (record: STData) => this.openDiagnose(record as CloudKubernetes),
        },
        {
          text: '变更历史',
          type: 'link',
          click: (record: STData) => this.openLog(record as CloudKubernetes),
        },
        {
          text: '编辑',
          type: 'link',
          click: (record: STData) => this.open(record as CloudKubernetes),
        },
      ],
    },
  ];

  /** 页面初始化 */
  ngOnInit(): void {
    this.fresh();
  }

  /** 加载集群清单 */
  fresh(): void {
    this.loading.set(true);
    this.cloudSrv.kubernetesList().subscribe({
      next: (rows) => {
        this.data.set(rows);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        // 失败时须复位加载态，否则表格会一直转圈
        this.loading.set(false);
        this.msgSrv.error(apiErrorMessage(err, '加载集群列表失败，请稍后重试！'));
      },
    });
  }

  /**
   * 打开创建 / 编辑弹窗
   *
   * @param record 待编辑的集群，缺省表示新建
   */
  open(record?: CloudKubernetes): void {
    this.modalSrv
      .create<CloudKubernetesEditComponent, { id?: number }, boolean>({
        nzContent: CloudKubernetesEditComponent,
        nzData: { id: record?.id },
        nzTitle: record ? '编辑集群' : '创建集群',
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
   * 进入集群资源管理
   *
   * @param record 集群
   */
  manage(record: CloudKubernetes): void {
    void this.router.navigate(['/cloud/kubernetes', record.id, 'dashboard']);
  }

  /**
   * 打开变更历史弹窗
   *
   * @param record 集群
   */
  openLog(record: CloudKubernetes): void {
    this.modalSrv.create<CloudKubernetesLogComponent, { id: number }, void>({
      nzContent: CloudKubernetesLogComponent,
      nzData: { id: record.id },
      nzTitle: `「${record.name}」的变更历史`,
      nzFooter: null,
      nzWidth: 900,
    });
  }

  /**
   * 打开连通性诊断弹窗
   *
   * @param record 集群
   */
  openDiagnose(record: CloudKubernetes): void {
    this.modalSrv.create<CloudKubernetesDiagnoseComponent, { id: number }, void>({
      nzContent: CloudKubernetesDiagnoseComponent,
      nzData: { id: record.id },
      nzTitle: `「${record.name}」的连通性诊断`,
      nzFooter: null,
      nzWidth: 760,
    });
  }
}
