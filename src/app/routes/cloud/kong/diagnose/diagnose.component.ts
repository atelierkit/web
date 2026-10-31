import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import { SHARED_IMPORTS } from '@shared';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { catchError, forkJoin, of } from 'rxjs';

import { CloudService } from '../../cloud.service';

/** 诊断弹窗入参 */
interface KongDiagnoseData {
  /** 站点ID */
  id: number;
}

/**
 * KONG 网关诊断组件
 *
 * 注：把后端探测到的「许可报告」与「已启用插件」原样展示，只读；
 * 请求由后端发起（浏览器跨域访问不到网关的 Admin API）
 */
@Component({
  selector: 'cloud-kong-diagnose',
  templateUrl: './diagnose.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class CloudKongDiagnoseComponent implements OnInit {
  private readonly cloudSrv = inject(CloudService);
  private readonly modalRef = inject(NzModalRef);
  /** 弹窗入参 */
  private readonly data = inject<KongDiagnoseData>(NZ_MODAL_DATA);

  /** 是否加载中 */
  readonly loading = signal(true);
  /** 许可报告，注：失败时直接放错误文案 */
  readonly report = signal('');
  /** 已启用插件 */
  readonly plugin = signal('');

  /**
   * 组件初始化，并行拉取两份探测结果
   *
   * 注：两路各自兜错，一路失败不影响另一路展示
   */
  ngOnInit(): void {
    forkJoin([
      this.cloudSrv
        .kongReport(this.data.id)
        .pipe(catchError((err: unknown) => of(apiErrorMessage(err, '获取许可报告失败！')))),
      this.cloudSrv
        .kongPlugin(this.data.id)
        .pipe(catchError((err: unknown) => of(apiErrorMessage(err, '获取插件清单失败！')))),
    ]).subscribe({
      next: ([report, plugin]) => {
        this.report.set(this.asText(report));
        this.plugin.set(this.asText(plugin));
        this.loading.set(false);
      },
    });
  }

  /** 关闭弹窗 */
  close(): void {
    this.modalRef.close();
  }

  /**
   * 探测结果转展示文本
   *
   * @param value 探测结果，注：可能是对象，也可能是兜底的错误文案
   * @returns 展示文本
   */
  private asText(value: unknown): string {
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  }
}
