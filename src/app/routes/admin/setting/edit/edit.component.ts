import { Directive, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import { SFSchema, SFUISchema } from '@delon/form';
import { NzMessageService } from 'ng-zorro-antd/message';

import { AdminService, SettingPayload } from '../../admin.service';

/**
 * 配置编辑组件基类
 *
 * 注 1：各配置编码的 `value` 结构不同，子类只需给出 `code` / `title` / `valueSchema`，
 * 加载、新建与更新流程完全一致，故收在基类里
 * 注 2：配置未创建时后端回 404，此时转为新建态；其它错误只提示，同时仍给一份空白表单 ——
 * 真去提交会被后端以「主键已使用」挡下，不会覆盖已有配置
 */
@Directive()
export abstract class AdminSettingEditComponent implements OnInit {
  private readonly adminSrv = inject(AdminService);
  private readonly msgSrv = inject(NzMessageService);

  /** 配置编码（主键） */
  abstract code: string;

  /** 页面标题 */
  abstract title: string;

  /** 配置值的表单结构 */
  abstract valueSchema: SFSchema;

  /** 表单数据，注：为 null 表示详情尚未就绪，模板据此显示加载态 */
  readonly formData = signal<Record<string, unknown> | null>(null);

  /** 当前是否已存在配置，注：决定提交走 create 还是 update */
  private exists = false;

  /** 表单 schema，注：在 ngOnInit 里拼装，因为要等子类的 valueSchema 就绪 */
  schema!: SFSchema;

  /** 表单样式 */
  readonly ui: SFUISchema = {
    '*': { spanLabelFixed: 160, grid: { span: 24 } },
    $status: { checkedChildren: '正常', unCheckedChildren: '禁用' },
    // 注：时间戳只读展示，格式化交给 `at` 小部件
    $updateAt: { widget: 'at' },
  };

  /** 页面初始化 */
  ngOnInit(): void {
    this.schema = {
      properties: {
        value: this.valueSchema,
        status: { type: 'boolean', title: '状态' },
        updateAt: { type: 'number', title: '更新时间' },
      },
      required: ['status'],
    };
    this.fresh();
  }

  /** 重新加载配置 */
  fresh(): void {
    this.adminSrv.setting(this.code).subscribe({
      next: (res) => {
        this.exists = true;
        this.formData.set({
          value: res.value ?? {},
          status: res.status,
          updateAt: res.update?.at ?? null,
        });
      },
      error: (err: unknown) => {
        this.exists = false;
        this.formData.set({ value: {}, status: true, updateAt: null });
        // 404 是「尚未配置」，属正常分支，不打扰用户
        if ((err as { status?: number } | null)?.status !== 404) {
          this.msgSrv.error(apiErrorMessage(err, '加载配置失败，请稍后重试！'));
        }
      },
    });
  }

  /**
   * 保存配置（新建或更新）
   *
   * @param value SF 表单提交值
   */
  save(value: Record<string, unknown>): void {
    /** 提交内容 */
    const payload: SettingPayload = {
      code: this.code,
      value: value['value'],
      status: value['status'] as boolean,
    };
    /** 保存请求 */
    const request = this.exists
      ? this.adminSrv.updateSetting(this.code, payload)
      : this.adminSrv.createSetting(payload);
    request.subscribe({
      next: () => {
        this.msgSrv.success(this.exists ? '信息修改完成' : '信息配置完成');
        this.fresh();
      },
      error: (err: unknown) =>
        this.msgSrv.error(apiErrorMessage(err, '保存配置失败，请稍后重试！')),
    });
  }
}
