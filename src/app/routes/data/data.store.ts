import { Injectable, computed, inject, signal } from '@angular/core';

import type { DataCard } from './data.format';
import { DataRealtime } from './data.realtime';
import { DataService, type DataSnapshot } from './data.service';

/**
 * 行情数据状态源（`providedIn: 'root'` 单例）
 *
 * ⚠ 仪表板与同步页必须共用这一个 store —— 页面里不得各自调 `data/sync/snapshot`，
 * 否则就是「第二份镜像」，两页迟早显示不同的数（almanac 桌面端同一条约束）。
 */
@Injectable({ providedIn: 'root' })
export class DataStore {
  private readonly dataSrv = inject(DataService);
  private readonly realtime = inject(DataRealtime);

  /** 快照 */
  private readonly snapshot = signal<DataSnapshot | null>(null);
  /** 加载标记 */
  readonly loading = signal(false);
  /** 失败原因，空串表示没失败 */
  readonly failed = signal('');

  /** 四卡 */
  readonly cards = computed<DataCard[]>(() => this.snapshot()?.cards ?? []);
  /** 队列计数 */
  readonly queue = computed(() => this.snapshot()?.queue ?? { queued: 0, running: 0 });
  /** 最近执行 */
  readonly recent = computed(() => this.snapshot()?.recent ?? []);

  /** 实时连接是否已建立 */
  private connected = false;
  /** 上次快照的时间戳（频率闸门用） */
  private lastFetchAt = 0;

  /**
   * 拉取快照（节流：同一秒内不重复请求）
   *
   * @param force 是否无视节流强制刷新（终态用）
   */
  refresh(force = false): void {
    const now = Date.now();
    if (!force && now - this.lastFetchAt < 1000) {
      return;
    }
    this.lastFetchAt = now;
    this.loading.set(true);
    this.failed.set('');
    this.dataSrv.snapshot().subscribe({
      next: (res) => {
        this.snapshot.set(res);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.failed.set(this.messageOf(err));
      },
    });
  }

  /**
   * 建立实时连接（收到「变了」信号就刷新）
   *
   * 频率闸门 1s、终态无条件刷新由 `refresh` 内部节流承担；终态广播带 RunId/TaskId，
   * 这里统一按「有信号就刷」处理，再由节流兜底。
   */
  connect(): void {
    if (this.connected) {
      return;
    }
    this.connected = true;
    this.realtime.connect((reason) => {
      // 终态（finish / pause）无条件刷新；进度信号走节流
      this.refresh(reason === 'finish' || reason === 'pause' || reason === 'recover');
    });
    this.refresh();
  }

  /** 发起同步（成功后立即刷快照） */
  start(target: Parameters<DataService['start']>[0]): void {
    this.dataSrv.start(target).subscribe({
      next: () => this.refresh(true),
      error: (err: unknown) => this.failed.set(this.messageOf(err)),
    });
  }

  /** 暂停（成功后立即刷快照） */
  pause(target: Parameters<DataService['pause']>[0]): void {
    this.dataSrv.pause(target).subscribe({
      next: () => this.refresh(true),
      error: (err: unknown) => this.failed.set(this.messageOf(err)),
    });
  }

  /** 提取错误信息 */
  private messageOf(err: unknown): string {
    if (err instanceof Error) {
      return err.message;
    }
    if (typeof err === 'object' && err !== null) {
      const body = err as { error?: { message?: string | string[] } };
      const msg = body.error?.message;
      if (Array.isArray(msg)) {
        return msg.join('；');
      }
      if (typeof msg === 'string') {
        return msg;
      }
    }
    return '请求失败，请稍后重试！';
  }
}
