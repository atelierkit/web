import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import { SHARED_IMPORTS } from '@shared';
import { NzListModule } from 'ng-zorro-antd/list';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';

import { CloudService, type KongSummary } from '../../cloud.service';
import { dbText, editionText } from '../kong.format';

/** 诊断弹窗入参 */
interface KongDiagnoseData {
  /** 站点ID */
  id: number;
}

/** 单路探测结果 */
interface ProbeResult<T> {
  /** 探测数据，注：失败时为 `null` */
  data: T | null;
  /** 失败文案，注：空串表示没失败 */
  error: string;
}

/**
 * KONG 网关诊断组件
 *
 * 注 1：把后端探测到的「网关概览」与「已启用插件」只读展示 ——
 * 概览按表单样式逐项排布，插件清单按列表样式逐行排布
 * 注 2：请求由后端发起（浏览器跨域访问不到网关的 Admin API）
 * 注 3：概览来自网关的 `/` 与 `/status`，社区版也支持；
 * `/default/license/report` 是企业版专属、社区版恒为 404，故不展示
 */
@Component({
  selector: 'cloud-kong-diagnose',
  templateUrl: './diagnose.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS, NzListModule],
})
export class CloudKongDiagnoseComponent implements OnInit {
  private readonly cloudSrv = inject(CloudService);
  private readonly modalRef = inject(NzModalRef);
  /** 弹窗入参 */
  private readonly data = inject<KongDiagnoseData>(NZ_MODAL_DATA);

  /** 是否加载中 */
  readonly loading = signal(true);
  /** 网关概览，注：失败时为 `null` */
  readonly summary = signal<KongSummary | null>(null);
  /** 网关概览的失败文案，注：空串表示没失败 */
  readonly summaryFailed = signal('');
  /** 已启用插件清单，注：失败时为空数组 */
  readonly plugins = signal<string[]>([]);
  /** 插件清单的失败文案，注：空串表示没失败 */
  readonly pluginFailed = signal('');
  /** 版本类型 → 展示文案，注：取值规则在 `kong.format` 里单测 */
  readonly editionOf = editionText;
  /** 数据库可达性 → 展示文案，注：`null` 是不适用（无数据库模式），不是不可达 */
  readonly dbOf = dbText;

  /**
   * 组件初始化，并行拉取两份探测结果
   *
   * 注：两路各自兜错，一路失败不影响另一路展示
   */
  ngOnInit(): void {
    forkJoin({
      summary: this.probe(this.cloudSrv.kongSummary(this.data.id), '获取网关概览失败！'),
      plugins: this.probe(this.cloudSrv.kongPlugin(this.data.id), '获取插件清单失败！'),
    }).subscribe(({ summary, plugins }) => {
      this.summary.set(summary.data);
      this.summaryFailed.set(summary.error);
      this.plugins.set(plugins.data ?? []);
      this.pluginFailed.set(plugins.error);
      this.loading.set(false);
    });
  }

  /** 关闭弹窗 */
  close(): void {
    this.modalRef.close();
  }

  /**
   * 把探测请求包成「成功 / 失败」两种结果
   *
   * @param source 探测请求
   * @param message 失败时的兜底文案
   * @returns 带失败文案的结果流
   */
  private probe<T>(source: Observable<T>, message: string): Observable<ProbeResult<T>> {
    return source.pipe(
      map((data): ProbeResult<T> => ({ data, error: '' })),
      catchError((err: unknown) =>
        of<ProbeResult<T>>({ data: null, error: apiErrorMessage(err, message) }),
      ),
    );
  }
}
