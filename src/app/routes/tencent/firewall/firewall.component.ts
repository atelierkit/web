import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { apiErrorMessage } from '@core';
import type { STChange, STColumn, STData, STPage } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';

import { FIREWALL_ACTION_TAG, businessError, rulePayload } from '../tencent.format';
import { FirewallRule, TencentService } from '../tencent.service';
import { TencentFirewallEditComponent, type FirewallEditData } from './edit/edit.component';

/**
 * 防火墙规则组件
 *
 * 注：轻量服务器的防火墙按「地域 + 实例」操作，两个参数都从地址里取
 */
@Component({
  selector: 'tencent-firewall',
  templateUrl: './firewall.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class TencentFirewallComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly tencentSrv = inject(TencentService);
  private readonly modalSrv = inject(NzModalService);
  private readonly msgSrv = inject(NzMessageService);

  /** 密钥ID */
  readonly keyId = Number(this.route.parent?.snapshot.params['id']);
  /** 地域 */
  readonly region = String(this.route.snapshot.params['region'] ?? '');
  /** 实例ID */
  readonly instanceId = String(this.route.snapshot.params['instance'] ?? '');
  /** 规则清单 */
  readonly data = signal<FirewallRule[]>([]);
  /** 加载标记 */
  readonly loading = signal(true);
  /** 当前页码 */
  readonly pi = signal(1);
  /** 每页数量 */
  readonly ps = signal(20);
  /** 总记录数 */
  readonly total = signal(0);

  /** 分页配置 */
  readonly page: STPage = {
    front: false,
    toTopOffset: 0,
    showSize: true,
    pageSizes: [10, 20, 50, 100],
    showQuickJumper: true,
    total: '第{{range[0]}}条至第{{range[1]}}条，共{{total}}条',
  };

  /** 列定义 */
  readonly columns: STColumn[] = [
    {
      title: '处理',
      index: 'Action',
      type: 'tag',
      width: 100,
      tag: FIREWALL_ACTION_TAG,
    },
    { title: '协议', index: 'Protocol', width: 100 },
    { title: '端口', index: 'Port', width: 130 },
    { title: '应用类型', index: 'AppType', width: 120 },
    { title: 'IPV4 来源', index: 'CidrBlock', width: 160 },
    { title: 'IPV6 来源', index: 'Ipv6CidrBlock', width: 160 },
    { title: '备注', index: 'FirewallRuleDescription' },
    {
      title: '操作',
      fixed: 'right',
      width: 150,
      buttons: [
        {
          text: '编辑',
          icon: 'edit',
          click: (record: STData) => this.edit(record as FirewallRule),
        },
        {
          text: '删除',
          icon: 'delete',
          type: 'del',
          pop: '确定删除该规则吗？',
          click: (record: STData) => this.remove(record as FirewallRule),
        },
      ],
    },
  ];

  /** 页面初始化 */
  ngOnInit(): void {
    this.fresh();
  }

  /** 加载规则清单 */
  fresh(): void {
    this.loading.set(true);
    this.tencentSrv
      .firewallList(
        this.keyId,
        this.region,
        this.instanceId,
        (this.pi() - 1) * this.ps(),
        this.ps(),
      )
      .subscribe({
        next: (res) => {
          /** 业务错误 */
          const message = businessError(res);
          if (message) {
            this.loading.set(false);
            this.msgSrv.error(message);
            return;
          }
          this.data.set(res.FirewallRuleSet ?? []);
          this.total.set(res.TotalCount ?? 0);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.msgSrv.error(apiErrorMessage(err, '加载防火墙规则失败，请稍后重试！'));
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

  /** 新增规则 */
  add(): void {
    this.open();
  }

  /**
   * 编辑规则
   *
   * @param record 规则
   */
  edit(record: FirewallRule): void {
    this.open(record);
  }

  /**
   * 打开规则弹窗
   *
   * @param rule 待编辑的规则，缺省表示新增
   */
  private open(rule?: FirewallRule): void {
    this.modalSrv
      .create<TencentFirewallEditComponent, FirewallEditData, boolean>({
        nzContent: TencentFirewallEditComponent,
        nzData: {
          keyId: this.keyId,
          region: this.region,
          instanceId: this.instanceId,
          rule,
        },
        nzTitle: rule ? '编辑防火墙规则' : '创建防火墙规则',
        nzFooter: null,
        nzWidth: 720,
      })
      .afterClose.subscribe((saved) => {
        if (saved) {
          this.fresh();
        }
      });
  }

  /**
   * 删除规则
   *
   * @param record 规则
   */
  remove(record: FirewallRule): void {
    this.tencentSrv
      .firewallDelete(this.keyId, this.region, this.instanceId, rulePayload([record]))
      .subscribe({
        next: (res) => {
          /** 业务错误 */
          const message = businessError(res);
          if (message) {
            this.msgSrv.error(message);
            return;
          }
          this.msgSrv.success('规则删除成功');
          this.fresh();
        },
        error: (err: unknown) =>
          this.msgSrv.error(apiErrorMessage(err, '规则删除失败，请稍后重试！')),
      });
  }
}
