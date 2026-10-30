// This file can be replaced during build by using the `fileReplacements` array.
// `ng build ---prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

import * as MOCKDATA from '@_mock';
import { mockInterceptor, provideMockConfig } from '@delon/mock';
import { Environment } from '@delon/theme';

export const environment = {
  production: false,
  useHash: true,
  api: {
    // 注：后端地址实际取自运行时配置 `src/assets/config.json` 的 baseUrl
    // （由 StartupService 注入 SettingsService，defaultInterceptor 取用），
    // 这里的 baseUrl 只作为框架要求的占位
    baseUrl: './',
    refreshTokenEnabled: true,
    refreshTokenType: 'auth-refresh',
  },
  providers: [provideMockConfig({ data: MOCKDATA })],
  interceptorFns: [mockInterceptor],
} as Environment;
