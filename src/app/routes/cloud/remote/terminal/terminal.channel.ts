import { io, type Socket } from 'socket.io-client';

import { chunksOf } from '../remote.format';

/** 终端连接状态 */
export type TerminalStatus = 'idle' | 'connecting' | 'open' | 'closed';

/** 终端错误 */
export interface TerminalError {
  /** 错误码，注：见后端 `REMOTE_ERROR_CODES` */
  code: string;
  /** 可读文案 */
  message: string;
}

/** 终端退出 */
export interface TerminalExit {
  /** 退出码 */
  code: number;
  /** 信号 */
  signal: string;
  /** 原因 */
  reason: string;
}

/** 事件回调 */
export interface TerminalHandlers {
  /**
   * 收到输出字节
   *
   * @param data 原始字节，注：解码（含 charset 与流式）由调用方负责
   */
  onOutput: (data: ArrayBuffer) => void;
  /**
   * 通道退出
   *
   * @param exit 退出信息
   */
  onExit: (exit: TerminalExit) => void;
  /**
   * 发生错误
   *
   * @param error 错误
   */
  onError: (error: TerminalError) => void;
  /**
   * 连接状态变化
   *
   * @param status 状态
   */
  onStatus: (status: TerminalStatus) => void;
}

/** 建连参数 */
export interface TerminalOptions extends TerminalHandlers {
  /** 后端源，如 `http://192.168.1.3:80` */
  origin: string;
  /** 登录令牌，注：WS 不走 HTTP 拦截器，必须显式带上 */
  token: string;
}

/** 打开终端的结果 */
export interface TerminalOpenResult {
  /** 会话标识，成功时存在 */
  sessionId?: string;
  /** 错误码，失败时存在 */
  code?: string;
  /** 错误文案，失败时存在 */
  message?: string;
}

/**
 * 终端 WebSocket 通道
 *
 * 注 1：**不直接连目标主机** —— 这里只连 api 的 `/remote` 命名空间，SSH 由 api 转发；
 * 浏览器侧不含任何 SSH 协议代码，输入输出都是原始字节
 * 注 2：抽成独立类（而不是写在组件里）是为了能单测消息形状与分片规则 ——
 * 组件要装配 xterm，jsdom 下没法渲染终端
 */
export class TerminalChannel {
  /** socket 实例 */
  private socket: Socket | null = null;

  /**
   * 建立连接
   *
   * ⚠ 必须显式传后端源：socket 不走 HTTP 拦截器，`io()` 空参会连到**前端页面源**
   * （dev 是 `:4200`、生产是 nginx 的 `:80`），握手必然失败且静默
   *
   * @param options 建连参数
   */
  connect(options: TerminalOptions): void {
    this.close();
    /** 连接 */
    const socket = io(`${options.origin}/remote`, {
      auth: { token: options.token },
      // 注：关掉自动重连 —— 网络抖动时自动重连会连出多条残留会话，目标机 `who` 里看得到
      reconnection: false,
      transports: ['websocket'],
    });
    this.socket = socket;
    socket.on('connect', () => options.onStatus('open'));
    socket.on('disconnect', () => options.onStatus('closed'));
    socket.on('connect_error', () =>
      options.onError({ code: 'HOST_UNREACHABLE', message: '无法连接后端服务。' }),
    );
    socket.on('output', (data: ArrayBuffer) => options.onOutput(data));
    socket.on('exit', (exit: TerminalExit) => options.onExit(exit));
    socket.on('error', (error: TerminalError) => options.onError(error));
  }

  /**
   * 用票据换取终端会话
   *
   * @param ticket 一次性票据
   * @returns 打开结果，注：由后端 ack 返回，不抛异常
   */
  open(ticket: string): Promise<TerminalOpenResult> {
    return new Promise<TerminalOpenResult>((resolve) => {
      /** 连接 */
      const socket = this.socket;
      if (socket === null) {
        resolve({ code: 'TICKET_INVALID', message: '连接尚未建立，请重新连接。' });
        return;
      }
      socket.emit('open', { ticket }, (result: TerminalOpenResult | undefined) => {
        resolve(result ?? { code: 'UNKNOWN', message: '后端未返回结果，请重试。' });
      });
    });
  }

  /**
   * 发送键盘输入
   *
   * @param text 文本，注：按 4 KB 切片，超过 socket.io 单帧上限会被整帧拒收
   */
  send(text: string): void {
    /** 连接 */
    const socket = this.socket;
    if (socket === null || text === '') {
      return;
    }
    // 注：输入统一按 UTF-8 编码 —— 远端 PTY 按自己的 locale 解，字符集只影响「怎么显示输出」
    /** 编码器 */
    const encoder = new TextEncoder();
    for (const chunk of chunksOf(text)) {
      socket.emit('input', encoder.encode(chunk));
    }
  }

  /**
   * 调整终端尺寸
   *
   * @param cols 列数
   * @param rows 行数
   */
  resize(cols: number, rows: number): void {
    this.socket?.emit('resize', { cols, rows });
  }

  /** 关闭连接 */
  close(): void {
    /** 连接 */
    const socket = this.socket;
    this.socket = null;
    if (socket === null) {
      return;
    }
    socket.emit('close');
    socket.removeAllListeners();
    socket.disconnect();
  }

  /**
   * 当前状态是否已连接
   *
   * @returns 已连接时为 true
   */
  get connected(): boolean {
    return this.socket?.connected === true;
  }
}
