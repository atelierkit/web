import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import { STColumn, STData } from '@delon/abc/st';
import { SHARED_IMPORTS, tokenValidLabel } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';

import { AuthService, AuthToken } from '../auth.service';

/**
 * 令牌管理组件
 *
 * 提供在线会话（令牌）清单展示与作废
 */
@Component({
  selector: 'auth-token',
  templateUrl: './token.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class AuthTokenComponent implements OnInit {
  private readonly authSrv = inject(AuthService);
  private readonly msgSrv = inject(NzMessageService);

  /** 令牌清单 */
  readonly data = signal<AuthToken[]>([]);
  /** 加载标记 */
  readonly loading = signal(true);

  /** 列定义 */
  readonly columns: STColumn[] = [
    { title: '用户ID', index: 'id' },
    { title: '令牌', index: 'code' },
    {
      title: '创建时间',
      index: 'createAt',
      format: (item: STData) => this.time(item['createAt']),
    },
    {
      title: '更新时间',
      index: 'updateAt',
      format: (item: STData) => this.time(item['updateAt']),
    },
    {
      title: '有效期',
      index: 'valid',
      format: (item: STData) => tokenValidLabel(Number(item['valid'])),
    },
    {
      title: '过期时间',
      index: 'expired',
      // 注：过期时间为 0 表示长期有效，不能进时间格式化
      format: (item: STData) => this.time(item['expired']) || '长期有效',
    },
    { title: '操作', render: 'operate' },
  ];

  /** 页面初始化 */
  ngOnInit(): void {
    this.fresh();
  }

  /** 加载令牌清单 */
  fresh(): void {
    this.loading.set(true);
    this.authSrv.tokens().subscribe({
      next: (rows) => {
        this.data.set(rows);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        // 失败时须复位加载态，否则表格会一直转圈
        this.loading.set(false);
        this.msgSrv.error(apiErrorMessage(err, '加载令牌列表失败，请稍后重试！'));
      },
    });
  }

  /**
   * 作废指定令牌
   *
   * @param token 令牌记录
   */
  destroy(token: AuthToken): void {
    this.authSrv.destroyToken(token).subscribe({
      next: () => {
        this.msgSrv.success('令牌已作废');
        this.fresh();
      },
      error: (err: unknown) =>
        this.msgSrv.error(apiErrorMessage(err, '作废令牌失败，请稍后重试！')),
    });
  }

  /**
   * 时间戳格式化
   *
   * @param value 时间戳字符串，注：0 或空值返回空串
   * @returns 格式化后的时间
   */
  private time(value: unknown): string {
    /** 时间戳 */
    const at = Number(value);
    return at ? formatDate(at, 'yyyy-MM-dd HH:mm:ss', 'en-US') : '';
  }
}
