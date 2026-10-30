import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GlobalFooterModule } from '@delon/abc/global-footer';
import { DA_SERVICE_TOKEN } from '@delon/auth';
import { SettingsService } from '@delon/theme';
import { NzIconModule } from 'ng-zorro-antd/icon';

@Component({
  selector: 'layout-passport',
  template: `
    <div class="container">
      <div class="wrap">
        <div class="top">
          <div class="head">
            <img class="logo" src="./assets/logo-color.svg" />
            <span class="title">{{ settings.app.name || '管理平台' }}</span>
          </div>
          <div class="desc">{{ settings.app.description }}</div>
        </div>
        <router-outlet />
        <global-footer [links]="links">
          Copyright <i class="anticon anticon-copyright"></i> 2026
        </global-footer>
      </div>
    </div>
  `,
  styleUrls: ['./passport.less'],
  imports: [RouterOutlet, GlobalFooterModule, NzIconModule],
})
export class LayoutPassport {
  private tokenSrv = inject(DA_SERVICE_TOKEN);
  /** 站点信息，注：由 StartupService 从 `/passport/app` 拉取 */
  settings = inject(SettingsService);

  links = [
    {
      title: '帮助',
      href: '',
    },
    {
      title: '隐私',
      href: '',
    },
    {
      title: '条款',
      href: '',
    },
  ];

  constructor() {
    // 进入登录/初始化页即视为未登录，清掉本地令牌
    this.tokenSrv.clear();
  }
}
