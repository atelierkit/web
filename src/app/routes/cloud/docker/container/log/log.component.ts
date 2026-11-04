import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { apiErrorMessage, apiOriginOf } from '@core';
import { DA_SERVICE_TOKEN } from '@delon/auth';
import { SettingsService } from '@delon/theme';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';

import { DockerLogChannel, type DockerLogStatus } from './log.channel';
import {
  LOG_RENDER_MAX,
  chunksOf,
  clockOf,
  downloadTextOf,
  filterOf,
  lastTsOf,
  lineTextOf,
  mergeOf,
} from './log.format';
import { stateColor, stateText } from '../../docker.format';
import { DockerObjectService } from '../../object/object.service';
import type { DockerLogLine } from '../../object/object.types';

/** 可选的历史行数 */
export const LOG_TAIL_OPTIONS = [200, 500, 1000, 2000, 5000] as const;

/**
 * 容器日志查看器（抽屉内容）
 *
 * 注 1：首屏走 HTTP 快照（`cloud/docker/object/logs`），实时跟随走 socket.io 的
 * `/docker-log` 命名空间 —— 两者分工是「历史」与「增量」，不能互相替代
 * 注 2：暂停**会真正断开连接**，不只是停止渲染 —— 否则后端持续推送、前端缓冲无上限，
 * 挂一会儿就把内存吃满；恢复时用 `since=最后一行时间戳` 重连并去重
 * 注 3：日志内容一律按文本节点渲染（关键字高亮走分片），**不用 `innerHTML`** ——
 * 被监控的进程可以打印任意字符串，拼接等于自带 XSS
 */
@Component({
  selector: 'docker-log',
  templateUrl: './log.component.html',
  styleUrls: ['./log.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class DockerLogComponent implements OnInit, OnDestroy {
  private readonly objectSrv = inject(DockerObjectService);
  private readonly msgSrv = inject(NzMessageService);
  private readonly tokenSrv = inject(DA_SERVICE_TOKEN);
  private readonly settingsSrv = inject(SettingsService);

  /** 宿主机ID */
  readonly dockerId = input.required<number>();
  /** 容器ID */
  readonly containerId = input.required<string>();
  /** 容器名，注：只用于标题与下载文件名 */
  readonly name = input('');
  /** 容器状态，注：非运行态时不允许跟随（会立刻 EOF，徒增困惑） */
  readonly state = input('');

  /** 日志通道 */
  private readonly channel = new DockerLogChannel();
  /** 滚动容器 */
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  /** 缓冲的全部行（不止渲染的那些） */
  readonly lines = signal<DockerLogLine[]>([]);
  /** 是否正在加载首屏 */
  readonly loading = signal(true);
  /** 首屏错误 */
  readonly error = signal('');
  /** 通道状态 */
  readonly status = signal<DockerLogStatus>('idle');
  /** 快照请求序号，注：用于丢弃因连点下拉而迟到的响应 */
  private loadSeq = 0;
  /** 是否曾经建立过连接，注：用于区分「未开始」与「已断开」 */
  private readonly started = signal(false);
  /** 容器是否 TTY 模式 */
  readonly tty = signal(false);
  /** 是否发生过丢弃（行数 / 字节上限） */
  readonly dropped = signal(false);
  /** 历史行数 */
  readonly tail = signal<number>(500);
  /** 是否显示原始时间戳 */
  readonly showTimestamp = signal(true);
  /** 关键字 */
  readonly keyword = signal('');
  /** 是否显示 stdout */
  readonly showStdout = signal(true);
  /** 是否显示 stderr */
  readonly showStderr = signal(true);
  /** 是否停在底部，注：用户上翻查看历史时不打扰 */
  readonly atBottom = signal(true);
  /** 当前渲染的尾部行数 */
  readonly rendered = signal(LOG_RENDER_MAX);

  /** 容器状态文案 */
  readonly stateText = stateText;
  /** 容器状态颜色 */
  readonly stateColor = stateColor;
  /** 可选的历史行数 */
  protected readonly tailOptions = LOG_TAIL_OPTIONS;

  /** 过滤后的行 */
  readonly filtered = computed(() =>
    filterOf(this.lines(), {
      keyword: this.keyword(),
      stdout: this.showStdout(),
      stderr: this.showStderr(),
    }),
  );

  /** 实际渲染的行，注：只渲染尾部一段，更早的仍在缓冲里（可搜索、可下载） */
  readonly visible = computed(() => {
    /** 过滤结果 */
    const rows = this.filtered();
    return rows.slice(Math.max(0, rows.length - this.rendered()));
  });

  /** stderr 行数 */
  readonly errorCount = computed(
    () => this.lines().filter((line) => line.stream === 'stderr').length,
  );

  /** 容器是否已停止，注：停止的容器没有新日志，跟随只会立刻 EOF */
  readonly containerStopped = computed(() => {
    /** 状态 */
    const state = this.state();
    return state !== '' && state !== 'running' && state !== 'paused';
  });

  /** 跟随状态 */
  readonly followState = computed<'idle' | 'connecting' | 'live' | 'paused' | 'blocked'>(() => {
    if (this.status() === 'open') {
      return 'live';
    }
    if (this.status() === 'connecting') {
      return 'connecting';
    }
    if (this.containerStopped()) {
      return 'blocked';
    }
    return this.started() ? 'paused' : 'idle';
  });

  /** 页面初始化 */
  ngOnInit(): void {
    this.reload(this.tail());
  }

  /** 页面销毁 */
  ngOnDestroy(): void {
    this.channel.close();
  }

  /**
   * 重新加载快照
   *
   * 注：会先断开跟随 —— 快照与增量同时进来会把同一批行合并两次（虽然有去重，
   * 但顺序会乱），不如让用户明确地「重来一次」
   *
   * @param tail 历史行数
   */
  reload(tail: number): void {
    this.tail.set(tail);
    this.stop();
    this.started.set(false);
    this.loading.set(true);
    this.error.set('');
    // 注：行数下拉会被连点，慢的那次请求可能后到；用序号丢弃过期响应，
    // 否则界面会停在「200 行的内容 + 500 行的状态」这种自相矛盾的组合上
    /** 本次请求序号 */
    const seq = (this.loadSeq += 1);
    this.objectSrv.logs(this.dockerId(), this.containerId(), { tail, timestamps: true }).subscribe({
      next: (snapshot) => {
        if (seq !== this.loadSeq) {
          return;
        }
        this.lines.set(snapshot.lines);
        this.tty.set(snapshot.tty);
        this.dropped.set(snapshot.truncated);
        this.rendered.set(LOG_RENDER_MAX);
        this.loading.set(false);
        this.atBottom.set(true);
        this.scrollToBottom();
      },
      error: (err: unknown) => {
        if (seq !== this.loadSeq) {
          return;
        }
        this.loading.set(false);
        this.error.set(apiErrorMessage(err, '加载日志失败，请检查宿主机连接后重试！'));
      },
    });
  }

  /** 开始或暂停跟随 */
  toggleFollow(): void {
    if (this.followState() === 'live') {
      this.stop();
      return;
    }
    this.start();
  }

  /**
   * 开始跟随
   *
   * 注：`since` 取缓冲最后一行的时戳 —— 首屏已经显示过历史，跟随只接新行，
   * 否则最近 N 行会立刻重复一遍
   */
  start(): void {
    if (this.followState() === 'blocked') {
      return;
    }
    /** 后端源，注：socket 不走 HTTP 拦截器，必须自己算 */
    const origin = apiOriginOf(
      this.settingsSrv.getData('baseUrl') as string | undefined,
      location.href,
    );
    if (origin === null) {
      this.msgSrv.error('未配置有效的后端地址，请检查 assets/config.json。');
      return;
    }
    /** 登录令牌 */
    const token = this.tokenSrv.get()?.token;
    if (!token) {
      this.msgSrv.error('登录状态已失效，请重新登录后再查看日志。');
      return;
    }
    this.started.set(true);
    this.channel.connect({
      origin,
      token,
      onLines: (lines, truncated) => this.append(lines, truncated),
      onEnded: (reason) => this.onEnded(reason),
      onError: (error) => {
        this.status.set('closed');
        this.msgSrv.error(error.message || '日志流已断开。');
      },
      onStatus: (status) => this.status.set(status),
    });
    // 注：tail 传 0 —— 历史由快照给，这里只要新行；since 让断线恢复不漏行
    void this.channel
      .open({
        dockerId: this.dockerId(),
        containerId: this.containerId(),
        tail: 0,
        since: lastTsOf(this.lines()),
      })
      .then((result) => {
        if (result.sessionId === undefined) {
          this.channel.close();
          this.status.set('closed');
          this.msgSrv.error(result.message ?? '打开日志流失败，请稍后重试！');
        }
      });
  }

  /** 断开跟随，注：保留已收到的行 */
  stop(): void {
    this.channel.close();
    this.status.set('idle');
  }

  /** 清空缓冲 */
  clear(): void {
    this.lines.set([]);
    this.dropped.set(false);
  }

  /** 复制当前可见（过滤后）内容 */
  copy(): void {
    /** 文本 */
    const text = downloadTextOf(this.filtered());
    if (text === '') {
      this.msgSrv.info('当前没有可复制的内容。');
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => this.msgSrv.success('已复制到剪贴板！'),
      () => this.msgSrv.error('复制失败，请改用下载。'),
    );
  }

  /** 下载当前可见（过滤后）内容 */
  download(): void {
    /** 文本 */
    const text = downloadTextOf(this.filtered());
    if (text === '') {
      this.msgSrv.info('当前没有可下载的内容。');
      return;
    }
    /** 文件名，注：容器名可能含 `/` 等字符，统一替换掉 */
    const safe = (this.name() || this.containerId()).replace(/[^A-Za-z0-9._-]/g, '_');
    /** 时间戳，注：按本地时间拼，便于和宿主机上的其它日志对照 */
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    /** 下载链接 */
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    link.download = `${safe}-${stamp}.log`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  /** 扩大渲染窗口（加载更早） */
  loadEarlier(): void {
    this.rendered.update((value) => value + LOG_RENDER_MAX);
  }

  /** 滚动事件，注：用于判断是否停在底部 */
  onScroll(): void {
    /** 滚动容器 */
    const element = this.scroller()?.nativeElement;
    if (element === undefined) {
      return;
    }
    this.atBottom.set(element.scrollHeight - element.scrollTop - element.clientHeight < 24);
  }

  /** 滚到底部 */
  toBottom(): void {
    this.atBottom.set(true);
    /** 滚动容器 */
    const element = this.scroller()?.nativeElement;
    if (element !== undefined) {
      element.scrollTop = element.scrollHeight;
    }
  }

  /**
   * 时间戳 → 本地时钟
   *
   * @param ts 原始时间戳
   * @returns 时钟文本
   */
  protected clockOf(ts: string): string {
    return clockOf(ts);
  }

  /**
   * 关键字分片
   *
   * @param text 正文
   * @returns 分片
   */
  protected chunksOf(text: string): ReturnType<typeof chunksOf> {
    return chunksOf(text, this.keyword());
  }

  /**
   * 行 → 单行文本，注：仅供 `title` 悬停显示
   *
   * @param line 日志行
   * @returns 文本
   */
  protected lineTextOf(line: DockerLogLine): string {
    return lineTextOf(line, false);
  }

  /**
   * 追加增量
   *
   * @param lines 新增行
   * @param truncated 服务端是否丢弃过数据
   */
  private append(lines: DockerLogLine[], truncated: boolean): void {
    if (truncated) {
      this.dropped.set(true);
    }
    if (lines.length === 0) {
      return;
    }
    this.lines.set(mergeOf(this.lines(), lines, lastTsOf(this.lines())));
    this.scrollToBottom();
  }

  /**
   * 流结束
   *
   * @param reason 结束原因
   */
  private onEnded(reason: string): void {
    this.status.set('closed');
    /** 文案 */
    const text =
      reason === 'expired'
        ? '日志流已达到最长跟随时间（4 小时），已自动断开。'
        : '日志流已结束（容器可能已停止或重启）。';
    this.msgSrv.info(text);
  }

  /** 滚到底部（仅在用户未上翻时） */
  private scrollToBottom(): void {
    if (!this.atBottom()) {
      return;
    }
    /** 滚动容器 */
    const element = this.scroller()?.nativeElement;
    if (element === undefined) {
      return;
    }
    // 注：等本轮渲染完成再滚，否则 scrollHeight 还是旧值，会始终差最后一行
    requestAnimationFrame(() => {
      element.scrollTop = element.scrollHeight;
    });
  }
}
