import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { default as ngLang } from '@angular/common/locales/zh';
import {
  ApplicationConfig,
  EnvironmentProviders,
  provideBrowserGlobalErrorListeners,
  Provider,
  provideZonelessChangeDetection,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withViewTransitions,
  withInMemoryScrolling,
  withHashLocation,
  RouterFeatures,
} from '@angular/router';
import { defaultInterceptor, provideStartup } from '@core';
import { provideCellWidgets } from '@delon/abc/cell';
import { provideSTWidgets } from '@delon/abc/st';
import { authSimpleInterceptor, provideAuth } from '@delon/auth';
import { provideSFConfig } from '@delon/form';
import { AlainProvideLang, provideAlain, zh_CN as delonLang } from '@delon/theme';
import { AlainConfig } from '@delon/util/config';
import { environment } from '@env/environment';
import { CELL_WIDGETS, ST_WIDGETS, SF_WIDGETS } from '@shared';
import { zhCN as dateLang } from 'date-fns/locale';
import { NzConfig, provideNzConfig } from 'ng-zorro-antd/core/config';
import { zh_CN as zorroLang } from 'ng-zorro-antd/i18n';

import { ICONS } from '../style-icons';
import { ICONS_AUTO } from '../style-icons-auto';
import { provideBindAuthRefresh } from './core/net';
import { routes } from './routes/routes';

/**
 * 语言与地区设置
 *
 * 注：本项目**不做国际化**（没有 i18n 词典、没有语言切换），界面文案直接写简体中文；
 * 这里只保留 zh_CN 的地区数据，供日期选择器、数字/日期管道等使用
 */
const defaultLang: AlainProvideLang = {
  abbr: 'zh-CN',
  ng: ngLang,
  zorro: zorroLang,
  date: dateLang,
  delon: delonLang,
};

const alainConfig: AlainConfig = {
  // 注：passport 前缀的接口本身免令牌，静态资源同理，
  // 交由拦截器按 `ignores` 跳过令牌校验与注入
  auth: { login_url: '/passport/login', ignores: [/assets/, /passport/] },
};

const ngZorroConfig: NzConfig = {};

const routerFeatures: RouterFeatures[] = [
  withComponentInputBinding(),
  withViewTransitions(),
  withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
];
if (environment.useHash) routerFeatures.push(withHashLocation());

const providers: Array<Provider | EnvironmentProviders> = [
  provideBrowserGlobalErrorListeners(),
  provideZonelessChangeDetection(),
  provideHttpClient(
    withInterceptors([
      ...(environment.interceptorFns ?? []),
      authSimpleInterceptor,
      defaultInterceptor,
    ]),
  ),
  provideRouter(routes, ...routerFeatures),
  provideAlain({ config: alainConfig, defaultLang, icons: [...ICONS_AUTO, ...ICONS] }),
  provideNzConfig(ngZorroConfig),
  provideAuth(),
  provideCellWidgets(...CELL_WIDGETS),
  provideSTWidgets(...ST_WIDGETS),
  provideSFConfig({
    widgets: [...SF_WIDGETS],
  }),
  provideStartup(),
  ...(environment.providers || []),
];

// If you use `@delon/auth` to refresh the token, additional registration `provideBindAuthRefresh` is required
if (environment.api?.refreshTokenEnabled && environment.api.refreshTokenType === 'auth-refresh') {
  providers.push(provideBindAuthRefresh());
}

export const appConfig: ApplicationConfig = {
  providers: providers,
};
