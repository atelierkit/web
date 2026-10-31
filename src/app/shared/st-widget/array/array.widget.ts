import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NzTagModule } from 'ng-zorro-antd/tag';

/**
 * 数组展示小部件
 *
 * 注 1：Kong 的很多字段本身就是数组（路由的域名 / 路径 / 协议、证书的 snis），直接用内置文本
 * 小部件会把整个数组 `toString()` 成逗号串，这里改成一行蓝色标签
 * 注 2：`@delon/abc` 的 `STWidgetHostDirective` 是直接给组件实例赋值（不是 `setInput`），
 * 所以这里用普通属性而不是 `@Input()`
 */
@Component({
  selector: 'st-widget-array',
  template: `
    @for (item of value ?? []; track $index) {
      <nz-tag nzColor="blue">{{ item }}</nz-tag>
    }
  `,
  preserveWhitespaces: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NzTagModule],
})
export class StArrayWidget {
  /** 小部件 key，列定义里用 `widget: { type: 'array' }` 指定 */
  static readonly KEY = 'array';

  /** 传入的数组值 */
  value?: ReadonlyArray<string | number> | null;
}
