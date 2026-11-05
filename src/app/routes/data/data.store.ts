import { Injectable, computed, inject, signal } from '@angular/core';
import { apiOriginOf } from '@core';
import { SettingsService } from '@delon/theme';

import { type DataCard } from './data.format';
import { DataRealtime } from './data.realtime';
import { DataService, type DataSnapshot } from './data.service';

/** 快照节流窗口（毫秒）：信号密集时最多一秒拉一次 */
const THROTTLE_MS = 1000;
/** 实时通道不可用时的兜底轮询间隔（毫秒） */
const FALLBACK_MS = 5000;
/** 心跳节拍（毫秒）：补节流窗口的尾包 + 驱动兜底轮询 */
const TICK_MS = 1000;

/**
 * 行情数据状态源（`providedIn: 'root'` 单例）
 *
 * ⚠ 仪表板与同步页必须共用这一个 store —— 页面里不得各自调 `data/sync/snapshot`，
 * 否则就是「第二份镜像」，两页迟早显示不同的数。
 *
 * ⚠ 刷新有两条通路，缺一不可：
 * ① 实时通道（socket.io 信号）—— 正常路径；
 * ② 兜底轮询（通道不可用时每 5s 一次）—— 保证「后端在跑、页面不动」不会静默发生。
 *    只有 ① 时，一旦握手失败（地址、CORS、代理任一处不对），界面就永远停在首屏那一次快照上。
 */
@Injectable({ providedIn: 'root' })
export class DataStore {
  private readonly dataSrv = inject(DataService);
  private readonly realtime = inject(DataRealtime);
  private readonly settings = inject(SettingsService);

  /** 快照 */
  private readonly snapshot = signal<DataSnapshot | null>(null);
  /** 加载标记 */
  readonly loading = signal(false);
  /** 失败原因，空串表示没失败 */
  readonly failed = signal('');
  /** 操作回执（发起 / 暂停的结果说明），空串表示没有 */
  readonly notice = signal('');
  /** 实时通道是否可用（false 时页面靠兜底轮询，界面给出提示） */
  readonly realtimeLive = signal(true);

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
  /** 请求序号：只接受「最后发起」的那次响应，避免旧快照覆盖新快照 */
  private seq = 0;
  /** 有信号到达但被节流挡下（尾包待补） */
  private dirty = false;
  /** 心跳定时器 */
  private ticker: ReturnType<typeof setInterval> | null = null;

  /**
   * 拉取快照（节流：同一秒内不重复请求，但被挡下的那次会在窗口结束时补上）
   *
   * @param force 是否无视节流强制刷新（终态用）
   */
  refresh(force = false): void {
    const now = Date.now();
    if (!force && now - this.lastFetchAt < THROTTLE_MS) {
      // ⚠ 不能直接丢弃：丢掉的就是「这一批的最后一条」，界面会停在倒数第二个状态
      this.dirty = true;
      return;
    }
    this.dirty = false;
    this.lastFetchAt = now;
    const seq = ++this.seq;
    this.loading.set(true);
    this.failed.set('');
    this.dataSrv.snapshot().subscribe({
      next: (res) => {
        // 请求乱序时，慢的那次可能后到；丢弃过期响应，否则进度会往回跳
        if (seq !== this.seq) {
          return;
        }
        this.snapshot.set(res);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        if (seq !== this.seq) {
          return;
        }
        this.loading.set(false);
        this.failed.set(this.messageOf(err));
      },
    });
  }

  /**
   * 建立实时连接（收到「变了」信号就刷新）
   *
   * 频率闸门 1s、终态无条件刷新由 `refresh` 内部节流承担。
   */
  connect(): void {
    if (this.connected) {
      return;
    }
    this.connected = true;

    const origin = apiOriginOf(
      this.settings.getData('baseUrl') as string | undefined,
      location.href,
    );
    if (origin !== null) {
      this.realtime.connect(origin, {
        onChange: (reason) => {
          // 终态（finish / pause）无条件刷新；进度信号走节流
          this.refresh(reason === 'finish' || reason === 'pause' || reason === 'recover');
        },
        onStatus: (live) => {
          this.realtimeLive.set(live);
          // 刚连上时补一次，断线重连后也能立刻对齐
          if (live) {
            this.refresh(true);
          }
        },
      });
    }

    this.refresh();
    this.startTicker();

    if (origin === null) {
      // ⚠ 必须放在 refresh() 之后：refresh 会清空 failed（那是「本次请求开始」的标记）
      // 配置缺失时明确报错：宁可见红，也不要假装实时通道在工作
      this.realtimeLive.set(false);
      this.failed.set('未配置有效后端地址，实时通道不可用，页面已改为定时刷新。');
    }
  }

  /** 发起同步（成功后立即刷快照，并把后端说明回显给用户） */
  start(target: Parameters<DataService['start']>[0]): void {
    this.notice.set('');
    this.dataSrv.start(target).subscribe({
      next: (res) => {
        this.notice.set(res.note || `已入队 ${res.enqueued} 条执行。`);
        this.refresh(true);
      },
      error: (err: unknown) => this.failed.set(this.messageOf(err)),
    });
  }

  /** 暂停（成功后立即刷快照，并把结果回显给用户） */
  pause(target: Parameters<DataService['pause']>[0]): void {
    this.notice.set('');
    this.dataSrv.pause(target).subscribe({
      next: (res) => {
        this.notice.set(
          res.paused > 0
            ? `已暂停 ${res.paused} 条执行。`
            : '当前没有正在执行的任务（排队中的执行不受暂停影响）。',
        );
        this.refresh(true);
      },
      error: (err: unknown) => this.failed.set(this.messageOf(err)),
    });
  }

  /** 关闭操作回执 */
  closeNotice(): void {
    this.notice.set('');
  }

  /** 心跳：补节流尾包；实时通道不可用时退化为定时轮询 */
  private startTicker(): void {
    if (this.ticker !== null) {
      return;
    }
    this.ticker = setInterval(() => {
      const now = Date.now();
      if (now - this.lastFetchAt < THROTTLE_MS) {
        return;
      }
      if (this.dirty) {
        this.refresh(true);
        return;
      }
      if (!this.realtimeLive() && now - this.lastFetchAt >= FALLBACK_MS) {
        this.refresh(true);
      }
    }, TICK_MS);
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
