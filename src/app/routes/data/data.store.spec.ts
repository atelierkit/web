import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { DataRealtime } from './data.realtime';
import { DataService, type DataSnapshot } from './data.service';
import { DataStore } from './data.store';

/** 内存替身 DataService */
function makeService(snapshotResult: unknown = emptySnapshot()): {
  calls: { snapshot: number; start: number; pause: number };
  service: DataService;
} {
  const calls = { snapshot: 0, start: 0, pause: 0 };
  return {
    calls,
    service: {
      snapshot: vi.fn(() => {
        calls.snapshot++;
        return snapshotResult instanceof Error
          ? throwError(() => snapshotResult)
          : of(snapshotResult as DataSnapshot);
      }),
      start: vi.fn(() => {
        calls.start++;
        return of({ enqueued: 1, blocked: 0, note: '' });
      }),
      pause: vi.fn(() => {
        calls.pause++;
        return of({ paused: 1 });
      }),
    } as unknown as DataService,
  };
}

function emptySnapshot(): DataSnapshot {
  return { cards: [], queue: { queued: 0, running: 0 }, recent: [] };
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
    TestBed.configureTestingModule({
      providers: [
        { provide: DataService, useValue: service },
        { provide: DataRealtime, useValue: { connect: vi.fn(), disconnect: vi.fn() } },
      ],
    });
    const store = TestBed.inject(DataStore);

    store.refresh();
    expect(store.cards().length).toBe(1);
    expect(store.cards()[0].target).toBe('Calendar');
    expect(store.loading()).toBe(false);
    expect(store.failed()).toBe('');
  });

  it('快照失败时 failed 置为错误信息', () => {
    const { service } = makeService(new Error('boom'));
    TestBed.configureTestingModule({
      providers: [
        { provide: DataService, useValue: service },
        { provide: DataRealtime, useValue: { connect: vi.fn(), disconnect: vi.fn() } },
      ],
    });
    const store = TestBed.inject(DataStore);

    store.refresh();
    expect(store.failed()).toBe('boom');
    expect(store.loading()).toBe(false);
  });

  it('start 成功后触发刷新', () => {
    const { service, calls } = makeService();
    TestBed.configureTestingModule({
      providers: [
        { provide: DataService, useValue: service },
        { provide: DataRealtime, useValue: { connect: vi.fn(), disconnect: vi.fn() } },
      ],
    });
    const store = TestBed.inject(DataStore);

    store.start('BarByDate');
    expect(calls.start).toBe(1);
    // start 成功后无条件刷新（force=true）
    expect(calls.snapshot).toBe(1);
  });
});
