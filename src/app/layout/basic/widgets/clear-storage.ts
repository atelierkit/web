import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nPipe } from '@delon/theme';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';

@Component({
  selector: 'header-clear-storage',
  template: `
    <nz-icon nzType="tool" />
    清理本地缓存
  `,
  host: {
    class: 'flex-1',
    '(click)': '_click()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NzIconModule, I18nPipe],
})
export class HeaderClearStorage {
  private readonly modalSrv = inject(NzModalService);
  private readonly messageSrv = inject(NzMessageService);

  protected _click(): void {
    this.modalSrv.confirm({
      nzTitle: 'Make sure clear all local storage?',
      nzOnOk: () => {
        localStorage.clear();
        this.messageSrv.success('Clear Finished!');
      },
    });
  }
}
