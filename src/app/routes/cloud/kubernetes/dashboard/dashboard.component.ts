import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { apiErrorMessage } from '@core';
import { SHARED_IMPORTS } from '@shared';

import { CloudService, type KubernetesSummary } from '../../cloud.service';
import { bytesText, cpuText } from '../kubernetes.format';

/**
 * Kubernetes 集群仪表板
 *
 * 注 1：数据来自后端的六次探测（版本 / 节点 / 命名空间 / Pod / Deployment / Service），
 * 后端合并成一份概览下发（`cloud/kubernetes/summary/:id`），前端不用发多次请求
 * 注 2：Pod 按运行中 / 等待中 / 失败 / 已完成拆开展示 —— 总数相同但状态分布不同，
 * 运维关注点完全不同
 */
@Component({
  selector: 'kubernetes-dashboard',
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class KubernetesDashboardComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly cloudSrv = inject(CloudService);

  /** 集群ID */
  private readonly kubernetesId = Number(this.route.parent?.snapshot.params['id']);
  /** 概览 */
  readonly summary = signal<KubernetesSummary | null>(null);
  /** 加载标记 */
  readonly loading = signal(true);
  /** 失败原因，注：空串表示没失败 */
  readonly failed = signal('');
  /** 字节格式化，注：纯函数在 `kubernetes.format` 里单测 */
  readonly bytesOf = bytesText;
  /** CPU 核数格式化 */
  readonly cpuOf = cpuText;

  /** 页面初始化 */
  ngOnInit(): void {
    this.fresh();
  }

  /** 数据刷新 */
  fresh(): void {
    this.loading.set(true);
    this.failed.set('');
    this.cloudSrv.kubernetesSummary(this.kubernetesId).subscribe({
      next: (res) => {
        this.summary.set(res);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.summary.set(null);
        this.loading.set(false);
        this.failed.set(
          apiErrorMessage(
            err,
            '无法连接该集群，请检查地址、防火墙与凭据（ServiceAccount 需要 cluster 级 list 权限）。',
          ),
        );
      },
    });
  }
}
