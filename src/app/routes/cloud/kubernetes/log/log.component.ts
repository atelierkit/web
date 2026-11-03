import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import { STColumn, STColumnTag, STData } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';

import { CloudKubernetes, CloudService } from '../../cloud.service';

/** 变更历史弹窗入参 */
interface KubernetesLogData {
  /** 集群ID */
  id: number;
}

/**
 * Kubernetes 集群变更历史组件
 *
 * 注：历史表结构与主表一致，每行是一次变更后的快照，按 `update.at` 倒序展示；
 * Token 与私钥在后端已清空，这里只可能看到「有没有配过」
 */
@Component({
  selector: 'cloud-kubernetes-log',
  templateUrl: './log.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class CloudKubernetesLogComponent implements OnInit {
  private readonly cloudSrv = inject(CloudService);
  private readonly modalRef = inject(NzModalRef);
  private readonly msgSrv = inject(NzMessageService);
  /** 弹窗入参 */
  private readonly data = inject<KubernetesLogData>(NZ_MODAL_DATA);

  /** 变更记录 */
  readonly records = signal<CloudKubernetes[]>([]);
  /** 加载标记 */
  readonly loading = signal(true);

  /** 列定义 */
  readonly columns: STColumn[] = [
    { title: '名称', index: 'name' },
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
      title: '操作类型',
      index: 'update.operate',
      width: 100,
      format: (item: STData) =>
        (item['update'] as { operate?: string } | undefined)?.operate === 'create'
          ? '创建'
          : '更新',
    },
    {
      title: '操作时间',
      index: 'update.at',
      width: 170,
      type: 'date',
      dateFormat: 'yyyy-MM-dd HH:mm:ss',
    },
    { title: '操作序号', index: 'update.operateId', width: 100 },
  ];

  /**
   * 组件初始化，加载变更历史
   *
   * 注：历史只读，故没有任何操作按钮
   */
  ngOnInit(): void {
    this.cloudSrv.kubernetesLog(this.data.id).subscribe({
      next: (rows) => {
        // 后台按 id 升序返回，这里倒序展示最近一次变更在最前
        this.records.set([...rows].sort((a, b) => (b.update?.at ?? 0) - (a.update?.at ?? 0)));
        this.loading.set(false);
      },
      error: (err: unknown) => {
        // 失败时须复位加载态，否则表格会一直转圈
        this.loading.set(false);
        this.msgSrv.error(apiErrorMessage(err, '加载变更历史失败，请稍后重试！'));
      },
    });
  }

  /** 关闭弹窗 */
  close(): void {
    this.modalRef.close();
  }
}
