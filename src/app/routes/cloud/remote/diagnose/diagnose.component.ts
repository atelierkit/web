import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';

import { CloudService, type RemoteDiagnose } from '../../cloud.service';
import { fingerprintText } from '../remote.format';

/** 诊断弹窗入参 */
interface RemoteDiagnoseData {
  /** 主机ID */
  id: number;
}

/**
 * 远程主机连通性诊断组件
 *
 * 注 1：请求由后端发起（浏览器连不到目标机的 22 端口），这里只展示结果
 * 注 2：分五段展示（网络可达 → 握手 → 认证 → 命令执行 → 主机身份），任一段失败即停，
 * 用户一眼能看出卡在哪一步；风险项由后端判定，前端不重复判断
 * 注 3：指纹不一致时给「信任新指纹」按钮 —— 那是唯一的补救路径（改配置里的指纹不算，
 * 否则「指纹已变化」的告警就形同虚设）
 */
@Component({
  selector: 'cloud-remote-diagnose',
  templateUrl: './diagnose.component.html',
  styleUrls: ['./diagnose.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class CloudRemoteDiagnoseComponent implements OnInit {
  private readonly cloudSrv = inject(CloudService);
  private readonly modalRef = inject(NzModalRef);
  private readonly msgSrv = inject(NzMessageService);
  /** 弹窗入参 */
  private readonly data = inject<RemoteDiagnoseData>(NZ_MODAL_DATA);

  /** 加载标记 */
  readonly loading = signal(true);
  /** 诊断结果 */
  readonly result = signal<RemoteDiagnose | null>(null);
  /** 失败原因，注：空串表示没失败 */
  readonly failed = signal('');
  /** 是否正在信任新指纹 */
  readonly trusting = signal(false);
  /** 指纹缩写 */
  readonly shortOf = fingerprintText;

  /** 组件初始化 */
  ngOnInit(): void {
    this.fresh();
  }

  /** 重新诊断 */
  fresh(): void {
    this.loading.set(true);
    this.failed.set('');
    this.cloudSrv.remoteDiagnose(this.data.id).subscribe({
      next: (res) => {
        this.result.set(res);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.failed.set(apiErrorMessage(err, '无法连接该主机，请检查地址、端口、防火墙与凭据。'));
        this.msgSrv.error(this.failed());
      },
    });
  }

  /**
   * 是否展示「信任新指纹」
   *
   * @returns 当前指纹与记录不一致、且取到了当前指纹时为 true
   */
  canTrust(): boolean {
    /** 诊断结果 */
    const data = this.result();
    if (data === null) {
      return false;
    }
    return data.currentFingerprint !== '' && data.currentFingerprint !== data.fingerprint;
  }

  /** 信任当前指纹，并重新诊断确认 */
  trust(): void {
    /** 诊断结果 */
    const data = this.result();
    if (data === null || data.currentFingerprint === '') {
      return;
    }
    this.trusting.set(true);
    this.cloudSrv.trustRemote(this.data.id, data.currentFingerprint).subscribe({
      next: () => {
        this.trusting.set(false);
        this.msgSrv.success('已信任新指纹');
        this.fresh();
      },
      error: (err: unknown) => {
        this.trusting.set(false);
        this.msgSrv.error(apiErrorMessage(err, '信任指纹失败，请稍后重试！'));
      },
    });
  }

  /** 关闭弹窗 */
  close(): void {
    this.modalRef.close();
  }
}
