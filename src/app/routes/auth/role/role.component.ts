import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { apiErrorMessage } from '@core';
import { STColumn, STColumnTag, STComponent, STData } from '@delon/abc/st';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';

import { AuthRole, AuthService } from '../auth.service';
import { AuthRoleEditComponent } from './edit/edit.component';

/**
 * 角色管理组件
 *
 * 提供角色清单展示、创建 / 编辑与拖拽排序
 */
@Component({
  selector: 'auth-role',
  templateUrl: './role.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class AuthRoleComponent implements OnInit {
  private readonly authSrv = inject(AuthService);
  private readonly modalSrv = inject(NzModalService);
  private readonly msgSrv = inject(NzMessageService);

  /** 表格实例，注：保存排序要读取拖拽后的行顺序 */
  @ViewChild('st') private readonly st?: STComponent;

  /** 角色清单 */
  readonly data = signal<AuthRole[]>([]);
  /** 加载标记 */
  readonly loading = signal(true);

  /** 列定义 */
  readonly columns: STColumn[] = [
    { title: 'ID', index: 'id' },
    { title: '名称', index: 'name' },
    { title: '描述', index: 'description' },
    { title: '排序', index: 'sort' },
    {
      title: '状态',
      index: 'status',
      type: 'tag',
      tag: {
        true: { text: '启用', color: 'green' },
        false: { text: '禁用', color: 'red' },
      } as STColumnTag,
    },
    { title: '创建时间', index: 'create.at', type: 'date', dateFormat: 'yyyy-MM-dd HH:mm:ss' },
    { title: '更新时间', index: 'update.at', type: 'date', dateFormat: 'yyyy-MM-dd HH:mm:ss' },
    {
      title: '操作',
      buttons: [
        {
          text: '编辑',
          type: 'link',
          click: (record: STData) => this.open(record as AuthRole),
        },
      ],
    },
  ];

  /** 页面初始化 */
  ngOnInit(): void {
    this.fresh();
  }

  /**
   * 加载角色清单
   *
   * 注：后端按操作序号返回数据，这里取全量后按排序号升序展示
   */
  fresh(): void {
    this.loading.set(true);
    this.authSrv.roles().subscribe({
      next: (rows) => {
        this.data.set([...rows].sort((a, b) => a.sort - b.sort));
        this.loading.set(false);
      },
      error: (err: unknown) => {
        // 失败时须复位加载态，否则表格会一直转圈
        this.loading.set(false);
        this.msgSrv.error(apiErrorMessage(err, '加载角色列表失败，请稍后重试！'));
      },
    });
  }

  /**
   * 打开创建 / 编辑弹窗
   *
   * @param record 待编辑的角色，缺省表示新建
   */
  open(record?: AuthRole): void {
    this.modalSrv
      .create<AuthRoleEditComponent, { id?: string }, boolean>({
        nzContent: AuthRoleEditComponent,
        nzData: { id: record?.id },
        nzTitle: record ? '编辑角色' : '创建角色',
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

  /**
   * 保存拖拽后的排序
   *
   * 注：排序号按当前行顺序从 1 递增重排，因此不需要用户手工填数字
   */
  sort(): void {
    /** 拖拽后的行顺序，注：拖拽改的是表格内部数据，必须从表格实例读取 */
    const rows = this.st?._data ?? [];
    this.authSrv
      .sortRoles(rows.map((item, index) => ({ id: String(item['id']), sort: index + 1 })))
      .subscribe({
        next: () => {
          this.msgSrv.success('排序已保存');
          this.fresh();
        },
        error: (err: unknown) =>
          this.msgSrv.error(apiErrorMessage(err, '保存排序失败，请稍后重试！')),
      });
  }
}
