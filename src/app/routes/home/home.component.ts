import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DA_SERVICE_TOKEN, ITokenModel, ITokenService } from '@delon/auth';
import { SHARED_IMPORTS } from '@shared';

import { HomeTokenState, tokenState } from './home.format';

/**
 * 首页组件（`/home`）
 *
 * 展示登录令牌的有效期状态（倒计时 / 长期有效 / 已失效），并提供「续期」入口；
 * 续期走账号管理下的「登录有效期」页（`/user/valid`），改的是同一份后端白名单档位
 */
@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class HomeComponent implements OnInit {
  private readonly tokenSrv = inject<ITokenService>(DA_SERVICE_TOKEN);
  private readonly destroyRef = inject(DestroyRef);
  /** 令牌展示状态 */
  readonly state = signal<HomeTokenState>({ deadline: 0, alive: false });

  /** 页面初始化，读取本地令牌并订阅后续变更（续期 / 刷新令牌都会触发） */
  ngOnInit(): void {
    this.setState(this.tokenSrv.get());
    this.tokenSrv
      .change()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((token) => this.setState(token));
  }

  /**
   * 记录令牌的展示状态
   *
   * @param token 本地令牌，未登录时为 null
   */
  private setState(token: ITokenModel | null): void {
    this.state.set(tokenState(token));
  }
}
