import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import type { SFSchema, SFUISchema } from '@delon/form';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';

import { businessError, rulePayload } from '../../tencent.format';
import { FirewallRule, TencentService } from '../../tencent.service';

/** 规则编辑弹窗入参 */
export interface FirewallEditData {
  /** 密钥ID */
  keyId: number;
  /** 地域 */
  region: string;
  /** 实例ID */
  instanceId: string;
  /** 待编辑的规则，缺省表示新增 */
  rule?: FirewallRule;
}

/**
 * 防火墙规则编辑组件
 *
 * 注 1：腾讯云没有「改一条规则」的接口，旧私有项目的做法是**先删旧规则、再建新规则**，
 * 这里保持同样的顺序（否则会多出一条规则）
 * 注 2：`Port` 提交前统一转成字符串（腾讯云该字段是 String）
 */
@Component({
  selector: 'tencent-firewall-edit',
  templateUrl: './edit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class TencentFirewallEditComponent implements OnInit {
  private readonly tencentSrv = inject(TencentService);
  private readonly modalRef = inject(NzModalRef);
  private readonly msgSrv = inject(NzMessageService);
  /** 弹窗入参 */
  private readonly data = inject<FirewallEditData>(NZ_MODAL_DATA);

  /** 表单数据 */
  readonly formData = signal<Record<string, unknown> | null>(null);
  /** 本机公网 IP，注：「填写本地IP」按钮用 */
  readonly ip = signal('');

  /** 表单 schema */
  readonly schema: SFSchema = {
    properties: {
      Action: { type: 'string', title: '处理动作' },
      Protocol: { type: 'string', title: '协议' },
      Port: { type: 'string', title: '端口' },
      CidrBlock: { type: 'string', title: 'IPV4 来源' },
      Ipv6CidrBlock: { type: 'string', title: 'IPV6 来源' },
      FirewallRuleDescription: { type: 'string', title: '备注', maxLength: 64 },
    },
    required: ['Action', 'Protocol', 'Port'],
  };

  /** 表单样式 */
  readonly ui: SFUISchema = {
    '*': { spanLabelFixed: 110, grid: { span: 24 } },
    $Action: {
      widget: 'radio',
      styleType: 'button',
      buttonStyle: 'solid',
      enum: [
        { label: '接受', value: 'ACCEPT' },
        { label: '丢弃', value: 'DROP' },
      ],
    },
    $Protocol: {
      widget: 'select',
      enum: [
        { label: 'TCP', value: 'TCP' },
        { label: 'UDP', value: 'UDP' },
        { label: 'ICMP', value: 'ICMP' },
        { label: 'ALL', value: 'ALL' },
      ],
    },
    $Port: { placeholder: '单个端口 80、范围 80-443、多个 22,3389' },
    $CidrBlock: { widget: 'custom' },
    $Ipv6CidrBlock: { placeholder: '如 ::/0 或 2001:db8::/32' },
    $FirewallRuleDescription: { widget: 'textarea', autosize: { minRows: 2, maxRows: 4 } },
  };

  /** 页面初始化 */
  ngOnInit(): void {
    this.tencentSrv.clientIp().subscribe({
      next: (res) => this.ip.set(res.ip),
      // 取不到公网 IP 只是少一个便捷按钮，不影响填表
      error: () => this.ip.set(''),
    });
    /** 待编辑的规则 */
    const rule = this.data.rule;
    this.formData.set(
      rule
        ? {
            Action: rule.Action ?? 'ACCEPT',
            Protocol: rule.Protocol ?? 'TCP',
            Port: rule.Port ?? '',
            CidrBlock: rule.CidrBlock ?? '',
            Ipv6CidrBlock: rule.Ipv6CidrBlock ?? '',
            FirewallRuleDescription: rule.FirewallRuleDescription ?? '',
          }
        : {
            Action: 'ACCEPT',
            Protocol: 'TCP',
            Port: '22',
            CidrBlock: '',
            Ipv6CidrBlock: '',
            FirewallRuleDescription: '',
          },
    );
  }

  /**
   * 保存规则
   *
   * @param value 表单值
   */
  save(value: Record<string, unknown>): void {
    /** 新规则 */
    const next = rulePayload([value as FirewallRule])[0];
    /** 待删除的旧规则 */
    const previous = this.data.rule;
    if (!previous) {
      this.create(next);
      return;
    }
    this.tencentSrv
      .firewallDelete(
        this.data.keyId,
        this.data.region,
        this.data.instanceId,
        rulePayload([previous]),
      )
      .subscribe({
        next: (res) => {
          /** 业务错误 */
          const message = businessError(res);
          if (message) {
            this.msgSrv.error(message);
            return;
          }
          this.create(next);
        },
        error: (err: unknown) => {
          this.msgSrv.error(apiErrorMessage(err, '旧规则删除失败，请稍后重试！'));
          this.modalRef.close(false);
        },
      });
  }

  /**
   * 创建规则
   *
   * @param rule 规则
   */
  private create(rule: FirewallRule): void {
    this.tencentSrv
      .firewallCreate(this.data.keyId, this.data.region, this.data.instanceId, rulePayload([rule]))
      .subscribe({
        next: (res) => {
          /** 业务错误 */
          const message = businessError(res);
          if (message) {
            this.msgSrv.error(message);
            this.modalRef.close(false);
            return;
          }
          this.msgSrv.success('规则保存成功');
          this.modalRef.close(true);
        },
        error: (err: unknown) => {
          this.msgSrv.error(apiErrorMessage(err, '规则保存失败，请稍后重试！'));
          this.modalRef.close(false);
        },
      });
  }

  /** 关闭弹窗 */
  close(): void {
    this.modalRef.close(false);
  }
}
