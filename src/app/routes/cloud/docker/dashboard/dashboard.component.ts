import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { apiErrorMessage } from '@core';
import { SHARED_IMPORTS } from '@shared';

import { CloudService, type DockerSummary } from '../../cloud.service';
import { bytesText } from '../docker.format';

/**
 * Docker 宿主机仪表板
 *
 * 注 1：数据来自 daemon 的 `/version` 与 `/info`，后端把两者合并成一份概览下发
 * （`cloud/docker/summary/:id`），前端不用发两次请求
 * 注 2：容器数按运行中 / 暂停 / 已停止拆开展示 —— 总数相同但状态分布不同，运维关注点完全不同
 */
@Component({
  selector: 'docker-dashboard',
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class DockerDashboardComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly cloudSrv = inject(CloudService);

  /** 宿主机ID */
  private readonly dockerId = Number(this.route.parent?.snapshot.params['id']);
  /** 概览 */
  readonly summary = signal<DockerSummary | null>(null);
  /** 加载标记 */
  readonly loading = signal(true);
  /** 失败原因，注：空串表示没失败 */
  readonly failed = signal('');
  /** 字节格式化，注：纯函数在 `docker.format` 里单测 */
  readonly bytesOf = bytesText;

  /** 页面初始化 */
  ngOnInit(): void {
    this.fresh();
  }

  /** 数据刷新 */
  fresh(): void {
    this.loading.set(true);
    this.failed.set('');
    this.cloudSrv.dockerSummary(this.dockerId).subscribe({
      next: (res) => {
        this.summary.set(res);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.summary.set(null);
        this.loading.set(false);
        this.failed.set(
          apiErrorMessage(err, '无法连接该宿主机的 daemon，请检查地址、防火墙与 TLS 配置。'),
        );
      },
    });
  }
}
