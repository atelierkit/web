import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
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
  imports: [NzIconModule],
})
export class HeaderClearStorage {
  private readonly modalSrv = inject(NzModalService);
  private readonly messageSrv = inject(NzMessageService);

  protected _click(): void {
    this.modalSrv.confirm({
      nzTitle: '确定清理全部本地缓存？',
      nzContent: '清理后将退出登录，需要重新输入账号密码。',
      nzOkText: '确定',
      nzCancelText: '取消',
      nzOnOk: () => {
        localStorage.clear();
        this.messageSrv.success('本地缓存已清理！');
      },
    });
  }
}
