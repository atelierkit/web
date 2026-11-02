import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { SettingsService } from '@delon/theme';
import {
  LayoutDefaultModule,
  LayoutDefaultOptions,
  LayoutDefaultService,
} from '@delon/theme/layout-default';
import { UserAvatar } from '@shared';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMenuModule } from 'ng-zorro-antd/menu';

import { HeaderClearStorage } from './widgets/clear-storage';
import { HeaderFullScreen } from './widgets/fullscreen';
import { HeaderSearch } from './widgets/search';
import { HeaderUser } from './widgets/user';

@Component({
  selector: 'layout-basic',
  template: `
    <layout-default
      [options]="options"
      [asideUser]="asideUserTpl"
      [content]="contentTpl"
      [customError]="null"
    >
      <layout-default-header-item direction="left" hidden="mobile">
        <a layout-default-header-item-trigger routerLink="/passport/lock">
          <nz-icon nzType="lock" />
        </a>
      </layout-default-header-item>
      <layout-default-header-item direction="left" hidden="pc">
        <div
          layout-default-header-item-trigger
          (click)="searchToggleStatus.set(!searchToggleStatus())"
        >
          <nz-icon nzType="search" />
        </div>
      </layout-default-header-item>
      <layout-default-header-item direction="middle">
        <header-search [(toggleChange)]="searchToggleStatus" />
      </layout-default-header-item>
      <layout-default-header-item direction="right" hidden="mobile">
        <div
          layout-default-header-item-trigger
          nz-dropdown
          [nzDropdownMenu]="settingsMenu"
          nzTrigger="click"
          nzPlacement="bottomRight"
        >
          <nz-icon nzType="setting" />
        </div>
        <nz-dropdown-menu #settingsMenu="nzDropdownMenu">
          <div nz-menu style="width: 200px;">
            <div nz-menu-item>
              <header-fullscreen />
            </div>
            <div nz-menu-item>
              <header-clear-storage />
            </div>
          </div>
        </nz-dropdown-menu>
      </layout-default-header-item>
      <layout-default-header-item direction="right">
        <header-user />
      </layout-default-header-item>
      <ng-template #asideUserTpl>
        <div
          nz-dropdown
          nzTrigger="click"
          [nzDropdownMenu]="userMenu"
          class="alain-default__aside-user"
        >
          <user-avatar
            class="alain-default__aside-user-avatar"
            [src]="user.avatar"
            [name]="user.name"
          />
          <div class="alain-default__aside-user-info">
            <strong>{{ user.name }}</strong>
            <p class="mb0">{{ user.email }}</p>
          </div>
        </div>
        <nz-dropdown-menu #userMenu="nzDropdownMenu">
          <ul nz-menu>
            <li nz-menu-item routerLink="/pro/account/center">个人中心</li>
            <li nz-menu-item routerLink="/pro/account/settings">个人设置</li>
          </ul>
        </nz-dropdown-menu>
      </ng-template>
      <ng-template #contentTpl>
        <router-outlet />
      </ng-template>
    </layout-default>
  `,
  imports: [
    RouterOutlet,
    RouterLink,
    LayoutDefaultModule,
    NzIconModule,
    NzMenuModule,
    NzDropdownModule,
    UserAvatar,
    HeaderSearch,
    HeaderClearStorage,
    HeaderFullScreen,
    HeaderUser,
  ],
})
export class LayoutBasic {
  private readonly settings = inject(SettingsService);
  /**
   * 注：注入 `LayoutDefaultService` 不只是为了用它，更是为了**在首屏渲染前把它创建出来**。
   * ng-alain 22 里 `collapsedIcon` 的初值是空串，只有该服务的构造函数订阅到一次 `layout` 变更通知后
   * 才会算出 `menu-fold` / `menu-unfold`；而 `SettingsService.notify$` 是普通 Subject（无回放），
   * 早于订阅发出的通知会被直接丢掉。所以必须先 `inject` 建立订阅，再在构造函数里补一次通知。
   */
  private readonly layoutSrv = inject(LayoutDefaultService);
  readonly user = this.settings.user;
  protected options: LayoutDefaultOptions = {
    logoExpanded: `./assets/logo-expanded.svg`,
    logoCollapsed: `./assets/logo-collapsed.svg`,
  };
  protected searchToggleStatus = signal(false);

  constructor() {
    // 折叠按钮空白方块的兜底（成因见 `layoutSrv` 的注释）：
    // 上面的 `<nz-icon [nzType]="srv.collapsedIcon()" />` 拿到空串时不渲染任何图形，
    // 而项目里没有任何地方调用过 `setLayout`，于是首屏就是一个空的蓝色方块，
    // 直到用户点一次折叠/展开才被 `toggleCollapsed()` 顺带填上图标。
    // 这里用「与当前值相同」的 `collapsed` 触发一次通知，把图标名在首屏前补齐；
    // 上游若把初值改成 `menu-fold` 之类的有效值，此处 `if` 自然短路，不再产生任何副作用。
    if (!this.layoutSrv.collapsedIcon()) {
      this.settings.setLayout('collapsed', this.settings.layout.collapsed);
    }
  }
}
