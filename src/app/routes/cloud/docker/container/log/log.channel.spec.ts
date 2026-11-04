import { io } from 'socket.io-client';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { DockerLogChannel, type DockerLogChannelHandlers } from './log.channel';

vi.mock('socket.io-client', () => ({ io: vi.fn() }));

/** io 的替身 */
const ioMock = vi.mocked(io);

/** socket 替身 */
interface FakeSocket {
  /** 注册事件 */
  on: Mock;
  /** 发送事件 */
  emit: Mock;
  /** 清空监听 */
  removeAllListeners: Mock;
  /** 断开连接 */
  disconnect: Mock;
  /** 连接状态 */
  connected: boolean;
  /** 已注册的事件表，注：测试里手动触发用 */
  handlers: Map<string, (...args: unknown[]) => void>;
}

/** 回调替身 */
type FakeHandlers = { [K in keyof DockerLogChannelHandlers]: Mock };

/**
 * 造 socket 替身
 *
 * @returns socket 替身
 */
function socketOf(): FakeSocket {
  /** 事件处理表 */
  const handlers = new Map<string, (...args: unknown[]) => void>();
  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
    }),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
    handlers,
  };
}

/**
 * 造回调替身
 *
 * @returns 回调集合
 */
function handlersOf(): FakeHandlers {
  return {
    onLines: vi.fn(),
    onEnded: vi.fn(),
    onError: vi.fn(),
    onStatus: vi.fn(),
  };
}

beforeEach(() => {
  ioMock.mockReset();
});

describe('DockerLogChannel', () => {
  it('连的是 api 的 /docker-log 命名空间，并显式带上令牌与后端源', () => {
    /** socket */
    const socket = socketOf();
    ioMock.mockReturnValue(socket as never);
    /** 通道 */
    const channel = new DockerLogChannel();
    channel.connect({
      origin: 'http://api.lan:3000',
      token: 'T',
      ...handlersOf(),
    });
    expect(ioMock).toHaveBeenCalledWith('http://api.lan:3000/docker-log', {
      auth: { token: 'T' },
      reconnection: false,
      transports: ['websocket'],
    });
  });

  it('状态随 connect / disconnect 变化，且先报 connecting', () => {
    /** socket */
    const socket = socketOf();
    ioMock.mockReturnValue(socket as never);
    /** 回调 */
    const handlers = handlersOf();
    /** 通道 */
    const channel = new DockerLogChannel();
    channel.connect({ origin: 'o', token: 'T', ...handlers });
    expect(handlers.onStatus).toHaveBeenCalledWith('connecting');
    socket.handlers.get('connect')?.();
    expect(handlers.onStatus).toHaveBeenCalledWith('open');
    socket.handlers.get('disconnect')?.();
    expect(handlers.onStatus).toHaveBeenCalledWith('closed');
  });

  it('output 事件把行与 truncated 一起交给上层，缺字段时兜底', () => {
    /** socket */
    const socket = socketOf();
    ioMock.mockReturnValue(socket as never);
    /** 回调 */
    const handlers = handlersOf();
    /** 通道 */
    const channel = new DockerLogChannel();
    channel.connect({ origin: 'o', token: 'T', ...handlers });

    socket.handlers.get('output')?.({ lines: [{ ts: '', stream: 'stdout', text: 'a' }] });
    expect(handlers.onLines).toHaveBeenCalledWith([{ ts: '', stream: 'stdout', text: 'a' }], false);

    socket.handlers.get('output')?.({ lines: [], truncated: true });
    expect(handlers.onLines).toHaveBeenLastCalledWith([], true);

    socket.handlers.get('output')?.(undefined);
    expect(handlers.onLines).toHaveBeenLastCalledWith([], false);
  });

  it('ended 带上原因，缺省按容器停止处理', () => {
    /** socket */
    const socket = socketOf();
    ioMock.mockReturnValue(socket as never);
    /** 回调 */
    const handlers = handlersOf();
    /** 通道 */
    const channel = new DockerLogChannel();
    channel.connect({ origin: 'o', token: 'T', ...handlers });
    socket.handlers.get('ended')?.({ reason: 'expired' });
    expect(handlers.onEnded).toHaveBeenCalledWith('expired');
    socket.handlers.get('ended')?.(undefined);
    expect(handlers.onEnded).toHaveBeenLastCalledWith('container-stopped');
  });

  it('服务端 error 与握手失败都走 onError', () => {
    /** socket */
    const socket = socketOf();
    ioMock.mockReturnValue(socket as never);
    /** 回调 */
    const handlers = handlersOf();
    /** 通道 */
    const channel = new DockerLogChannel();
    channel.connect({ origin: 'o', token: 'T', ...handlers });
    socket.handlers.get('error')?.({ code: 'LIMIT_EXCEEDED', message: '太多' });
    expect(handlers.onError).toHaveBeenCalledWith({
      code: 'LIMIT_EXCEEDED',
      message: '太多',
    });
    socket.handlers.get('connect_error')?.();
    expect(handlers.onError).toHaveBeenLastCalledWith({
      code: 'HOST_UNREACHABLE',
      message: expect.stringContaining('后端服务'),
    });
  });

  it('open 通过 ack 返回结果，未连接时给可读错误', async () => {
    /** socket */
    const socket = socketOf();
    ioMock.mockReturnValue(socket as never);
    /** 通道 */
    const channel = new DockerLogChannel();
    expect(await channel.open({ dockerId: 1, containerId: 'abc' })).toMatchObject({
      code: 'UNAUTHORIZED',
    });

    channel.connect({ origin: 'o', token: 'T', ...handlersOf() });
    socket.emit.mockImplementation(
      (_event: string, _payload: unknown, callback: (value: unknown) => void) =>
        callback({ sessionId: 's1' }),
    );
    expect(await channel.open({ dockerId: 1, containerId: 'abc' })).toEqual({
      sessionId: 's1',
    });
  });

  it('后端 ack 为空时兜底成 UNKNOWN', async () => {
    /** socket */
    const socket = socketOf();
    ioMock.mockReturnValue(socket as never);
    /** 通道 */
    const channel = new DockerLogChannel();
    channel.connect({ origin: 'o', token: 'T', ...handlersOf() });
    socket.emit.mockImplementation(
      (_event: string, _payload: unknown, callback: (value: unknown) => void) =>
        callback(undefined),
    );
    expect(await channel.open({ dockerId: 1, containerId: 'abc' })).toMatchObject({
      code: 'UNKNOWN',
    });
  });

  it('close 先发 close 事件再断开，并清掉监听', () => {
    /** socket */
    const socket = socketOf();
    ioMock.mockReturnValue(socket as never);
    /** 通道 */
    const channel = new DockerLogChannel();
    channel.connect({ origin: 'o', token: 'T', ...handlersOf() });
    channel.close();
    expect(socket.emit).toHaveBeenCalledWith('close');
    expect(socket.removeAllListeners).toHaveBeenCalled();
    expect(socket.disconnect).toHaveBeenCalled();
    expect(channel.connected).toBe(false);
  });

  it('重复 connect 会先关掉旧连接（避免残留两条流）', () => {
    /** 第一个 socket */
    const first = socketOf();
    /** 第二个 socket */
    const second = socketOf();
    ioMock.mockReturnValueOnce(first as never).mockReturnValueOnce(second as never);
    /** 通道 */
    const channel = new DockerLogChannel();
    channel.connect({ origin: 'o', token: 'T', ...handlersOf() });
    channel.connect({ origin: 'o', token: 'T', ...handlersOf() });
    expect(first.disconnect).toHaveBeenCalled();
  });
});
