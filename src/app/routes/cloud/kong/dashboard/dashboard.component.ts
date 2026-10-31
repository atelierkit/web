import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { apiErrorMessage } from '@core';
import { G2BarModule } from '@delon/chart/bar';
import { SHARED_IMPORTS } from '@shared';
import { map } from 'rxjs';

import { CloudService } from '../../cloud.service';

/**
 * Kong 许可报告（`/default/license/report`）
 *
 * 注：只声明页面真正用到的字段 —— 正文由 Kong 决定，字段随版本变化，其余部分忽略
 */
interface KongReport {
  /** Kong 版本 */
  kong_version?: string;
  /** 数据库版本 */
  db_version?: string;
  /** 部署信息 */
  deployment_info?: { type?: string };
  /** 系统信息 */
  system_info?: { hostname?: string; cores?: number; uname?: string };
  /** 许可信息，注：开源版没有这一段 */
  license?: { license_key?: string; license_expiration_date?: string };
  /** 工作区数量 */
  workspaces_count?: number;
  /** 服务数量 */
  services_count?: number;
  /** 路由数量 */
  routes_count?: number;
  /** 用户数量 */
  consumers_count?: number;
  /** 计数器 */
  counters?: {
    /** 请求总数 */
    total_requests?: number;
    /** 分时段统计 */
    buckets?: Array<{ request_count?: number; bucket?: string }>;
  };
}

/**
 * KONG 网关仪表板
 *
 * 注：数据来自 Kong 的 `/default/license/report`，**企业版专属**；开源版会 404，
 * 此时按「不支持」提示，而不是当成加载失败吓人一跳
 */
@Component({
  selector: 'kong-dashboard',
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS, G2BarModule],
})
export class KongDashboardComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly cloudSrv = inject(CloudService);

  /** 站点ID */
  private readonly kongId = Number(this.route.parent?.snapshot.params['id']);
  /** 许可报告 */
  readonly report = signal<KongReport | null>(null);
  /** 加载标记 */
  readonly loading = signal(true);
  /** 失败原因，注：空串表示没失败 */
  readonly failed = signal('');
  /** 分时段请求量 */
  readonly chartData = signal<Array<{ x: string; y: number }>>([]);
  /** 柱状图颜色 */
  readonly barColor = '#1890ff';

  /** 页面初始化 */
  ngOnInit(): void {
    this.fresh();
  }

  /** 数据刷新 */
  fresh(): void {
    this.loading.set(true);
    this.failed.set('');
    this.cloudSrv
      .kongReport(this.kongId)
      .pipe(map((res) => res as KongReport))
      .subscribe({
        next: (res) => {
          this.report.set(res);
          // 注：按统计区间升序，Kong 返回的顺序不保证
          this.chartData.set(
            [...(res.counters?.buckets ?? [])]
              .sort((a, b) => String(a.bucket).localeCompare(String(b.bucket)))
              .map((item) => ({
                x: String(item.bucket ?? ''),
                y: Number(item.request_count ?? 0),
              })),
          );
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          /** 后端/Kong 给出的原因 */
          const reason = apiErrorMessage(err, '');
          // 注：开源版 Kong 没有这个接口，404 时要把「不是出故障」这件事说清楚
          this.failed.set(
            reason
              ? `当前无法获取许可报告（Kong 开源版没有该接口，本节仅企业版可用）：${reason}`
              : '当前网关未提供许可报告接口（Kong 开源版不支持），该页仅企业版可用。',
          );
        },
      });
  }
}
