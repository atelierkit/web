import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { apiErrorMessage } from '@core';
import type { STChange, STColumn, STData, STPage } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';

import { INSTANCE_STATE_TAG, businessError } from '../tencent.format';
import {
  LighthouseInstance,
  TencentRegion,
  TencentService,
  type InstanceAction,
} from '../tencent.service';
import { TencentPasswordComponent, type PasswordData } from './password/password.component';

/**
 * 轻量应用服务器组件
 *
 * 注 1：旧私有项目把地域做成布局里的二级导航（`service-layout`），开源仓库没有那套组件，
 * 这里改成页头右侧的地域下拉；地址仍是 `lighthouse/:region`，切地域等于换地址
 * 注 2：直接访问 `/lighthouse`（没有地域）时，用地域清单的第一项补全地址
 */
@Component({
  selector: 'tencent-lighthouse',
  templateUrl: './lighthouse.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class TencentLighthouseComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tencentSrv = inject(TencentService);
  private readonly modalSrv = inject(NzModalService);
  private readonly msgSrv = inject(NzMessageService);

  /** 密钥ID */
  readonly keyId = Number(this.route.parent?.snapshot.params['id']);
  /** 当前地域 */
  readonly region = signal('');
  /** 地域清单 */
  readonly regions = signal<TencentRegion[]>([]);
  /** 实例清单 */
  readonly data = signal<LighthouseInstance[]>([]);
  /** 加载标记 */
  readonly loading = signal(true);
  /** 当前页码 */
  readonly pi = signal(1);
  /** 每页数量 */
  readonly ps = signal(10);
  /** 总记录数 */
  readonly total = signal(0);

  /** 分页配置 */
  readonly page: STPage = {
    front: false,
    toTopOffset: 0,
    showSize: true,
    pageSizes: [5, 10, 20, 50, 100],
    showQuickJumper: true,
    total: '第{{range[0]}}条至第{{range[1]}}条，共{{total}}条',
  };

  /** 列定义 */
  readonly columns: STColumn[] = [
    { title: '实例ID', index: 'InstanceId', width: 150 },
    { title: '实例名称', index: 'InstanceName', width: 180 },
    {
      title: '状态',
      index: 'InstanceState',
      type: 'tag',
      width: 100,
      tag: INSTANCE_STATE_TAG,
    },
    { title: '公网IP', index: 'IPAddress', width: 140 },
    { title: '端口', index: 'Port', width: 80 },
    { title: 'CPU', index: 'CPU', width: 70 },
    { title: '内存(GB)', index: 'Memory', width: 100 },
    { title: '流量包(GB)', index: 'TrafficQuota', width: 120 },
    { title: '付费模式', index: 'PayMode', width: 110 },
    {
      title: '创建时间',
      index: 'CreatedTime',
      width: 180,
      sort: { compare: (a, b) => String(a['CreatedTime']).localeCompare(String(b['CreatedTime'])) },
    },
    {
      title: '到期时间',
      index: 'ExpireTime',
      width: 180,
      sort: { compare: (a, b) => String(a['ExpireTime']).localeCompare(String(b['ExpireTime'])) },
    },
    {
      title: '操作',
      fixed: 'right',
      width: 340,
      buttons: [
        {
          text: '防火墙',
          type: 'link',
          icon: 'bars',
          click: (record: STData) => this.firewall(record as LighthouseInstance),
        },
        {
          text: '启动',
          icon: 'play-circle',
          className: 'text-success',
          iif: (record: STData) =>
            ['STOPPED', 'SHUTDOWN'].includes(String(record['InstanceState'])),
          pop: '确定启动该实例吗？',
          click: (record: STData) => this.action(record as LighthouseInstance, '启动成功', 'start'),
        },
        {
          text: '停止',
          icon: 'pause-circle',
          className: 'text-warning',
          iif: (record: STData) => record['InstanceState'] === 'RUNNING',
          pop: '确定停止该实例吗？',
          click: (record: STData) => this.action(record as LighthouseInstance, '停止成功', 'stop'),
        },
        {
          text: '重启',
          icon: 'reload',
          iif: (record: STData) => record['InstanceState'] === 'RUNNING',
          pop: '确定重启该实例吗？',
          click: (record: STData) =>
            this.action(record as LighthouseInstance, '重启成功', 'reboot'),
        },
        {
          text: '重置密码',
          icon: 'key',
          click: (record: STData) => this.resetPassword(record as LighthouseInstance),
        },
        {
          text: '删除',
          icon: 'delete',
          type: 'del',
          iif: (record: STData) => record['InstanceState'] !== 'RUNNING',
          pop: '确定删除该实例吗？删除后数据无法恢复！',
          click: (record: STData) =>
            this.action(record as LighthouseInstance, '删除成功', 'delete'),
        },
      ],
    },
  ];

  /** 页面初始化 */
  ngOnInit(): void {
    this.tencentSrv.loadRegions(this.keyId).subscribe({
      next: (rows) => {
        this.regions.set(rows);
        // 没有地域时用第一个补全地址；补全后由下面的路由订阅去取数
        if (!this.region() && rows.length > 0) {
          void this.router.navigate(['/tencent', this.keyId, 'lighthouse', rows[0].Region], {
            replaceUrl: true,
          });
        }
      },
      error: (err: unknown) =>
        this.msgSrv.error(apiErrorMessage(err, '加载地域列表失败，请稍后重试！')),
    });
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      /** 地址里的地域 */
      const region = String(params['region'] ?? '');
      this.region.set(region);
      if (region) {
        this.fresh();
      }
    });
  }

  /**
   * 切换地域
   *
   * @param region 地域
   */
  switchRegion(region: string): void {
    if (!region || region === this.region()) {
      return;
    }
    this.pi.set(1);
    void this.router.navigate(['/tencent', this.keyId, 'lighthouse', region]);
  }

  /** 加载实例清单 */
  fresh(): void {
    if (!this.region()) {
      return;
    }
    this.loading.set(true);
    this.tencentSrv
      .instances(this.keyId, this.region(), (this.pi() - 1) * this.ps(), this.ps())
      .subscribe({
        next: (res) => {
          /** 业务错误 */
          const message = businessError(res);
          if (message) {
            this.loading.set(false);
            this.msgSrv.error(message);
            return;
          }
          this.data.set(res.InstanceSet ?? []);
          this.total.set(res.TotalCount ?? 0);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.msgSrv.error(apiErrorMessage(err, '加载实例列表失败，请稍后重试！'));
        },
      });
  }

  /**
   * 处理分页变化
   *
   * @param e 表格变化事件
   */
  change(e: STChange): void {
    if (e.type === 'pi' || e.type === 'ps') {
      if (e.type === 'pi') {
        this.pi.set(e.pi!);
      }
      if (e.type === 'ps') {
        this.ps.set(e.ps!);
      }
      this.fresh();
    }
  }

  /**
   * 进入实例的防火墙
   *
   * @param record 实例
   */
  firewall(record: LighthouseInstance): void {
    void this.router.navigate([
      '/tencent',
      this.keyId,
      'firewall',
      this.region(),
      record.InstanceId ?? '',
    ]);
  }

  /**
   * 执行实例操作
   *
   * @param record 实例
   * @param text 成功提示
   * @param action 动作
   */
  action(record: LighthouseInstance, text: string, action: InstanceAction): void {
    if (!record.InstanceId) {
      return;
    }
    this.tencentSrv.instanceAction(this.keyId, this.region(), action, record.InstanceId).subscribe({
      next: (res) => {
        /** 业务错误 */
        const message = businessError(res);
        if (message) {
          this.msgSrv.error(message);
          return;
        }
        this.msgSrv.success(`实例${text}`);
        this.fresh();
      },
      error: (err: unknown) => this.msgSrv.error(apiErrorMessage(err, '操作失败，请稍后重试！')),
    });
  }

  /**
   * 重置实例密码
   *
   * @param record 实例
   */
  resetPassword(record: LighthouseInstance): void {
    if (!record.InstanceId) {
      return;
    }
    this.modalSrv
      .create<TencentPasswordComponent, PasswordData, boolean>({
        nzContent: TencentPasswordComponent,
        nzData: {
          keyId: this.keyId,
          region: this.region(),
          instanceId: record.InstanceId,
        },
        nzTitle: '重置实例密码',
        nzFooter: null,
        nzWidth: 520,
      })
      .afterClose.subscribe((saved) => {
        if (saved) {
          this.msgSrv.success('密码重置成功');
        }
      });
  }
}
