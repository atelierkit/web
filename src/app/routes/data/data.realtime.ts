import { Injectable } from '@angular/core';
import { io, type Socket } from 'socket.io-client';

/** 信号载荷（不含任何业务数值） */
export interface DataChangedSignal {
  /** 变化原因 */
  reason: 'enqueue' | 'progress' | 'finish' | 'pause' | 'recover';
  /** 发生时刻（Unix 毫秒） */
  at: number;
}

/** 连接回调 */
export interface DataRealtimeHandlers {
  /** 收到「变了」信号 */
  onChange: (reason: DataChangedSignal['reason']) => void;
  /** 通道可用性变化（true = 已连上；false = 握手失败或连接断开） */
  onStatus?: (live: boolean) => void;
}

/**
 * 行情数据实时通道（socket.io 信号式）
 *
 * 注：只收「变了」信号，收到后由 `data.store` 走 HTTP 快照拉真实数值。
 * ⚠ 必须显式传后端地址：socket 不走 HTTP 拦截器，`io()` 空参会连到**前端页面源**
 * （dev 是 `:4200`、生产是 nginx 的 `:80`），而 api 在另一个端口 —— 握手必然失败且静默。
 */
@Injectable({ providedIn: 'root' })
export class DataRealtime {
  private socket: Socket | null = null;

  /**
   * 连接并订阅信号
   *
   * @param url 后端源（形如 `http://host:3000`），由 `apiOriginOf` 从 baseUrl 推导
   * @param handlers 信号与连接状态回调
   */
  connect(url: string, handlers: DataRealtimeHandlers): void {
    if (this.socket !== null) {
      return;
    }
    this.socket = io(url, { autoConnect: true });
    this.socket.on('data:changed', (signal: DataChangedSignal) => {
      handlers.onChange(signal.reason);
    });
    this.socket.on('connect', () => handlers.onStatus?.(true));
    this.socket.on('disconnect', () => handlers.onStatus?.(false));
    this.socket.on('connect_error', () => handlers.onStatus?.(false));
  }

  /** 断开连接 */
  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}
