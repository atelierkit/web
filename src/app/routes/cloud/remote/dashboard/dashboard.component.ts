import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { apiErrorMessage } from '@core';
import { SHARED_IMPORTS } from '@shared';

import { CloudService, type RemoteSummary } from '../../cloud.service';
import { bytesText, uptimeText, usagePercent } from '../remote.format';

/**
 * 远程主机概览
 *
 * 注 1：数据来自后端一次 `exec` 的复合命令输出（`cloud/remote/summary/:id`），前端只做展示
 * 注 2：内存与磁盘按「已用 / 总量」画进度条 —— 只看总量没有意义
 */
@Component({
  selector: 'remote-dashboard',
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class RemoteDashboardComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly cloudSrv = inject(CloudService);

  /** 主机ID */
  private readonly remoteId = Number(this.route.parent?.snapshot.params['id']);
  /** 概览 */
  readonly summary = signal<RemoteSummary | null>(null);
  /** 加载标记 */
  readonly loading = signal(true);
  /** 失败原因，注：空串表示没失败 */
  readonly failed = signal('');

  /** 字节格式化 */
  readonly bytesOf = bytesText;
  /** 时长格式化 */
  readonly uptimeOf = uptimeText;
  /** 使用率 */
  readonly percentOf = usagePercent;

  /** 页面初始化 */
  ngOnInit(): void {
    this.fresh();
  }

  /** 数据刷新 */
  fresh(): void {
    this.loading.set(true);
    this.failed.set('');
    this.cloudSrv.remoteSummary(this.remoteId).subscribe({
      next: (res) => {
        this.summary.set(res);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.failed.set(apiErrorMessage(err, '无法连接该主机，请检查地址、端口与凭据。'));
      },
    });
  }

  /**
   * 内存使用率
   *
   * @returns 百分比整数
   */
  memoryPercent(): number {
    /** 概览 */
    const data = this.summary();
    return data === null ? 0 : usagePercent(data.memoryTotal, data.memoryAvailable);
  }

  /**
   * 内存已用量
   *
   * @returns 字节数
   */
  memoryUsed(): number {
    /** 概览 */
    const data = this.summary();
    return data === null ? 0 : Math.max(0, data.memoryTotal - data.memoryAvailable);
  }
}
