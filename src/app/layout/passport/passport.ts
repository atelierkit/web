import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { ICP_URL, SiteService, copyrightText, mergeIcp } from '@core';
import { GlobalFooterModule } from '@delon/abc/global-footer';
import { DA_SERVICE_TOKEN } from '@delon/auth';
import { SettingsService } from '@delon/theme';
import { map } from 'rxjs';

@Component({
  selector: 'layout-passport',
  template: `
    <div class="container">
      <div class="wrap">
        <div class="top">
          <div class="head">
            <img class="logo" src="./assets/logo.png" />
            <span class="title">{{ settings.app.name || '管理平台' }}</span>
          </div>
          <div class="desc">{{ settings.app.description }}</div>
        </div>
        <router-outlet />
        <global-footer>
          {{ copyrightLine() }}
          @if (icp()?.icp) {
            <a class="icp" [href]="icpUrl" target="_blank" rel="noopener noreferrer">
              {{ icp()?.icp }}
            </a>
          }
        </global-footer>
      </div>
    </div>
  `,
  styleUrls: ['./passport.less'],
  imports: [RouterOutlet, GlobalFooterModule],
})
export class LayoutPassport {
  private tokenSrv = inject(DA_SERVICE_TOKEN);
  private siteSrv = inject(SiteService);
  /** 站点信息，注：应用名称与说明由 StartupService 写入，来源是管理员配置的「应用配置」 */
  settings = inject(SettingsService);

  /** 当前年份，注：版权年份随系统时间变化，不再写死 */
  readonly year = new Date().getFullYear();

  /** 备案号查询地址 */
  readonly icpUrl = ICP_URL;

  /**
   * 备案信息
   *
   * 注：来自管理员在「配置 → 备案配置」中维护的记录，`passport` 接口免登录可读；
   * StartupService 已请求过并缓存，这里订阅不会产生额外请求
   */
  readonly icp = toSignal(this.siteSrv.info().pipe(map((info) => mergeIcp(info.icp))), {
    initialValue: null,
  });

  /** 版权行文案，注：未配置备案主体时只显示年份 */
  readonly copyrightLine = computed(() => copyrightText(this.year, this.icp()?.owner));

  constructor() {
    // 进入登录/初始化页即视为未登录，清掉本地令牌
    this.tokenSrv.clear();
  }
}
