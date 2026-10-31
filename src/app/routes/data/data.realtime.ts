import { Injectable } from '@angular/core';
import { io, type Socket } from 'socket.io-client';

/** 信号载荷（不含任何业务数值） */
export interface DataChangedSignal {
  /** 变化原因 */
  reason: 'enqueue' | 'progress' | 'finish' | 'pause' | 'recover';
  /** 发生时刻（Unix 毫秒） */
  at: number;
}

/**
 * 行情数据实时通道（socket.io 信号式）
 *
 * 注：只收「变了」信号，收到后由 `data.store` 走 HTTP 快照拉真实数值。
 */
@Injectable({ providedIn: 'root' })
export class DataRealtime {
  private socket: Socket | null = null;

  /**
   * 连接并订阅信号
   *
   * @param onChange 收到信号时的回调
   */
  connect(onChange: (reason: DataChangedSignal['reason']) => void): void {
    if (this.socket !== null) {
      return;
    }
    this.socket = io({ autoConnect: true });
    this.socket.on('data:changed', (signal: DataChangedSignal) => {
      onChange(signal.reason);
    });
  }

  /** 断开连接 */
  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}
