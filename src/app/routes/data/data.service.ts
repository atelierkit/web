import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import type { DataCard, DataState, DataTarget } from './data.format';

/** 快照结果（后端 `data/sync/snapshot`） */
export interface DataSnapshot {
  /** 四卡汇总 */
  cards: DataCard[];
  /** 队列计数 */
  queue: { queued: number; running: number };
  /** 最近活跃执行 */
  recent: RecentRun[];
}

/** 最近执行的一行 */
export interface RecentRun {
  /** 执行号 */
  id: number;
  /** 目标 */
  target: DataTarget;
  /** 状态 */
  state: DataState;
  /** 阶段 */
  stage: string;
  /** 已完成 */
  done: number;
  /** 总量（0 表示未知） */
  total: number;
}

/** 发起/暂停同步的入参 */
export interface SyncActionPayload {
  /** 目标 */
  target: DataTarget;
}

/** 发起同步的结果 */
export interface SyncStartResult {
  /** 入队条数 */
  enqueued: number;
  /** 被挡下的条数 */
  blocked: number;
  /** 说明 */
  note: string;
}

/** 暂停结果 */
export interface SyncPauseResult {
  /** 暂停的执行数 */
  paused: number;
}

/** 证券清单一行 */
export interface SecurityRow {
  code: string;
  name: string;
  type: string;
  market: string;
  listDate: string | null;
  status: string;
  delistDate: string | null;
}

/** 证券分页结果 */
export interface SecurityPageResult {
  rows: SecurityRow[];
  total: number;
  marketTotal: number;
}

/** 证券查询条件 */
export interface SecurityQuery {
  keyword?: string;
  type?: string;
  market?: string;
  sort?: string;
  page?: number;
  size?: number;
}

/** 日历日 */
export interface CalendarDay {
  calendarDate: string;
  isOpen: boolean;
}

/** K 线一行 */
export interface BarRow {
  date: string;
  open: string | null;
  high: string | null;
  low: string | null;
  close: string | null;
  changePercent: string | null;
  volume: string;
  amount: string | null;
  turnoverRate: string | null;
  tradeStatus: string;
}

/** K 线分页结果 */
export interface BarPageResult {
  rows: BarRow[];
  total: number;
  truncated: boolean;
}

/**
 * 行情数据服务（同步 / 快照 / 证券 / 日历 / 日线）
 *
 * 注：写操作（start / pause）后端按 `@Allow('admin')` 校验；快照与查询只读，登录即可。
 */
@Injectable({ providedIn: 'root' })
export class DataService {
  private readonly http = inject(HttpClient);

  /** 同步快照（四卡 + 进度 + 队列） */
  snapshot(): Observable<DataSnapshot> {
    return this.http.get<DataSnapshot>('data/sync/snapshot');
  }

  /** 发起同步（从台账断点续） */
  start(target: DataTarget): Observable<SyncStartResult> {
    return this.http.post<SyncStartResult>('data/sync/start', {
      target,
    } satisfies SyncActionPayload);
  }

  /** 暂停该目标所有 Running 的执行 */
  pause(target: DataTarget): Observable<SyncPauseResult> {
    return this.http.post<SyncPauseResult>('data/sync/pause', {
      target,
    } satisfies SyncActionPayload);
  }

  /** 证券清单（服务端分页） */
  securities(query: SecurityQuery): Observable<SecurityPageResult> {
    return this.http.get<SecurityPageResult>('data/security', {
      params: query as Record<string, string | number>,
    });
  }

  /** 交易日历（一次整年） */
  calendar(year: string): Observable<CalendarDay[]> {
    return this.http.get<CalendarDay[]>('data/calendar', { params: { year } });
  }

  /** K 线（单只证券 + 日期区间） */
  bars(code: string, from: string, to: string): Observable<BarPageResult> {
    return this.http.get<BarPageResult>('data/bar', { params: { code, from, to } });
  }
}
