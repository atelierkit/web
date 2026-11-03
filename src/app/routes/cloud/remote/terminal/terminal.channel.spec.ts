import { beforeEach, describe, expect, it, vi } from 'vitest';

/** socket 替身与 io 替身，注：`vi.hoisted` 是必需的 —— `vi.mock` 的工厂会被提升到文件顶部 */
const { ioMock, socketMock } = vi.hoisted(() => {
  /** socket 替身 */
  const socketMock = {
    connected: true,
    on: vi.fn(),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
    disconnect: vi.fn(),
  };
  return { ioMock: vi.fn(() => socketMock), socketMock };
});

vi.mock('socket.io-client', () => ({ io: ioMock }));

// 注：必须在 mock 之后导入被测类
import { TerminalChannel, type TerminalOptions } from './terminal.channel';

/**
 * 取注册在某个事件上的回调
 *
 * @param event 事件名
 * @returns 回调
 */
function handlerOf(event: string): (...args: unknown[]) => void {
  /** 注册记录 */
  const call = socketMock.on.mock.calls.find((item) => (item as unknown[])[0] === event);
  if (call === undefined) {
    throw new Error(`没有注册 ${event} 事件的回调。`);
  }
  return (call as unknown[])[1] as (...args: unknown[]) => void;
}

/**
 * 组装建连参数
 *
 * @returns 参数与各回调替身
 */
function optionsOf(): {
  handlers: {
    onOutput: ReturnType<typeof vi.fn>;
    onExit: ReturnType<typeof vi.fn>;
    onError: ReturnType<typeof vi.fn>;
    onStatus: ReturnType<typeof vi.fn>;
  };
  options: TerminalOptions;
} {
  /** 回调替身 */
  const handlers = {
    onOutput: vi.fn(),
    onExit: vi.fn(),
    onError: vi.fn(),
    onStatus: vi.fn(),
  };
  return { handlers, options: { origin: 'http://192.0.2.10:3000', token: '7:abc', ...handlers } };
}

beforeEach(() => {
  ioMock.mockClear();
  socketMock.on.mockClear();
  socketMock.emit.mockReset();
  socketMock.removeAllListeners.mockClear();
  socketMock.disconnect.mockClear();
  socketMock.connected = true;
});

describe('TerminalChannel 建连', () => {
  it('连的是后端的 /remote 命名空间，并显式带上后端源与令牌', () => {
    /** 通道 */
    const channel = new TerminalChannel();
    channel.connect(optionsOf().options);
    expect(ioMock).toHaveBeenCalledWith(
      'http://192.0.2.10:3000/remote',
      expect.objectContaining({
        auth: { token: '7:abc' },
        // 注：关掉自动重连，否则网络抖动会连出多条残留会话
        reconnection: false,
      }),
    );
  });

  it('连上 / 断开 / 出错都回传给调用方', () => {
    /** 参数 */
    const { handlers, options } = optionsOf();
    /** 通道 */
    const channel = new TerminalChannel();
    channel.connect(options);
    handlerOf('connect')();
    expect(handlers.onStatus).toHaveBeenCalledWith('open');
    handlerOf('disconnect')();
    expect(handlers.onStatus).toHaveBeenCalledWith('closed');
    handlerOf('connect_error')();
    expect(handlers.onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'HOST_UNREACHABLE' }),
    );
  });

  it('输出 / 退出 / 错误事件原样转交（字节不做任何加工）', () => {
    /** 参数 */
    const { handlers, options } = optionsOf();
    /** 通道 */
    const channel = new TerminalChannel();
    channel.connect(options);
    /** 一段字节 */
    const bytes = new Uint8Array([0x1b, 0x5b, 0x41]).buffer;
    handlerOf('output')(bytes);
    expect(handlers.onOutput).toHaveBeenCalledWith(bytes);
    handlerOf('exit')({ code: 0, signal: '', reason: '通道已关闭' });
    expect(handlers.onExit).toHaveBeenCalledWith({
      code: 0,
      signal: '',
      reason: '通道已关闭',
    });
    handlerOf('error')({ code: 'AUTH_FAILED', message: '认证失败' });
    expect(handlers.onError).toHaveBeenCalledWith({
      code: 'AUTH_FAILED',
      message: '认证失败',
    });
  });

  it('重复建连会先关掉旧连接（不留下残连）', () => {
    /** 通道 */
    const channel = new TerminalChannel();
    channel.connect(optionsOf().options);
    channel.connect(optionsOf().options);
    expect(socketMock.disconnect).toHaveBeenCalledTimes(1);
  });
});

describe('TerminalChannel 打开会话', () => {
  it('票据通过 open 事件发出去，结果由 ack 返回', async () => {
    socketMock.emit.mockImplementation(
      (event: string, _payload: unknown, ack?: (result: unknown) => void) => {
        if (event === 'open' && ack) {
          ack({ sessionId: 'sock-1' });
        }
        return true;
      },
    );
    /** 通道 */
    const channel = new TerminalChannel();
    channel.connect(optionsOf().options);
    expect(await channel.open('ticket-1')).toEqual({ sessionId: 'sock-1' });
    expect(socketMock.emit).toHaveBeenCalledWith(
      'open',
      { ticket: 'ticket-1' },
      expect.any(Function),
    );
  });

  it('后端返回错误码时照实转交（前端据此给「去信任 / 重连」）', async () => {
    socketMock.emit.mockImplementation(
      (event: string, _payload: unknown, ack?: (result: unknown) => void) => {
        if (event === 'open' && ack) {
          ack({ code: 'HOST_KEY_CHANGED', message: '指纹变了' });
        }
        return true;
      },
    );
    /** 通道 */
    const channel = new TerminalChannel();
    channel.connect(optionsOf().options);
    expect(await channel.open('ticket-1')).toEqual({
      code: 'HOST_KEY_CHANGED',
      message: '指纹变了',
    });
  });

  it('尚未建连时直接返回错误，不去碰 socket', async () => {
    /** 通道 */
    const channel = new TerminalChannel();
    expect(await channel.open('ticket-1')).toMatchObject({
      code: 'TICKET_INVALID',
    });
  });
});

describe('TerminalChannel 输入与尺寸', () => {
  it('输入按 UTF-8 编码后发出', () => {
    /** 通道 */
    const channel = new TerminalChannel();
    channel.connect(optionsOf().options);
    channel.send('ls\n');
    /** 载荷 */
    const payload = socketMock.emit.mock.calls[0]?.[1] as Uint8Array;
    expect(Array.from(payload)).toEqual(Array.from(new TextEncoder().encode('ls\n')));
  });

  it('长文本按 4 KB 分片（超过单帧上限会被整帧拒收）', () => {
    /** 通道 */
    const channel = new TerminalChannel();
    channel.connect(optionsOf().options);
    channel.send('a'.repeat(9000));
    expect(socketMock.emit).toHaveBeenCalledTimes(3);
    /** 各片字符数 */
    const sizes = socketMock.emit.mock.calls.map(
      (call) => ((call as unknown[])[1] as Uint8Array).length,
    );
    expect(sizes).toEqual([4096, 4096, 808]);
  });

  it('空输入不发送', () => {
    /** 通道 */
    const channel = new TerminalChannel();
    channel.connect(optionsOf().options);
    channel.send('');
    expect(socketMock.emit).not.toHaveBeenCalled();
  });

  it('尺寸变化发 resize', () => {
    /** 通道 */
    const channel = new TerminalChannel();
    channel.connect(optionsOf().options);
    channel.resize(120, 40);
    expect(socketMock.emit).toHaveBeenCalledWith('resize', { cols: 120, rows: 40 });
  });

  it('关闭时先发 close 再断开，并摘掉监听（避免回调打到已销毁的组件）', () => {
    /** 通道 */
    const channel = new TerminalChannel();
    channel.connect(optionsOf().options);
    channel.close();
    expect(socketMock.emit).toHaveBeenCalledWith('close');
    expect(socketMock.removeAllListeners).toHaveBeenCalled();
    expect(socketMock.disconnect).toHaveBeenCalled();
    expect(channel.connected).toBe(false);
  });
});
