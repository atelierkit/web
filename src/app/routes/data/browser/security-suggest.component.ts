import { ChangeDetectionStrategy, Component, inject, input, model, output } from '@angular/core';
import {
  NzAutocompleteModule,
  type NzAutocompleteOptionComponent,
} from 'ng-zorro-antd/auto-complete';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';

import { securityTypeLabel } from './browser.format';
import { SecuritySuggestStore } from './security-suggest.store';

/**
 * 证券联想输入框（代码 / 六位数字 / 名称片段 → 候选列表）
 *
 * 两个页面共用同一个控件：证券页的「关键字」栏与 K 线页的「证券代码」栏，
 * 区别只在**选中候选项之后**做什么 —— 由父组件监听 `picked` 自行决定（证券页立即查询，
 * K 线页只回填代码、等用户点「查询」）。
 *
 * ⚠️ 回填的永远是**规范代码**（`sh.600000`），不是候选的展示文本：
 * K 线接口按代码精确查库，回填 `sh.600000 浦发银行` 会查不到任何数据、也不报错。
 */
@Component({
  selector: 'data-security-suggest',
  templateUrl: './security-suggest.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [SecuritySuggestStore],
  imports: [NzAutocompleteModule, NzIconModule, NzInputModule],
  styles: [
    `
      .suggest-code {
        font-family: var(--ant-font-family-code, monospace);
        margin-right: 8px;
      }
    `,
  ],
})
export class DataSecuritySuggestComponent {
  private readonly store = inject(SecuritySuggestStore);

  /** 输入框内容（双向绑定，父组件持有真实值） */
  readonly value = model('');
  /** 占位文案 */
  readonly placeholder = input('证券代码或名称');
  /** 输入框宽度 */
  readonly width = input('240px');
  /** 候选项被选中：回填已写入输入框，这里给出规范代码 */
  readonly picked = output<string>();
  /** 回车（候选未选中时）—— 父组件据此发起查询 */
  readonly submitted = output<void>();

  /** 候选 */
  readonly options = this.store.options;
  /** 取数中 */
  readonly loading = this.store.loading;
  /** 类型中文名 */
  readonly typeLabel = securityTypeLabel;

  /** 输入变化 */
  onInput(ev: Event): void {
    const text = (ev.target as HTMLInputElement).value;
    this.value.set(text);
    this.store.search(text);
  }

  /** 选中候选（ng-zorro 已把 `nzValue` 回填进框里，这里只同步值并收面板） */
  onPick(option: NzAutocompleteOptionComponent): void {
    const code = String(option.nzValue ?? '');
    if (code.length === 0) {
      return;
    }
    this.value.set(code);
    this.store.reset();
    this.picked.emit(code);
  }

  /**
   * 回车：候选面板还开着时这颗回车已被 ng-zorro 消费（选中当前高亮项并 `preventDefault`），
   * 那种情况下 `picked` 已经触发过查询，这里不能再发一次 —— 否则一次回车打两次同样的请求。
   * 面板没开（或还没出候选）时照常抛给父组件去查询。
   */
  onEnter(ev: Event): void {
    if (ev.defaultPrevented) {
      return;
    }
    this.store.reset();
    this.submitted.emit();
  }
}
