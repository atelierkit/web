import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { apiErrorMessage, apiOriginOf } from '@core';
import { DA_SERVICE_TOKEN } from '@delon/auth';
import { SettingsService } from '@delon/theme';
import { SHARED_IMPORTS } from '@shared';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { NzMessageService } from 'ng-zorro-antd/message';

import { CloudRemote, CloudService } from '../../cloud.service';
import { charsetText, errorTextOf } from '../remote.format';
import { TerminalChannel, type TerminalStatus } from './terminal.channel';
import { TERMINAL_FONT, TERMINAL_THEME } from './terminal.theme';

/**
 * 浏览器内 SSH 终端
 *
 * 注 1：浏览器**不直接连目标主机** —— 这里只与 api 的 `/remote` 命名空间交换原始字节，
 * SSH 的建连、认证、PTY 全在 api（`ssh2`）里完成；本组件不含任何 SSH 协议代码
 * 注 2：`xterm` 只是 VT 渲染器：把字节画成终端画面，`vim` / `top` 这类全屏程序靠它才能正常显示
 * 注 3：无自动重连 —— 链路抖动时自动重连会连出多条残留会话，目标机 `who` 里看得到
 */
@Component({
  selector: 'remote-terminal',
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class RemoteTerminalComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly cloudSrv = inject(CloudService);
  private readonly settingsSrv = inject(SettingsService);
  private readonly tokenSrv = inject(DA_SERVICE_TOKEN);
  private readonly msgSrv = inject(NzMessageService);

  /** 终端挂载点 */
  private readonly screen = viewChild<ElementRef<HTMLDivElement>>('screen');

  /** 主机ID，注：子路由，父路由才有 `id` */
  private readonly hostId = Number(this.route.parent?.snapshot.params['id']);

  /** 主机详情 */
  readonly host = signal<CloudRemote | null>(null);
  /** 连接状态 */
  readonly status = signal<TerminalStatus>('idle');
  /** 失败原因，注：空串表示没失败 */
  readonly failed = signal('');
  /** 遮罩提示 */
  readonly hint = computed(() => {
    /** 状态 */
    const status = this.status();
    if (status === 'connecting') {
      return '正在建立连接…';
    }
    if (status === 'closed') {
      return '连接已断开，点「重新连接」再试。';
    }
    return '准备中…';
  });

  /** 字符集文案 */
  readonly charsetOf = charsetText;

  /** 通道 */
  private readonly channel = new TerminalChannel();
  /** 终端实例 */
  private terminal: Terminal | null = null;
  /** 自适配插件 */
  private fit: FitAddon | null = null;
  /** 尺寸观察器 */
  private observer: ResizeObserver | null = null;
  /** 输出解码器，注：`stream: true` 让被分片切断的汉字能续上 */
  private decoder: TextDecoder | null = null;
  /** 视图是否就绪 */
  private viewReady = false;
  /** 主机信息是否就绪 */
  private hostReady = false;
  /** 是否已经发起过连接，注：视图与主机信息都就绪才连，且只连一次 */
  private started = false;

  /** 页面初始化 */
  ngOnInit(): void {
    this.cloudSrv.remote(this.hostId).subscribe({
      next: (host) => {
        this.host.set(host);
        this.hostReady = true;
        this.tryConnect();
      },
      error: (err: unknown) => {
        this.failed.set(apiErrorMessage(err, '加载主机信息失败，请稍后重试！'));
        this.status.set('closed');
      },
    });
  }

  /** 视图初始化 */
  ngAfterViewInit(): void {
    this.viewReady = true;
    this.setupTerminal();
    this.tryConnect();
  }

  /** 组件销毁，注：必须显式断开，否则切页面会在目标机留下一条残留会话 */
  ngOnDestroy(): void {
    this.channel.close();
    this.observer?.disconnect();
    this.observer = null;
    this.terminal?.dispose();
    this.terminal = null;
  }

  /** 重新连接 */
  reconnect(): void {
    this.channel.close();
    this.decoder = null;
    this.failed.set('');
    this.connect();
  }

  /** 清屏，注：只清本地视图，不往远端发 clear 命令 */
  clear(): void {
    this.terminal?.clear();
  }

  /**
   * 终端获得焦点
   *
   * 注：挂在容器的点击事件上 —— 点哪都能输入，不必精确点到光标
   */
  focus(): void {
    this.terminal?.focus();
  }

  /** 装配终端 */
  private setupTerminal(): void {
    /** 挂载点 */
    const element = this.screen()?.nativeElement;
    if (element === undefined) {
      return;
    }
    /** 终端 */
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: TERMINAL_FONT,
      theme: TERMINAL_THEME,
      scrollback: 5000,
      // 注：不转换换行 —— 远端已经发 `\r\n`，再转一次会让进度条类输出错行
      convertEol: false,
    });
    /** 自适配插件 */
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(element);
    fit.fit();
    // 注：键盘输入交给通道，编码与分片在 `TerminalChannel` 里做
    terminal.onData((data) => this.channel.send(data));
    this.terminal = terminal;
    this.fit = fit;
    // 注：观察容器而不是 window —— 侧栏折叠不会触发 window.resize
    this.observer = new ResizeObserver(() => this.refit());
    this.observer.observe(element);
  }

  /** 重新适配尺寸并同步给远端 */
  private refit(): void {
    /** 终端 */
    const terminal = this.terminal;
    /** 自适配插件 */
    const fit = this.fit;
    if (terminal === null || fit === null) {
      return;
    }
    fit.fit();
    this.channel.resize(terminal.cols, terminal.rows);
  }

  /** 视图与主机信息都就绪时建连 */
  private tryConnect(): void {
    if (!this.viewReady || !this.hostReady || this.started) {
      return;
    }
    this.started = true;
    this.connect();
  }

  /** 建连：先取票据，再用票据换会话 */
  private connect(): void {
    this.failed.set('');
    this.status.set('connecting');
    /** 列数 */
    const cols = this.terminal?.cols ?? 80;
    /** 行数 */
    const rows = this.terminal?.rows ?? 24;
    this.cloudSrv.remoteTicket(this.hostId, cols, rows).subscribe({
      next: ({ ticket }) => this.dial(ticket),
      error: (err: unknown) => {
        this.status.set('closed');
        this.showError(apiErrorMessage(err, '申请终端票据失败，请稍后重试！'));
      },
    });
  }

  /**
   * 用票据建立 WS 会话
   *
   * @param ticket 一次性票据
   */
  private dial(ticket: string): void {
    /** 后端源，注：socket 不走 HTTP 拦截器，必须自己算 */
    const origin = apiOriginOf(
      this.settingsSrv.getData('baseUrl') as string | undefined,
      location.href,
    );
    if (origin === null) {
      this.status.set('closed');
      this.showError('未配置有效的后端地址，请检查 assets/config.json。');
      return;
    }
    /** 登录令牌 */
    const token = this.tokenSrv.get()?.token;
    if (!token) {
      this.status.set('closed');
      this.showError('登录状态已失效，请重新登录后再连接。');
      return;
    }
    this.channel.connect({
      origin,
      token,
      onOutput: (data) => this.write(data),
      onExit: (exit) => {
        this.status.set('closed');
        this.terminal?.write(`\r\n\x1b[33m[会话已结束：${exit.reason || '通道关闭'}]\x1b[0m\r\n`);
      },
      onError: (error) => {
        this.status.set('closed');
        this.showError(errorTextOf(error.code, error.message));
      },
      onStatus: (status) => this.status.set(status),
    });
    void this.channel.open(ticket).then((result) => {
      if (result.sessionId === undefined) {
        this.status.set('closed');
        this.showError(errorTextOf(result.code ?? '', result.message ?? ''));
        return;
      }
      this.status.set('open');
      this.refit();
      this.terminal?.focus();
    });
  }

  /**
   * 把字节写进终端
   *
   * @param data 原始字节
   */
  private write(data: ArrayBuffer): void {
    if (this.decoder === null) {
      // 注：字符集来自主机配置；`gb18030` 是 GBK / GB2312 的超集。
      // `stream` 是 `decode()` 的参数而不是构造参数（写在构造里会直接类型报错）
      this.decoder = new TextDecoder(this.host()?.charset || 'utf-8');
    }
    // 注：`stream: true` 是必需的 —— 一个汉字可能跨两次数据帧，逐帧解码会得到乱码
    this.terminal?.write(this.decoder.decode(new Uint8Array(data), { stream: true }));
  }

  /**
   * 展示错误
   *
   * @param text 文案
   */
  private showError(text: string): void {
    this.failed.set(text);
    this.msgSrv.error(text);
  }
}
