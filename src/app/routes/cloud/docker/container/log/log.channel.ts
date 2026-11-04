import { io, type Socket } from 'socket.io-client';

import type { DockerLogLine } from '../../object/object.types';

/** 日志通道状态 */
export type DockerLogStatus = 'idle' | 'connecting' | 'open' | 'closed';

/** 通道错误 */
export interface DockerLogChannelError {
  /** 错误码，注：见后端 `DockerLogErrorCode` */
  code: string;
  /** 可读文案 */
  message: string;
}

/** 事件回调 */
export interface DockerLogChannelHandlers {
  /**
   * 收到一批日志行
   *
   * @param lines 日志行
   * @param truncated 是否丢弃过早期数据（输出过快）
   */
  onLines: (lines: DockerLogLine[], truncated: boolean) => void;
  /**
   * 流已结束
   *
   * @param reason `container-stopped` / `expired` / `closed`
   */
  onEnded: (reason: string) => void;
  /**
   * 发生错误
   *
   * @param error 错误
   */
  onError: (error: DockerLogChannelError) => void;
  /**
   * 连接状态变化
   *
   * @param status 状态
   */
  onStatus: (status: DockerLogStatus) => void;
}

/** 建连参数 */
export interface DockerLogChannelOptions extends DockerLogChannelHandlers {
  /** 后端源，如 `http://192.168.1.3:3000` */
  origin: string;
  /** 登录令牌，注：WS 不走 HTTP 拦截器，必须显式带上 */
  token: string;
}

/** 打开日志流的参数 */
export interface DockerLogOpenPayload {
  /** 宿主机ID */
  dockerId: number;
  /** 容器ID */
  containerId: string;
  /** 先补多少历史行，注：跟随通常传 0（历史由快照接口给） */
  tail?: number;
  /** 起始时刻，注：暂停后恢复用它补断档 */
  since?: string;
}

/** 打开结果 */
export interface DockerLogOpenResult {
  /** 会话标识，成功时存在 */
  sessionId?: string;
  /** 错误码，失败时存在 */
  code?: string;
  /** 错误文案，失败时存在 */
  message?: string;
}

/**
 * 容器日志 WebSocket 通道
 *
 * 注 1：**不直接连宿主机** —— 这里只连 api 的 `/docker-log` 命名空间，Docker daemon
 * 的请求与解帧全在 api 侧；浏览器只收结构化行
 * 注 2：抽成独立类（而不是写在组件里）是为了能单测消息形状 —— 组件要装配抽屉与滚动逻辑，
 * 在测试环境里跑不出真实交互
 * 注 3：与终端一致**关掉自动重连**：重连会重复拉流，由 UI 提供显式「重新连接」
 */
export class DockerLogChannel {
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
  connect(options: DockerLogChannelOptions): void {
    this.close();
    options.onStatus('connecting');
    /** 连接 */
    const socket = io(`${options.origin}/docker-log`, {
      auth: { token: options.token },
      reconnection: false,
      transports: ['websocket'],
    });
    this.socket = socket;
    socket.on('connect', () => options.onStatus('open'));
    socket.on('disconnect', () => options.onStatus('closed'));
    socket.on('connect_error', () =>
      options.onError({
        code: 'HOST_UNREACHABLE',
        message: '无法连接后端服务，日志流未建立。',
      }),
    );
    socket.on('output', (payload: { lines?: DockerLogLine[]; truncated?: boolean } | undefined) =>
      options.onLines(payload?.lines ?? [], payload?.truncated === true),
    );
    socket.on('ended', (payload: { reason?: string } | undefined) =>
      options.onEnded(payload?.reason ?? 'container-stopped'),
    );
    socket.on('error', (error: DockerLogChannelError) => options.onError(error));
  }

  /**
   * 开始跟随
   *
   * @param payload 宿主机、容器与起始位置
   * @returns 打开结果，注：由后端 ack 返回，不抛异常
   */
  open(payload: DockerLogOpenPayload): Promise<DockerLogOpenResult> {
    return new Promise<DockerLogOpenResult>((resolve) => {
      /** 连接 */
      const socket = this.socket;
      if (socket === null) {
        resolve({ code: 'UNAUTHORIZED', message: '连接尚未建立，请重试。' });
        return;
      }
      socket.emit('open', payload, (result: DockerLogOpenResult | undefined) => {
        resolve(result ?? { code: 'UNKNOWN', message: '后端未返回结果，请重试。' });
      });
    });
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
