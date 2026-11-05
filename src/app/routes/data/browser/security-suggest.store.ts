import { DestroyRef, Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';

import { DataService, type SecurityOption } from '../data.service';

/**
 * 联想请求的防抖时延（毫秒）
 *
 * 抽成注入令牌是为了让单测把它置 0 —— 否则每个用例都得等 250ms 的真实计时器。
 */
export const SECURITY_SUGGEST_DEBOUNCE = new InjectionToken<number>('SECURITY_SUGGEST_DEBOUNCE', {
  providedIn: 'root',
  factory: () => 250,
});

/**
 * 证券联想的取数状态（每个输入框一个实例，见组件的 `providers`）
 *
 * 三条刻意为之的行为：
 * 1. **防抖 + 只认最后一次**：联想是「每敲一键查一次」，`debounceTime` 挡住连打，
 *    `switchMap` 让前一次未回来的请求直接作废 —— 否则慢的那个后到，候选会闪回上一个词的结果。
 * 2. **空输入不查库**：清空输入框时立刻收掉候选，不发请求（「空 = 全部」这种语义不能落到接口上）。
 * 3. **失败静默**：联想只是输入辅助，接口 500 / 断网时不能弹错，也不能把已输入的文本清掉；
 *    最多是这次没有候选，用户照样可以手敲代码后点「查询」。
 */
@Injectable()
export class SecuritySuggestStore {
  private readonly dataSrv = inject(DataService);
  private readonly d$ = inject(DestroyRef);
  private readonly input$ = new Subject<string>();

  /** 候选（服务端已按相关度排序） */
  readonly options = signal<SecurityOption[]>([]);
  /** 是否在取数（输入框右侧的转圈） */
  readonly loading = signal(false);
  /** 最近一次参与查询的关键字（去空白后） */
  readonly keyword = signal('');

  /** 输入了字、也没在查、但一条都没匹配上 */
  readonly empty = computed(
    () => this.keyword().length > 0 && !this.loading() && this.options().length === 0,
  );

  constructor() {
    const debounce = inject(SECURITY_SUGGEST_DEBOUNCE);

    this.input$
      .pipe(
        map((raw) => raw.trim()),
        debounceTime(debounce),
        distinctUntilChanged(),
        tap((kw) => {
          this.keyword.set(kw);
          this.loading.set(kw.length > 0);
          if (kw.length === 0) {
            this.options.set([]);
          }
        }),
        switchMap((kw) =>
          kw.length === 0
            ? of<SecurityOption[]>([])
            : this.dataSrv.suggest(kw).pipe(catchError(() => of<SecurityOption[]>([]))),
        ),
        takeUntilDestroyed(this.d$),
      )
      .subscribe((rows) => {
        this.options.set(rows);
        this.loading.set(false);
      });
  }

  /** 输入变化（原样传，去空白在本类里做） */
  search(raw: string): void {
    this.input$.next(raw);
  }

  /** 收掉候选（选中一项、或收起面板后调用） */
  reset(): void {
    this.input$.next('');
    this.keyword.set('');
    this.options.set([]);
    this.loading.set(false);
  }
}
