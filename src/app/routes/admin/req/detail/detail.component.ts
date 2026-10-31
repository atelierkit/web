import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SHARED_IMPORTS } from '@shared';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';

import type { DetailItem } from '../../admin.format';

/** 详情弹窗入参 */
interface ReqDetailData {
  /** 详情字段清单 */
  items: DetailItem[];
}

/**
 * 请求日志详情组件
 *
 * 以弹窗形式展示单条请求日志的全部字段
 */
@Component({
  selector: 'admin-req-detail',
  templateUrl: './detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS, NzDescriptionsModule],
})
export class AdminReqDetailComponent {
  private readonly modalRef = inject(NzModalRef);

  /** 详情字段，注：由弹窗参数注入 */
  readonly items = inject<ReqDetailData>(NZ_MODAL_DATA).items ?? [];

  /** 关闭详情弹窗 */
  close(): void {
    this.modalRef.close(false);
  }
}
