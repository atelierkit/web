import { ChangeDetectorRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SFComponent, SFItemComponent } from '@delon/form';
import { beforeEach, describe, expect, it } from 'vitest';

import { AtWidget } from './at.widget';

/**
 * 组装被测小部件
 *
 * 注：不渲染模板（`Widget` 基类要注入一堆 SF 内部对象），只验证 `reset()` 的取值与格式化逻辑；
 * 渲染部分由 `ng build` 的模板类型检查兜住
 *
 * @returns 被测小部件
 */
function widgetOf(): AtWidget {
  /** 被测小部件 */
  const widget = TestBed.runInInjectionContext(() => new AtWidget());
  return widget;
}

describe('AtWidget', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ChangeDetectorRef, useValue: {} },
        { provide: SFComponent, useValue: {} },
        { provide: SFItemComponent, useValue: {} },
      ],
    });
  });

  it('毫秒时间戳按本地时间格式化', () => {
    /** 被测小部件 */
    const widget = widgetOf();
    widget.schema = { type: 'number', title: '创建时间' };
    widget.reset(new Date(2026, 9, 31, 8, 5, 3).getTime());
    expect(widget.at()).toBe('2026-10-31 08:05:03');
  });

  it('schema.timestamp 为 s 时按秒解析（否则会显示成 1970 年）', () => {
    /** 被测小部件 */
    const widget = widgetOf();
    widget.schema = { type: 'number', title: '创建时间', timestamp: 's' };
    widget.reset(Math.floor(new Date(2026, 9, 31, 8, 5, 3).getTime() / 1000));
    expect(widget.at()).toBe('2026-10-31 08:05:03');
  });

  it('无值显示占位符 -，不显示 1970', () => {
    /** 被测小部件 */
    const widget = widgetOf();
    widget.schema = { type: 'number', title: '创建时间' };
    widget.reset(null);
    expect(widget.at()).toBe('-');
    widget.reset(undefined);
    expect(widget.at()).toBe('-');
    widget.reset(0);
    expect(widget.at()).toBe('-');
  });
});
