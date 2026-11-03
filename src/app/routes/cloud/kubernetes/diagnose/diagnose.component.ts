import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';

import { CloudService, type KubernetesDiagnose } from '../../cloud.service';
import { authText, protocolText, verifyText } from '../kubernetes.format';

/** 诊断弹窗入参 */
interface KubernetesDiagnoseData {
  /** 集群ID */
  id: number;
}

/**
 * Kubernetes 集群连通性诊断组件
 *
 * 注 1：请求由后端发起（浏览器拿不到集群凭据），这里只展示结果
 * 注 2：风险项（匿名连接 / 明文连接 / 关闭证书校验 / 没配默认命名空间）由后端判定，
 * 前端不重复判断，避免两处口径不一致
 */
@Component({
  selector: 'cloud-kubernetes-diagnose',
  templateUrl: './diagnose.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class CloudKubernetesDiagnoseComponent implements OnInit {
  private readonly cloudSrv = inject(CloudService);
  private readonly modalRef = inject(NzModalRef);
  private readonly msgSrv = inject(NzMessageService);
  /** 弹窗入参 */
  private readonly data = inject<KubernetesDiagnoseData>(NZ_MODAL_DATA);

  /** 加载标记 */
  readonly loading = signal(true);
  /** 诊断结果 */
  readonly result = signal<KubernetesDiagnose | null>(null);
  /** 失败原因，注：空串表示没失败 */
  readonly failed = signal('');
  /** 鉴权方式 → 展示文案 */
  readonly authOf = authText;
  /** 协议 → 展示文案 */
  readonly protocolOf = protocolText;
  /** 校验开关 → 展示文案 */
  readonly verifyOf = verifyText;

  /** 组件初始化 */
  ngOnInit(): void {
    this.cloudSrv.kubernetesDiagnose(this.data.id).subscribe({
      next: (res) => {
        this.result.set(res);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.failed.set(apiErrorMessage(err, '无法连接该集群，请检查地址、防火墙与凭据。'));
        this.msgSrv.error(this.failed());
      },
    });
  }

  /** 关闭弹窗 */
  close(): void {
    this.modalRef.close();
  }
}
