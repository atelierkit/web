import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { apiErrorMessage } from '@core';
import { SFSchema, SFUISchema } from '@delon/form';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';

import { AdminService, EmailSettingPayload, EmailSettingView } from '../../admin.service';

/**
 * 邮件配置组件
 *
 * 注 1：不继承 `AdminSettingEditComponent` —— 那个基类把 `value` 整对象提交，而授权码在详情里是占位符
 * `***`，整对象回传会把密码冲掉；本页要「留空即不改」，提交走独立的 `admin/email` 接口
 * 注 2：保存成功后后端会清掉连接器缓存，新配置立即生效，无需重启服务
 */
@Component({
  selector: 'admin-setting-email',
  templateUrl: './email.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class AdminSettingEmailComponent implements OnInit {
  private readonly adminSrv = inject(AdminService);
  private readonly msgSrv = inject(NzMessageService);

  /** 配置详情，注：为 null 表示尚未就绪，模板据此显示加载态 */
  readonly data = signal<EmailSettingView | null>(null);

  /** 加载中 */
  readonly loading = signal(true);

  /** 保存中 */
  readonly saving = signal(false);

  /** 测试发送中 */
  readonly testing = signal(false);

  /** 测试收件人，注：首次加载时用发件邮箱预填 */
  readonly testTo = signal('');

  /** 表单 schema，注：授权码是否必填取决于「库里是否已设置」 */
  readonly schema = signal<SFSchema>(this.schemaOf(false));

  /** 表单取值，注：把配置状态并进表单，与其他配置页的观感保持一致 */
  readonly formData = computed(() => {
    const view = this.data();
    return view ? { ...view.value, status: view.status } : null;
  });

  /** 表单样式 */
  readonly ui: SFUISchema = {
    '*': { spanLabelFixed: 140, grid: { span: 24 } },
    $secure: { checkedChildren: 'SSL 直连', unCheckedChildren: 'STARTTLS' },
    $status: { checkedChildren: '启用', unCheckedChildren: '停用' },
    $password: { type: 'password' },
  };

  /** 页面初始化 */
  ngOnInit(): void {
    this.fresh();
  }

  /** 重新加载配置 */
  fresh(): void {
    this.loading.set(true);
    this.adminSrv.emailSetting().subscribe({
      next: (res) => {
        // 注：先换 schema 再放数据，避免表单先用「授权码必填」的规则渲染一次
        this.schema.set(this.schemaOf(res.hasPassword));
        this.data.set(res);
        if (!this.testTo()) {
          this.testTo.set(res.value.account);
        }
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.msgSrv.error(apiErrorMessage(err, '加载邮件配置失败，请稍后重试！'));
      },
    });
  }

  /**
   * 保存配置
   *
   * @param value SF 表单提交值
   */
  save(value: Record<string, unknown>): void {
    /** 提交内容，注：授权码留空即不修改，由后端沿用原值 */
    const payload = {
      host: `${value['host'] ?? ''}`.trim(),
      port: Number(value['port']),
      secure: value['secure'] === true,
      account: `${value['account'] ?? ''}`.trim(),
      name: `${value['name'] ?? ''}`.trim(),
      replyTo: `${value['replyTo'] ?? ''}`.trim(),
      password: `${value['password'] ?? ''}`.trim(),
      status: value['status'] !== false,
    } as EmailSettingPayload;
    this.saving.set(true);
    this.adminSrv.saveEmail(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.msgSrv.success('邮件配置已保存');
        this.fresh();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.msgSrv.error(apiErrorMessage(err, '保存失败，请稍后重试！'));
      },
    });
  }

  /** 发送测试邮件 */
  test(): void {
    /** 收件邮箱 */
    const to = this.testTo().trim();
    if (!to) {
      this.msgSrv.warning('请先填写收件邮箱');
      return;
    }
    this.testing.set(true);
    this.adminSrv.testEmail(to).subscribe({
      next: (res) => {
        this.testing.set(false);
        this.msgSrv.success(`测试邮件已发送，耗时 ${res.latencyMs} 毫秒`);
      },
      error: (err: unknown) => {
        this.testing.set(false);
        this.msgSrv.error(apiErrorMessage(err, '测试邮件发送失败！'));
      },
    });
  }

  /**
   * 记录测试收件人
   *
   * @param event 输入事件
   */
  onTestTo(event: Event): void {
    this.testTo.set((event.target as HTMLInputElement).value);
  }

  /**
   * 组装表单 schema
   *
   * @param hasPassword 库里是否已有授权码
   * @returns 表单 schema
   */
  private schemaOf(hasPassword: boolean): SFSchema {
    return {
      properties: {
        host: {
          type: 'string',
          title: 'SMTP 主机',
          description: '如 smtp.163.com、smtp.126.com',
        },
        port: {
          type: 'number',
          title: 'SMTP 端口',
          minimum: 1,
          maximum: 65535,
          description: 'SSL 一般为 465，STARTTLS 一般为 587',
        },
        secure: {
          type: 'boolean',
          title: 'SSL 直连',
          default: true,
          description: '465 端口填「SSL 直连」，587 端口切到「STARTTLS」',
        },
        account: {
          type: 'string',
          title: '发件邮箱',
          format: 'email',
          description: '实际发信使用的完整邮箱地址',
        },
        name: {
          type: 'string',
          title: '发件人名称',
          description: '收件人看到的发件人显示名',
        },
        replyTo: {
          type: 'string',
          title: '回复地址',
          format: 'email',
          description: '选填，留空则回复到发件邮箱',
        },
        password: {
          type: 'string',
          title: 'SMTP 授权码',
          description: hasPassword
            ? '已设置，留空表示不修改'
            : '必填，是邮箱后台生成的授权码，不是登录密码',
        },
        status: {
          type: 'boolean',
          title: '启用',
          default: true,
          description: '停用后所有发信请求会直接报错',
        },
      },
      // 注：布尔字段不进 required —— SF 对 false 的必填判定容易误报
      required: hasPassword
        ? ['host', 'port', 'account', 'name']
        : ['host', 'port', 'account', 'name', 'password'],
    };
  }
}
