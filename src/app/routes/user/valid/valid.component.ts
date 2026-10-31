import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import { SFSchema, SFUISchema } from '@delon/form';
import {
  SHARED_IMPORTS,
  TOKEN_VALID_DEFAULT,
  TOKEN_VALID_OPTIONS,
  formatDateTime,
  isTokenValid,
  tokenValidLabel,
} from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { finalize } from 'rxjs';

import { expiredLabel } from '../user.format';
import { UserService } from '../user.service';

/**
 * 登录有效期设置组件
 *
 * 注 1：有效期是「多久不访问就失效」，保存后立即生效，并作为下次登录的默认档位
 * 注 2：保存接口会返回新令牌，服务层已把本地登录态替换掉，所以刷新后「当前过期时间」才是真的
 * 注 3：档位白名单与后端 `TOKEN_VALIDS` 一致，前端拦一次非法值，避免白跑一趟接口
 */
@Component({
  selector: 'user-valid',
  templateUrl: './valid.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class UserValidComponent implements OnInit {
  private readonly userSrv = inject(UserService);
  private readonly msgSrv = inject(NzMessageService);

  /** 表单数据 */
  readonly formData = signal<Record<string, unknown>>({
    valid: TOKEN_VALID_DEFAULT,
    expired: '',
  });
  /** 保存请求在途 */
  readonly saving = signal(false);

  /** 表单配置，注：档位与后端白名单保持一致 */
  readonly schema: SFSchema = {
    properties: {
      valid: { type: 'number', title: '登录有效期', enum: TOKEN_VALID_OPTIONS },
      expired: { type: 'string', title: '当前过期时间' },
    },
    required: ['valid'],
  };

  /** 表单样式配置 */
  readonly ui: SFUISchema = {
    '*': { spanLabelFixed: 140, size: 'large', grid: { span: 24 } },
    $valid: { widget: 'select' },
    // 注：只读展示，当前令牌的过期时间不接受编辑
    $expired: { widget: 'text', readOnly: true },
  };

  /** 页面初始化 */
  ngOnInit(): void {
    this.load();
  }

  /**
   * 重新加载有效期设置
   *
   * 注：档位取自服务端（用户已设置的值），过期时间取自本地令牌，两者都与实际登录态一致
   */
  load(): void {
    /** 本地令牌 */
    const token = this.userSrv.token;
    /** 令牌过期时间，注：长期有效为 0 */
    const expired = Number(token?.expired);
    this.formData.update((item) => ({
      ...item,
      expired: expiredLabel(expired, isTokenValid(token), formatDateTime),
    }));
    this.userSrv.show().subscribe({
      next: (user) => {
        /** 用户已设置的登录有效期 */
        const valid = Number(user.tokenValid);
        this.formData.update((item) => ({
          ...item,
          // 历史数据或异常值一律回落到默认档位，否则下拉框会显示空白
          valid: TOKEN_VALID_OPTIONS.some((option) => option.value === valid)
            ? valid
            : TOKEN_VALID_DEFAULT,
        }));
      },
      error: (err: unknown) =>
        this.msgSrv.error(apiErrorMessage(err, '加载登录有效期失败，请稍后重试！')),
    });
  }

  /**
   * 保存登录有效期
   *
   * @param value SF 表单提交值
   */
  save(value: Record<string, unknown>): void {
    /** 有效期（单位：分钟），注：0 表示长期有效 */
    const valid = Number(value['valid']);
    // 前置守卫：档位非法或请求在途时直接忽略，避免重复提交
    if (this.saving() || !TOKEN_VALID_OPTIONS.some((item) => item.value === valid)) {
      return;
    }
    this.saving.set(true);
    this.userSrv
      .setValid(valid)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.msgSrv.success(`登录有效期已设置为${tokenValidLabel(valid)}！`);
          this.load();
        },
        error: (err: unknown) =>
          this.msgSrv.error(apiErrorMessage(err, '登录有效期设置失败，请稍后重试！')),
      });
  }
}
