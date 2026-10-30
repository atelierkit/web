import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { PassportService } from './passport.service';

/** 创建管理员页面的路由前缀 */
const SETUP_URL = '/passport/setup';

/**
 * 首次部署初始化守卫
 *
 * 系统未初始化时，所有路由都被强制导向「创建管理员」，其余入口一律不可达；
 * 已初始化后，创建管理员页本身也不可再访问（避免误建成第二个管理员）
 */
export const setupGuard: CanActivateFn = (_route, state) => {
  const passportSrv = inject(PassportService);
  const router = inject(Router);
  return passportSrv.init().pipe(
    map(({ initialized }) => {
      /** 当前目标是否为创建管理员页 */
      const isSetup = state.url.startsWith(SETUP_URL);
      if (!initialized && !isSetup) {
        return router.createUrlTree([SETUP_URL]);
      }
      if (initialized && isSetup) {
        return router.createUrlTree(['/passport/login']);
      }
      return true;
    }),
  );
};
