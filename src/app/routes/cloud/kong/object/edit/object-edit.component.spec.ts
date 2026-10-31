import { TestBed } from '@angular/core/testing';
import type { SFSchema, SFUISchema } from '@delon/form';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KongObjectService } from '../object.service';
import type { KongAction, KongObject } from '../object.types';
import { KongObjectEditComponent } from './object-edit.component';

/**
 * 被测弹窗
 *
 * 注：基类是抽象类，这里给一份最小实现，只用来验证取数与保存的流程
 */
class ProbeEditComponent extends KongObjectEditComponent {
  readonly name = '探针';
  readonly schema: SFSchema = { properties: {} };
  readonly ui: SFUISchema = {};

  /**
   * 提交体
   *
   * @param value 表单值
   * @returns 提交数据
   */
  protected payload(value: Record<string, unknown>): Record<string, unknown> {
    return { name: value['name'] };
  }

  /**
   * 暴露基类的 compact 供测试
   *
   * @param value 待过滤的提交体
   * @returns 过滤后的提交体
   */
  compactOf(value: Record<string, unknown>): Record<string, unknown> {
    return this.compact(value);
  }
}

/**
 * 组装被测弹窗
 *
 * @param action 弹窗动作
 * @param id 对象ID，注：新建时为空
 * @param detail 详情接口的返回
 * @returns 被测弹窗与替身
 */
function componentOf(
  action: KongAction,
  id?: string,
  detail: KongObject | Error = { id: 'r1', name: '路由一', created_at: 1 },
  saveError?: Error,
): {
  component: ProbeEditComponent;
  objectSrv: {
    object: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  modalRef: { close: ReturnType<typeof vi.fn> };
  msgSrv: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
} {
  /** 对象服务替身 */
  const objectSrv = {
    object: vi.fn((_kongId: number, _type: string, _id: string) =>
      detail instanceof Error ? throwError(() => detail) : of(detail),
    ),
    create: vi.fn((_kongId: number, _type: string, _value: Record<string, unknown>) =>
      saveError ? throwError(() => saveError) : of({}),
    ),
    update: vi.fn((_kongId: number, _type: string, _id: string, _value: Record<string, unknown>) =>
      saveError ? throwError(() => saveError) : of({}),
    ),
  };
  /** 消息服务替身 */
  const msgSrv = { success: vi.fn(), error: vi.fn() };
  /** 弹窗引用替身 */
  const modalRef = { close: vi.fn() };
  // 注：同一个用例里要组装两个弹窗（复制态 / 编辑态各一个），必须先复位已实例化的测试模块
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: KongObjectService, useValue: objectSrv },
      { provide: NzMessageService, useValue: msgSrv },
      { provide: NzModalRef, useValue: modalRef },
      { provide: NZ_MODAL_DATA, useValue: { kongId: 3, type: 'routes', action, id } },
    ],
  });
  /** 被测弹窗 */
  const component = TestBed.runInInjectionContext(() => new ProbeEditComponent());
  return { component, objectSrv, modalRef, msgSrv };
}

describe('KongObjectEditComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('新建时不读详情，直接给空表单', () => {
    /** 被测弹窗与替身 */
    const { component, objectSrv } = componentOf('add');
    component.ngOnInit();
    expect(objectSrv.object).not.toHaveBeenCalled();
    expect(component.formData()).toEqual({});
  });

  it('编辑时按对象ID读详情并回填', () => {
    /** 被测弹窗与替身 */
    const { component, objectSrv } = componentOf('edit', 'r1');
    component.ngOnInit();
    expect(objectSrv.object).toHaveBeenCalledWith(3, 'routes', 'r1');
    expect(component.formData()).toMatchObject({ name: '路由一' });
  });

  it('复制时同样读详情回填（否则复制出来的就是一张空表单）', () => {
    /** 被测弹窗与替身 */
    const { component, objectSrv } = componentOf('copy', 'r1');
    component.ngOnInit();
    expect(objectSrv.object).toHaveBeenCalledWith(3, 'routes', 'r1');
    expect(component.formData()).toMatchObject({ name: '路由一' });
  });

  it('复制走新建接口，编辑走更新接口', () => {
    /** 复制态 */
    const copy = componentOf('copy', 'r1');
    copy.component.ngOnInit();
    copy.component.save({ name: '路由副本' });
    expect(copy.objectSrv.create).toHaveBeenCalledWith(3, 'routes', { name: '路由副本' });
    expect(copy.objectSrv.update).not.toHaveBeenCalled();

    /** 编辑态 */
    const edit = componentOf('edit', 'r1');
    edit.component.ngOnInit();
    edit.component.save({ name: '路由改名' });
    expect(edit.objectSrv.update).toHaveBeenCalledWith(3, 'routes', 'r1', { name: '路由改名' });
    expect(edit.objectSrv.create).not.toHaveBeenCalled();
  });

  it('保存成功后关闭弹窗并回传 true（列表据此刷新）', () => {
    /** 被测弹窗与替身 */
    const { component, modalRef } = componentOf('add');
    component.ngOnInit();
    component.save({ name: '新路由' });
    expect(modalRef.close).toHaveBeenCalledWith(true);
    expect(component.saving()).toBe(false);
  });

  it('详情取不到时提示并关闭弹窗（不留一张空白表单）', () => {
    /** 被测弹窗与替身 */
    const { component, modalRef, msgSrv } = componentOf('edit', 'r1', new Error('网关 404'));
    component.ngOnInit();
    expect(msgSrv.error).toHaveBeenCalled();
    expect(modalRef.close).toHaveBeenCalledWith(false);
  });

  it('保存失败时提示、保持弹窗打开、复位提交中标记', () => {
    /** 被测弹窗与替身 */
    const { component, modalRef, msgSrv } = componentOf(
      'add',
      undefined,
      undefined,
      new Error('422'),
    );
    component.ngOnInit();
    component.save({ name: '新路由' });
    expect(msgSrv.error).toHaveBeenCalled();
    expect(modalRef.close).not.toHaveBeenCalled();
    expect(component.saving()).toBe(false);
  });

  it('提交按钮文案随动作变化', () => {
    expect(componentOf('add').component.submitText).toBe('创建');
    expect(componentOf('edit', 'r1').component.submitText).toBe('保存');
    expect(componentOf('copy', 'r1').component.submitText).toBe('另存为');
  });

  it('compact 只丢 undefined，保留 null（Kong 用 null 解绑关联对象）', () => {
    /** 被测弹窗 */
    const { component } = componentOf('add');
    expect(component.compactOf({ a: 1, b: undefined, c: null, d: false })).toEqual({
      a: 1,
      c: null,
      d: false,
    });
  });
});
