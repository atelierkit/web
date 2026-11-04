import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { assetUrl } from '@core';
import { SettingsService } from '@delon/theme';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';

import { avatarColorOf, avatarTextOf } from '../utils/avatar';

/**
 * 用户头像
 *
 * 注 1：页头与侧栏共用这一个组件，避免各写一遍 `nz-avatar` 时漏掉回退逻辑
 * 注 2：没有头像或图片加载失败时回退到「名字首字符 + 稳定配色」——
 *      `nz-avatar` 在 `nzSrc` 为空时三个渲染分支都不命中，页头会留一个空白圆块
 * 注 3：地址拼接交给 `assetUrl`，后端下发的 `/static/...` 是「后端源」的路径，
 *      直接给 `<img>` 会被解析成前端源，表现为头像永远 404
 */
@Component({
  selector: 'user-avatar',
  template: `
    @let url = source();
    @if (url && !failed()) {
      <nz-avatar [nzSrc]="url" [nzSize]="size()" [nzAlt]="text()" (nzError)="failed.set(true)" />
    } @else {
      <nz-avatar [nzText]="text()" [nzSize]="size()" [style.background-color]="color()" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NzAvatarModule],
})
export class UserAvatar {
  /** 头像地址，注：后端下发的 `/static/...` 或历史遗留的外链 */
  readonly src = input<string | null | undefined>('');
  /** 昵称，注：回退文本与配色都以它为准 */
  readonly name = input<string | null | undefined>('');
  /** 登录用户名，注：昵称为空时兜底 */
  readonly username = input<string | null | undefined>('');
  /** 尺寸 */
  readonly size = input<'large' | 'small' | 'default' | number>('default');

  private readonly settings = inject(SettingsService);

  /** 图片加载失败，注：地址变了要重置（否则换了新头像仍显示首字符） */
  protected readonly failed = linkedSignal<string, boolean>({
    source: () => this.src() ?? '',
    computation: () => false,
  });

  /** 可加载地址 */
  protected readonly source = computed(() =>
    assetUrl(this.src(), this.settings.getData('baseUrl') as string | undefined),
  );

  /** 回退文本 */
  protected readonly text = computed(() => avatarTextOf(this.name(), this.username()));

  /** 回退底色 */
  protected readonly color = computed(() => avatarColorOf(this.name() || this.username()));
}
