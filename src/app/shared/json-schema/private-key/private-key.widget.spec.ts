import { ChangeDetectorRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormProperty, SFComponent, SFItemComponent } from '@delon/form';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PrivateKeyWidget } from './private-key.widget';

/** 组装结果：被测小部件 + 字段值替身 */
interface WidgetHarness {
  /** 被测小部件 */
  widget: PrivateKeyWidget;
  /** 字段值替身，注：`setValue` 是断言目标（运行时是 vitest 的 spy） */
  formProperty: { setValue: (value: string, onlySelf: boolean) => void; value: string };
}

/** 私钥文本 */
const KEY_TEXT = [
  '-----BEGIN OPENSSH PRIVATE KEY-----',
  'AAAA',
  '-----END OPENSSH PRIVATE KEY-----',
].join('\n');

/** 私钥文件上限（16 KB）再加一个字节 */
const TOO_LARGE = 16 * 1024 + 1;

/**
 * 组装被测小部件
 *
 * 注：不渲染模板（`sf-item-wrap` 依赖 SF 内部对象），只验证读文件 / 写值 / 状态机；
 * 渲染部分由 `ng build` 的模板类型检查兜住
 *
 * @returns 被测小部件与字段值替身
 */
function widgetOf(): WidgetHarness {
  /** 被测小部件 */
  const widget = TestBed.runInInjectionContext(() => new PrivateKeyWidget());
  /** 字段值替身 */
  const formProperty = { setValue: vi.fn(), value: '' };
  widget.ui = {};
  widget.formProperty = formProperty as unknown as FormProperty;
  return { widget, formProperty };
}

/**
 * 构造一次文件选择事件
 *
 * 注：浏览器里 `input.files` 只能由用户操作或 `DataTransfer` 填充，
 * 这里直接给一个形状相同的替身 —— `onFile` 只读 `files[0]` 与写回 `value`
 *
 * @param file 选中的文件
 * @returns 事件替身
 */
function changeEventOf(file: File): Event {
  /** 选择框替身 */
  const input = { files: [file], value: 'picked' };
  return { target: input } as unknown as Event;
}

describe('PrivateKeyWidget', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ChangeDetectorRef, useValue: {} },
        { provide: SFComponent, useValue: {} },
        { provide: SFItemComponent, useValue: {} },
      ],
    });
  });

  it('回填空串时清掉文件名与提示（编辑态后端不下发私钥）', () => {
    /** 被测小部件与替身 */
    const { widget } = widgetOf();
    widget.reset(KEY_TEXT);
    expect(widget.hasContent()).toBe(true);
    widget.reset('');
    expect(widget.hasContent()).toBe(false);
    expect(widget.fileName()).toBe('');
    expect(widget.sizeText()).toBe('');
  });

  it('回填已有内容时只标记「已填写」，不假装是本次选的文件', () => {
    /** 被测小部件与替身 */
    const { widget } = widgetOf();
    widget.reset(KEY_TEXT);
    expect(widget.hasContent()).toBe(true);
    // 注：没有选过文件就不该显示文件名 —— 编辑态显示「已填写私钥内容」即可
    expect(widget.fileName()).toBe('');
  });

  it('体积文案保留一位小数，未选文件时为空串', () => {
    /** 被测小部件与替身 */
    const { widget } = widgetOf();
    expect(widget.sizeText()).toBe('');
    widget.fileSize.set(1740);
    expect(widget.sizeText()).toBe('1.7 KB');
  });

  it('选中私钥文件后把内容写进字段，并显示文件名', async () => {
    /** 被测小部件与替身 */
    const { widget, formProperty } = widgetOf();
    /** 私钥文件 */
    const file = new File([KEY_TEXT], 'id_rsa');
    await widget.onFile(changeEventOf(file));
    expect(formProperty.setValue).toHaveBeenCalledWith(KEY_TEXT, false);
    expect(widget.fileName()).toBe('id_rsa');
    expect(widget.fileSize()).toBe(file.size);
    expect(widget.localError()).toBe('');
    expect(widget.hasContent()).toBe(true);
  });

  it('文件超过 16 KB 时拦住，不写值（多半是选错了文件）', async () => {
    /** 被测小部件与替身 */
    const { widget, formProperty } = widgetOf();
    /** 超大文件 */
    const file = new File([new Uint8Array(TOO_LARGE)], 'big.bin');
    await widget.onFile(changeEventOf(file));
    expect(formProperty.setValue).not.toHaveBeenCalled();
    expect(widget.localError()).toContain('文件过大');
  });

  it('空文件被拒（避免把空串当成「不修改」提交上去）', async () => {
    /** 被测小部件与替身 */
    const { widget, formProperty } = widgetOf();
    /** 空白文件 */
    const file = new File(['   \n'], 'empty');
    await widget.onFile(changeEventOf(file));
    expect(formProperty.setValue).not.toHaveBeenCalled();
    expect(widget.localError()).toContain('空的');
  });

  it('手动粘贴直接写字段（兜底路径：没有本地文件的场景）', () => {
    /** 被测小部件与替身 */
    const { widget, formProperty } = widgetOf();
    widget.onInput({ target: { value: KEY_TEXT } } as unknown as Event);
    expect(formProperty.setValue).toHaveBeenCalledWith(KEY_TEXT, false);
    expect(widget.text()).toBe(KEY_TEXT);
    expect(widget.hasContent()).toBe(true);
  });

  it('清除把字段置空并复位本地状态', () => {
    /** 被测小部件与替身 */
    const { widget, formProperty } = widgetOf();
    widget.reset(KEY_TEXT);
    widget.fileName.set('id_rsa');
    widget.clear();
    expect(formProperty.setValue).toHaveBeenCalledWith('', false);
    expect(widget.hasContent()).toBe(false);
    expect(widget.fileName()).toBe('');
  });
});
