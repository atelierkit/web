import { HttpClient, HttpContext } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { apiErrorMessage } from '@core';
import { ALLOW_ANONYMOUS } from '@delon/auth';
import { SHARED_IMPORTS } from '@shared';
import { NzResultModule, type NzResultStatusType } from 'ng-zorro-antd/result';

/**
 * 匿名请求上下文，注：公开接口不该带令牌，也不会因 401 被踢回登录页
 *
 * @returns 请求上下文
 */
function anonymous(): HttpContext {
  return new HttpContext().set(ALLOW_ANONYMOUS, true);
}

/**
 * 新邮箱激活组件
 *
 * 注 1：页面由「更换邮箱」发出的激活邮件链接进入（`/passport/activate/:code`），走 `passport/activate` 接口
 * 注 2：**不能挂在 `LayoutPassport` 下** —— 那个布局的构造函数会清掉本地令牌，用户点邮件链接会被顺带登出；
 * 因此本页与 `passport/callback` 一样是独立页面
 * 注 3：接口对 `/passport` 前缀放行，不需要登录态，登录与未登录都能点开链接
 */
@Component({
  selector: 'passport-activate',
  template: `
    <div class="activate">
      <nz-result [nzStatus]="status()" [nzTitle]="title()">
        <div nz-result-extra>
          <button nz-button type="button" nzType="primary" nzSize="large" routerLink="/">
            返回首页
          </button>
        </div>
      </nz-result>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 24px;
      }

      .activate {
        width: 100%;
        max-width: 640px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS, NzResultModule],
})
export class PassportActivateComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);

  /** 结果页状态 */
  readonly status = signal<NzResultStatusType>('info');
  /** 结果页标题 */
  readonly title = signal('正在激活新邮箱…');

  /** 页面初始化，提交激活码并展示结果 */
  ngOnInit(): void {
    /** 激活随机码 */
    const code = String(this.route.snapshot.params['code'] ?? '');
    // 注：标成匿名请求 —— 接口本身公开（`/passport` 前缀），且激活失败（如账号被禁用）返回的 401
    // 属于业务错误，不加这个标记会被拦截器当成「登录过期」而跳转登录页
    this.http
      .post<{ msg?: string }>('passport/activate', { code }, { context: anonymous() })
      .subscribe({
        next: (res) => {
          this.status.set('success');
          this.title.set(res?.msg ?? '新邮箱已激活！');
        },
        error: (err: unknown) => {
          this.status.set('error');
          this.title.set(apiErrorMessage(err, '新邮箱激活失败，请稍后重试！'));
        },
      });
  }
}
