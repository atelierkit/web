import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { DataRealtime, type DataChangedSignal } from './data.realtime';
import { DataService, type DataSnapshot } from './data.service';
import { DataStore } from './data.store';

/** 替身 DataService 的错误注入配置 */
interface ServiceErrors {
  /** 快照失败时的错误 */
  snapshot?: unknown;
  /** 发起同步失败时的错误 */
  start?: unknown;
  /** 暂停失败时的错误 */
  pause?: unknown;
}

/**
 * 造一个内存替身 DataService
 *
 * @param snapshotResult 快照返回值
 * @param errors 各方法的失败注入（不传即成功）
 */
function makeService(
  snapshotResult: unknown = emptySnapshot(),
  errors: ServiceErrors = {},
): {
  calls: { snapshot: number; start: number; pause: number };
  service: DataService;
} {
  const calls = { snapshot: 0, start: 0, pause: 0 };
  const has = (key: keyof ServiceErrors): boolean =>
    Object.prototype.hasOwnProperty.call(errors, key);
  return {
    calls,
    service: {
      snapshot: vi.fn(() => {
        calls.snapshot++;
        if (has('snapshot')) {
          return throwError(() => errors.snapshot);
        }
        return of(snapshotResult as DataSnapshot);
      }),
      start: vi.fn(() => {
        calls.start++;
        if (has('start')) {
          return throwError(() => errors.start);
        }
        return of({ enqueued: 1, blocked: 0, note: '' });
      }),
      pause: vi.fn(() => {
        calls.pause++;
        if (has('pause')) {
          return throwError(() => errors.pause);
        }
        return of({ paused: 1 });
      }),
    } as unknown as DataService,
  };
}

/**
 * 造一个内存替身 DataRealtime（记录 connect 调用并捕获信号回调）
 */
function makeRealtime(): {
  calls: { connect: number };
  /** 模拟服务端推来一次「数据变了」信号 */
  emit: (reason: DataChangedSignal['reason']) => void;
  service: DataRealtime;
} {
  const calls = { connect: 0 };
  let handler: ((reason: DataChangedSignal['reason']) => void) | null = null;
  return {
    calls,
    emit: (reason: DataChangedSignal['reason']) => handler?.(reason),
    service: {
      connect: vi.fn((cb: (reason: DataChangedSignal['reason']) => void) => {
        calls.connect++;
        handler = cb;
      }),
      disconnect: vi.fn(),
    } as unknown as DataRealtime,
  };
}

/** 空快照 */
function emptySnapshot(): DataSnapshot {
  return { cards: [], queue: { queued: 0, running: 0 }, recent: [] };
}

/**
 * 组装被测 store
 *
 * @param service 替身 DataService
 * @param realtime 替身 DataRealtime
 */
function storeOf(service: DataService, realtime: DataRealtime): DataStore {
  TestBed.configureTestingModule({
    providers: [
      { provide: DataService, useValue: service },
      { provide: DataRealtime, useValue: realtime },
    ],
  });
  return TestBed.inject(DataStore);
}

describe('DataStore', () => {
  it('refresh 拉快照并填充 cards', () => {
    const { service } = makeService({
      cards: [
        {
          target: 'Calendar',
          displayName: '交易日历',
          lastDate: '2026-01-05',
          recordCount: 8000,
          state: 3,
        },
      ],
      queue: { queued: 0, running: 0 },
      recent: [],
    });
    const { service: realtime } = makeRealtime();
    const store = storeOf(service, realtime);

    store.refresh();
    expect(store.cards().length).toBe(1);
    expect(store.cards()[0].target).toBe('Calendar');
    expect(store.loading()).toBe(false);
    expect(store.failed()).toBe('');
  });

  it('快照失败时 failed 置为错误信息', () => {
    const { service } = makeService(undefined, { snapshot: new Error('boom') });
    const { service: realtime } = makeRealtime();
    const store = storeOf(service, realtime);

    store.refresh();
    expect(store.failed()).toBe('boom');
    expect(store.loading()).toBe(false);
  });

  it('start 成功后触发刷新', () => {
    const { service, calls } = makeService();
    const { service: realtime } = makeRealtime();
    const store = storeOf(service, realtime);

    store.start('BarByDate');
    expect(calls.start).toBe(1);
    // start 成功后无条件刷新（force=true）
    expect(calls.snapshot).toBe(1);
  });

  it('同一秒内重复 refresh 被节流', () => {
    const { service, calls } = makeService();
    const { service: realtime } = makeRealtime();
    const store = storeOf(service, realtime);

    store.refresh();
    store.refresh();
    expect(calls.snapshot).toBe(1);
  });

  it('快照未到时队列与最近执行给默认值', () => {
    const { service } = makeService();
    const { service: realtime } = makeRealtime();
    const store = storeOf(service, realtime);

    expect(store.queue()).toEqual({ queued: 0, running: 0 });
    expect(store.recent()).toEqual([]);
  });

  it('快照到达后队列与最近执行取快照里的值', () => {
    const { service } = makeService({
      cards: [],
      queue: { queued: 2, running: 1 },
      recent: [{ id: 7, target: 'Calendar', state: 3, stage: '结束', done: 10, total: 10 }],
    });
    const { service: realtime } = makeRealtime();
    const store = storeOf(service, realtime);

    store.refresh();
    expect(store.queue()).toEqual({ queued: 2, running: 1 });
    expect(store.recent().length).toBe(1);
    expect(store.recent()[0].id).toBe(7);
  });

  it('connect 建立实时连接并拉一次快照', () => {
    const { service, calls } = makeService();
    const realtime = makeRealtime();
    const store = storeOf(service, realtime.service);

    store.connect();
    expect(realtime.calls.connect).toBe(1);
    expect(calls.snapshot).toBe(1);
  });

  it('connect 重复调用只建立一次连接', () => {
    const { service } = makeService();
    const realtime = makeRealtime();
    const store = storeOf(service, realtime.service);

    store.connect();
    store.connect();
    expect(realtime.calls.connect).toBe(1);
  });

  it('进度信号走节流，终态信号强制刷新', () => {
    const { service, calls } = makeService();
    const realtime = makeRealtime();
    const store = storeOf(service, realtime.service);

    store.connect();
    expect(calls.snapshot).toBe(1);

    // 进度信号：一秒内的重复刷新被节流掉
    realtime.emit('progress');
    expect(calls.snapshot).toBe(1);

    // 终态信号：无视节流强制刷新
    realtime.emit('finish');
    expect(calls.snapshot).toBe(2);
  });

  it('start 失败时 failed 置为错误信息', () => {
    const { service } = makeService(undefined, { start: new Error('启动失败') });
    const { service: realtime } = makeRealtime();
    const store = storeOf(service, realtime);

    store.start('BarByDate');
    expect(store.failed()).toBe('启动失败');
  });

  it('pause 成功后刷新快照', () => {
    const { service, calls } = makeService();
    const { service: realtime } = makeRealtime();
    const store = storeOf(service, realtime);

    store.pause('AdjustFactor');
    expect(calls.pause).toBe(1);
    expect(calls.snapshot).toBe(1);
  });

  it('pause 失败时 failed 置为错误信息', () => {
    const { service } = makeService(undefined, { pause: new Error('暂停失败') });
    const { service: realtime } = makeRealtime();
    const store = storeOf(service, realtime);

    store.pause('AdjustFactor');
    expect(store.failed()).toBe('暂停失败');
  });

  it('错误信息的 message 是数组时用分号拼接', () => {
    const { service } = makeService(undefined, {
      start: { error: { message: ['参数错误', '目标非法'] } },
    });
    const { service: realtime } = makeRealtime();
    const store = storeOf(service, realtime);

    store.start('BarByDate');
    expect(store.failed()).toBe('参数错误；目标非法');
  });

  it('错误信息的 message 是字符串时直接取用', () => {
    const { service } = makeService(undefined, { start: { error: { message: '目标不存在' } } });
    const { service: realtime } = makeRealtime();
    const store = storeOf(service, realtime);

    store.start('BarByDate');
    expect(store.failed()).toBe('目标不存在');
  });

  it('无法识别的错误返回默认文案', () => {
    const { service } = makeService(undefined, { start: '不是对象也不是 Error' });
    const { service: realtime } = makeRealtime();
    const store = storeOf(service, realtime);

    store.start('BarByDate');
    expect(store.failed()).toBe('请求失败，请稍后重试！');
  });
});
