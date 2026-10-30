import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { apiErrorMessage } from '@core';
import { STColumn, STComponent, STData } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';

import { AuthService, AuthUser } from '../auth.service';
import { AuthUserEditComponent } from './edit/edit.component';

/**
 * 用户管理组件
 *
 * 提供用户清单展示与建号 / 编辑入口
 */
@Component({
  selector: 'auth-user',
  templateUrl: './user.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class AuthUserComponent implements OnInit {
  private readonly authSrv = inject(AuthService);
  private readonly modalSrv = inject(NzModalService);
  private readonly msgSrv = inject(NzMessageService);

  /** 表格实例 */
  @ViewChild('st') private readonly st?: STComponent;

  /** 用户清单 */
  readonly data = signal<AuthUser[]>([]);
  /** 加载标记 */
  readonly loading = signal(true);

  /** 列定义 */
  readonly columns: STColumn[] = [
    { title: 'ID', index: 'id' },
    { title: '用户名', index: 'username' },
    { title: '昵称', index: 'name' },
    { title: '邮箱', index: 'email' },
    { title: '头像', index: 'avatar', render: 'avatar' },
    {
      title: '角色',
      index: 'roles',
      // 注：多角色时后端给的是字符串数组，直接渲染会变成逗号串，这里统一用顿号
      format: (item: STData) => ((item['roles'] ?? []) as string[]).join('、'),
    },
    {
      title: '状态',
      index: 'status',
      type: 'tag',
      tag: {
        true: { text: '启用', color: 'green' },
        false: { text: '禁用', color: 'red' },
      },
    },
    { title: '更新时间', index: 'update.at', type: 'date', dateFormat: 'yyyy-MM-dd HH:mm:ss' },
    {
      title: '操作',
      buttons: [
        {
          text: '编辑',
          type: 'link',
          click: (record: STData) => this.open(record as AuthUser),
        },
      ],
    },
  ];

  /** 页面初始化 */
  ngOnInit(): void {
    this.fresh();
  }

  /** 加载用户清单 */
  fresh(): void {
    this.loading.set(true);
    this.authSrv.users().subscribe({
      next: (rows) => {
        this.data.set(rows);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        // 失败时须复位加载态，否则表格会一直转圈
        this.loading.set(false);
        this.msgSrv.error(apiErrorMessage(err, '加载用户列表失败，请稍后重试！'));
      },
    });
  }

  /**
   * 打开建号 / 编辑弹窗
   *
   * @param record 待编辑的用户，缺省表示新建
   */
  open(record?: AuthUser): void {
    this.modalSrv
      .create<AuthUserEditComponent, { id?: number }, boolean>({
        nzContent: AuthUserEditComponent,
        nzData: { id: record?.id },
        nzFooter: null,
        nzWidth: 640,
      })
      .afterClose.subscribe((saved) => {
        // 仅在保存成功时刷新，取消关闭不动列表
        if (saved) {
          this.fresh();
        }
      });
  }
}
