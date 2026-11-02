import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DataRealtime, type DataChangedSignal } from './data.realtime';

/**
 * socket.io 客户端替身
 *
 * 注：`vi.mock` 的工厂函数会被提升到 import 之前执行，里面的变量必须用 `vi.hoisted` 一起提升，
 * 否则拿到的是还没初始化的绑定（表现为 `io is not a function`）。
 */
const { socketMock, ioMock } = vi.hoisted(() => ({
  socketMock: {
    on: vi.fn(),
    disconnect: vi.fn(),
  },
  /** io() 替身：每次调用返回同一个假 socket */
  ioMock: vi.fn(),
}));

vi.mock('socket.io-client', () => ({
  io: ioMock,
}));

/** 取出注册在某个事件上的回调 */
function handlerOf(event: string): (...args: unknown[]) => void {
  const call = socketMock.on.mock.calls.find((c) => c[0] === event);
  if (!call) {
    throw new Error(`没有注册 ${event} 事件的回调。`);
  }
  return call[1] as (...args: unknown[]) => void;
}

describe('DataRealtime', () => {
  beforeEach(() => {
    ioMock.mockClear();
    ioMock.mockReturnValue(socketMock);
    socketMock.on.mockClear();
    socketMock.disconnect.mockClear();
  });

  it('connect 用显式后端地址建连（不能靠 io() 默认的页面源）', () => {
    const realtime = new DataRealtime();

    realtime.connect('http://localhost:3000', { onChange: () => undefined });

    expect(ioMock).toHaveBeenCalledTimes(1);
    // ⚠ 这条断言是本缺陷的回归守卫：空参 io() 连的是前端页面源，握手必然 404
    expect(ioMock).toHaveBeenCalledWith('http://localhost:3000', expect.anything());
    expect(socketMock.on).toHaveBeenCalledWith('data:changed', expect.any(Function));
  });

  it('收到信号时把 reason 转交给回调', () => {
    const realtime = new DataRealtime();
    /** 收到的原因 */
    const reasons: Array<DataChangedSignal['reason']> = [];

    realtime.connect('http://localhost:3000', {
      onChange: (reason: DataChangedSignal['reason']) => reasons.push(reason),
    });

    handlerOf('data:changed')({ reason: 'finish', at: Date.now() });

    expect(reasons).toEqual(['finish']);
  });

  it('连接与断开状态回传给 onStatus（store 据此决定是否兜底轮询）', () => {
    const realtime = new DataRealtime();
    /** 状态序列 */
    const states: boolean[] = [];

    realtime.connect('http://localhost:3000', {
      onChange: () => undefined,
      onStatus: (live: boolean) => states.push(live),
    });

    handlerOf('connect')();
    handlerOf('disconnect')();
    handlerOf('connect_error')(new Error('x'));

    expect(states).toEqual([true, false, false]);
  });

  it('没有传 onStatus 时收到状态事件也不报错', () => {
    const realtime = new DataRealtime();
    realtime.connect('http://localhost:3000', { onChange: () => undefined });

    expect(() => handlerOf('connect_error')(new Error('x'))).not.toThrow();
  });

  it('重复 connect 不会重复建连接', () => {
    const realtime = new DataRealtime();

    realtime.connect('http://localhost:3000', { onChange: () => undefined });
    realtime.connect('http://localhost:3000', { onChange: () => undefined });

    expect(ioMock).toHaveBeenCalledTimes(1);
  });

  it('disconnect 断开连接', () => {
    const realtime = new DataRealtime();
    realtime.connect('http://localhost:3000', { onChange: () => undefined });

    realtime.disconnect();

    expect(socketMock.disconnect).toHaveBeenCalledTimes(1);
  });

  it('未连接时 disconnect 不报错', () => {
    const realtime = new DataRealtime();

    expect(() => realtime.disconnect()).not.toThrow();
    expect(socketMock.disconnect).not.toHaveBeenCalled();
  });
});
