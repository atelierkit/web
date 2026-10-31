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

describe('DataRealtime', () => {
  beforeEach(() => {
    ioMock.mockClear();
    ioMock.mockReturnValue(socketMock);
    socketMock.on.mockClear();
    socketMock.disconnect.mockClear();
  });

  it('connect 建立连接并订阅 data:changed 信号', () => {
    const realtime = new DataRealtime();

    realtime.connect(() => undefined);

    expect(ioMock).toHaveBeenCalledTimes(1);
    expect(socketMock.on).toHaveBeenCalledTimes(1);
    expect(socketMock.on.mock.calls[0][0]).toBe('data:changed');
  });

  it('收到信号时把 reason 转交给回调', () => {
    const realtime = new DataRealtime();
    /** 收到的原因 */
    const reasons: Array<DataChangedSignal['reason']> = [];

    realtime.connect((reason: DataChangedSignal['reason']) => reasons.push(reason));

    // 取出注册时的回调，手动触发一次信号
    const handler = socketMock.on.mock.calls[0][1] as (signal: DataChangedSignal) => void;
    handler({ reason: 'finish', at: Date.now() });

    expect(reasons).toEqual(['finish']);
  });

  it('重复 connect 不会重复建连接', () => {
    const realtime = new DataRealtime();

    realtime.connect(() => undefined);
    realtime.connect(() => undefined);

    expect(ioMock).toHaveBeenCalledTimes(1);
  });

  it('disconnect 断开连接', () => {
    const realtime = new DataRealtime();
    realtime.connect(() => undefined);

    realtime.disconnect();

    expect(socketMock.disconnect).toHaveBeenCalledTimes(1);
  });

  it('未连接时 disconnect 不报错', () => {
    const realtime = new DataRealtime();

    expect(() => realtime.disconnect()).not.toThrow();
    expect(socketMock.disconnect).not.toHaveBeenCalled();
  });
});
