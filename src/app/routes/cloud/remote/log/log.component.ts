import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import { STColumn, STColumnTag, STData } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';

import { CloudRemote, CloudService } from '../../cloud.service';
import { authText, fingerprintText } from '../remote.format';

/** 变更历史弹窗入参 */
interface RemoteLogData {
  /** 主机ID */
  id: number;
}

/**
 * 远程主机变更历史组件
 *
 * 注：历史表结构与主表一致，每行是一次变更后的快照，按 `update.at` 倒序展示；
 * 凭据在后端已清空，这里只可能看到「有没有配过」
 */
@Component({
  selector: 'cloud-remote-log',
  templateUrl: './log.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class CloudRemoteLogComponent implements OnInit {
  private readonly cloudSrv = inject(CloudService);
  private readonly modalRef = inject(NzModalRef);
  private readonly msgSrv = inject(NzMessageService);
  /** 弹窗入参 */
  private readonly data = inject<RemoteLogData>(NZ_MODAL_DATA);

  /** 变更记录 */
  readonly records = signal<CloudRemote[]>([]);
  /** 加载标记 */
  readonly loading = signal(true);

  /** 列定义 */
  readonly columns: STColumn[] = [
    { title: '名称', index: 'name' },
    {
      title: '地址',
      index: 'host',
      width: 180,
      format: (item: STData) => `${String(item['host'] ?? '')}:${String(item['port'] ?? '')}`,
    },
    { title: '用户', index: 'username', width: 120 },
    {
      title: '鉴权',
      index: 'authType',
      width: 80,
      format: (item: STData) => authText(String(item['authType'] ?? '')),
    },
    {
      title: '密码',
      index: 'hasPassword',
      width: 90,
      type: 'tag',
      tag: {
        true: { text: '已配置', color: 'green' },
        false: { text: '无', color: 'default' },
      } as STColumnTag,
    },
    {
      title: '私钥',
      index: 'hasKey',
      width: 90,
      type: 'tag',
      tag: {
        true: { text: '已配置', color: 'green' },
        false: { text: '无', color: 'default' },
      } as STColumnTag,
    },
    {
      title: '指纹',
      index: 'fingerprint',
      width: 180,
      format: (item: STData) => fingerprintText(String(item['fingerprint'] ?? '')),
    },
    {
      title: '状态',
      index: 'status',
      width: 80,
      type: 'tag',
      tag: {
        true: { text: '启用', color: 'green' },
        false: { text: '禁用', color: 'red' },
      } as STColumnTag,
    },
    {
      title: '操作类型',
      index: 'update.operate',
      width: 100,
      format: (item: STData) =>
        (item['update'] as { operate?: string } | undefined)?.operate === 'create'
          ? '创建'
          : '更新',
    },
    {
      title: '操作时间',
      index: 'update.at',
      width: 170,
      type: 'date',
      dateFormat: 'yyyy-MM-dd HH:mm:ss',
    },
  ];

  /**
   * 组件初始化，加载变更历史
   *
   * 注：历史只读，故没有任何操作按钮
   */
  ngOnInit(): void {
    this.cloudSrv.remoteLog(this.data.id).subscribe({
      next: (rows) => {
        // 后台按 id 升序返回，这里倒序展示最近一次变更在最前
        this.records.set([...rows].sort((a, b) => (b.update?.at ?? 0) - (a.update?.at ?? 0)));
        this.loading.set(false);
      },
      error: (err: unknown) => {
        // 失败时须复位加载态，否则表格会一直转圈
        this.loading.set(false);
        this.msgSrv.error(apiErrorMessage(err, '加载变更历史失败，请稍后重试！'));
      },
    });
  }

  /** 关闭弹窗 */
  close(): void {
    this.modalRef.close();
  }
}
