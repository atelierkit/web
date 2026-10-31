import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SHARED_IMPORTS } from '@shared';

import { DataBarComponent } from './bar/bar.component';
import { DataCalendarComponent } from './calendar/calendar.component';
import { DataSecurityComponent } from './security/security.component';

/**
 * 数据浏览页（交易日 / 证券 / K 线 三页签）
 *
 * 纯只读，无导出、无图表、无行选中。
 */
@Component({
  selector: 'data-browser',
  templateUrl: './browser.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS, DataCalendarComponent, DataSecurityComponent, DataBarComponent],
})
export class DataBrowserComponent {}
