import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { apiErrorMessage } from '@core';
import { SHARED_IMPORTS } from '@shared';

import { CloudService, type KongSummary } from '../../cloud.service';
import { dbText, editionText } from '../kong.format';

/**
 * KONG 网关仪表板
 *
 * 注 1：数据来自网关的 `/`（版本、插件清单）与 `/status`（连接数、数据库可达性），
 * 后端把两者合并成一份概览下发（`cloud/kong/summary/:id`），前端不用发两次请求
 * 注 2：旧私有项目读的是 `/default/license/report`，那是**企业版专属**接口，
 * 社区版恒为 404（本机 Kong 3.9.4 社区版实测）⇒ 已整页改写，不再依赖许可报告
 */
@Component({
  selector: 'kong-dashboard',
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class KongDashboardComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly cloudSrv = inject(CloudService);

  /** 站点ID */
  private readonly kongId = Number(this.route.parent?.snapshot.params['id']);
  /** 网关概览 */
  readonly summary = signal<KongSummary | null>(null);
  /** 加载标记 */
  readonly loading = signal(true);
  /** 失败原因，注：空串表示没失败 */
  readonly failed = signal('');
  /** 版本类型 → 展示文案，注：取值规则在 `kong.format` 里单测 */
  readonly editionOf = editionText;
  /** 数据库可达性 → 展示文案，注：`null` 是不适用（无数据库模式），不是不可达 */
  readonly dbOf = dbText;

  /** 页面初始化 */
  ngOnInit(): void {
    this.fresh();
  }

  /** 数据刷新 */
  fresh(): void {
    this.loading.set(true);
    this.failed.set('');
    this.cloudSrv.kongSummary(this.kongId).subscribe({
      next: (res) => {
        this.summary.set(res);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.summary.set(null);
        this.loading.set(false);
        this.failed.set(
          apiErrorMessage(err, '无法连接网关的 Admin API，请检查站点地址与网关状态。'),
        );
      },
    });
  }
}
