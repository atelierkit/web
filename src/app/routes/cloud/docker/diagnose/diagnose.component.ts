import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';

import { CloudService, type DockerDiagnose } from '../../cloud.service';
import { protocolText, verifyText } from '../docker.format';

/** 诊断弹窗入参 */
interface DockerDiagnoseData {
  /** 宿主机ID */
  id: number;
}

/**
 * Docker 宿主机连通性诊断组件
 *
 * 注 1：请求由后端发起（浏览器跨域访问不到 daemon），这里只展示结果
 * 注 2：风险项（明文连接 / 关闭证书校验 / API 版本不一致）由后端判定，前端不重复判断，
 * 避免两处口径不一致
 */
@Component({
  selector: 'cloud-docker-diagnose',
  templateUrl: './diagnose.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class CloudDockerDiagnoseComponent implements OnInit {
  private readonly cloudSrv = inject(CloudService);
  private readonly modalRef = inject(NzModalRef);
  private readonly msgSrv = inject(NzMessageService);
  /** 弹窗入参 */
  private readonly data = inject<DockerDiagnoseData>(NZ_MODAL_DATA);

  /** 加载标记 */
  readonly loading = signal(true);
  /** 诊断结果 */
  readonly result = signal<DockerDiagnose | null>(null);
  /** 失败原因，注：空串表示没失败 */
  readonly failed = signal('');
  /** 协议 → 展示文案 */
  readonly protocolOf = protocolText;
  /** 校验开关 → 展示文案 */
  readonly verifyOf = verifyText;

  /** 组件初始化 */
  ngOnInit(): void {
    this.cloudSrv.dockerDiagnose(this.data.id).subscribe({
      next: (res) => {
        this.result.set(res);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.failed.set(
          apiErrorMessage(err, '无法连接该宿主机的 daemon，请检查地址、防火墙与 TLS 配置。'),
        );
        this.msgSrv.error(this.failed());
      },
    });
  }

  /** 关闭弹窗 */
  close(): void {
    this.modalRef.close();
  }
}
