import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DA_SERVICE_TOKEN } from '@delon/auth';
import { SettingsService, User } from '@delon/theme';
import { UserAvatar } from '@shared';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMenuModule } from 'ng-zorro-antd/menu';

@Component({
  selector: 'header-user',
  template: `
    <div
      class="alain-default__nav-item d-flex align-items-center px-sm"
      nz-dropdown
      nzPlacement="bottomRight"
      [nzDropdownMenu]="userMenu"
    >
      <user-avatar [src]="user.avatar" [name]="user.name" size="small" class="mr-sm" />
      {{ user.name }}
    </div>
    <nz-dropdown-menu #userMenu="nzDropdownMenu">
      <div nz-menu class="width-sm">
        <div nz-menu-item routerLink="/user/basic">
          <nz-icon nzType="user" class="mr-sm" />
          个人资料
        </div>
        <div nz-menu-item routerLink="/user/valid">
          <nz-icon nzType="setting" class="mr-sm" />
          登录有效期
        </div>
        <li nz-menu-divider></li>
        <div nz-menu-item (click)="logout()">
          <nz-icon nzType="logout" class="mr-sm" />
          退出登录
        </div>
      </div>
    </nz-dropdown-menu>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NzDropdownModule, NzMenuModule, NzIconModule, UserAvatar],
})
export class HeaderUser {
  private readonly settingsSrv = inject(SettingsService);
  private readonly router = inject(Router);
  private readonly tokenService = inject(DA_SERVICE_TOKEN);

  /**
   * 当前登录用户
   *
   * 注 1：必须写成 getter —— `SettingsService.user` 背后是 signal，取值即登记依赖；
   * 若在字段上取一次快照（`readonly user = inject(SettingsService).user`），
   * 拿到的是构造时的旧对象，改完头像/昵称要刷新整页页头才会变
   * 注 2：本组件是 OnPush，靠的正是这个 signal 依赖把模板标脏，没它不会重新渲染
   *
   * @returns 当前登录用户
   */
  protected get user(): User {
    return this.settingsSrv.user;
  }

  protected logout(): void {
    this.tokenService.clear();
    this.router.navigateByUrl(this.tokenService.login_url!);
  }
}
