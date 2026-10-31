import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { apiErrorMessage } from '@core';
import { STChange, STColumn, STData, STPage } from '@delon/abc/st';
import { SFComponent, SFSchema, SFSchemaEnumType, SFUISchema } from '@delon/form';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { BehaviorSubject } from 'rxjs';

import {
  OPERATE_ACTION_TAGS,
  OPERATE_NAME_TAGS,
  nameText,
  operateDetailItems,
  operateText,
  timeText,
  userText,
} from '../admin.format';
import { AdminService, OperateOptions, OperateQuery, OperateRow } from '../admin.service';
import { AdminOperateDetailComponent } from './detail/detail.component';

/**
 * 操作日志组件
 *
 * 提供按条件查询、服务端分页与详情查看；日志由各业务服务在写操作时自动追加，本页只读
 */
@Component({
  selector: 'admin-operate',
  templateUrl: './operate.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class AdminOperateComponent implements OnInit {
  private readonly adminSrv = inject(AdminService);
  private readonly msgSrv = inject(NzMessageService);
  private readonly modalSrv = inject(NzModalService);

  /** 查询表单 */
  @ViewChild('sf') private readonly sf?: SFComponent;

  /** 日志清单 */
  readonly data = signal<OperateRow[]>([]);
  /** 加载标记 */
  readonly loading = signal(true);
  /** 当前页码 */
  readonly pi = signal(1);
  /** 每页条数 */
  readonly ps = signal(20);
  /** 满足条件的总记录数 */
  readonly total = signal(0);

  /** 查询条件，注：sf 的 formData 是单向输入，用户输入由 (formChange) 回写此处 */
  readonly query = signal<OperateQuery>({});

  /**
   * 分页配置
   *
   * 注：`front` 必须为 false 才会走服务端分页 —— 否则 ST 只在本页数据里翻页，
   * 表现为「第 2 页是空的」
   */
  readonly page: STPage = {
    front: false,
    toTopOffset: 0,
    showSize: true,
    pageSizes: [10, 20, 50, 100],
    showQuickJumper: true,
    total: '第{{range[0]}}条至第{{range[1]}}条，共{{total}}条',
  };

  /** 操作用户字典，注：下拉选项通过 asyncData 推送，避免重建表单导致已输入条件丢失 */
  private readonly userSub = new BehaviorSubject<SFSchemaEnumType[]>([]);
  /** 操作对象字典 */
  private readonly nameSub = new BehaviorSubject<SFSchemaEnumType[]>([]);
  /** 操作类型字典 */
  private readonly operateSub = new BehaviorSubject<SFSchemaEnumType[]>([]);

  /** 列定义 */
  readonly columns: STColumn[] = [
    { title: '操作序号', index: 'id', width: 100 },
    { title: '操作对象', index: 'name', width: 120, type: 'tag', tag: OPERATE_NAME_TAGS },
    { title: '操作类型', index: 'operate', width: 120, type: 'tag', tag: OPERATE_ACTION_TAGS },
    {
      title: '操作用户',
      index: 'email',
      width: 220,
      format: (record: STData) => userText(record as OperateRow, '系统/未登录'),
    },
    { title: '备注', index: 'remark', className: 'text-left' },
    {
      title: '操作时间',
      index: 'at',
      width: 180,
      format: (record: STData) => timeText(record['at'] as number),
    },
    {
      title: '操作',
      fixed: 'right',
      width: 100,
      buttons: [
        {
          text: '详情',
          icon: 'profile',
          click: (record: STData) => this.detail(record as OperateRow),
        },
      ],
    },
  ];

  /** 查询表单结构 */
  readonly schema: SFSchema = {
    properties: {
      userId: { type: 'number', title: '操作用户' },
      name: { type: 'string', title: '操作对象' },
      operate: { type: 'string', title: '操作类型' },
      start: { type: 'number', title: '起始时间' },
      end: { type: 'number', title: '截止时间' },
    },
  };

  /** 查询表单样式 */
  readonly ui: SFUISchema = {
    '*': { spanLabelFixed: 100, grid: { span: 6 } },
    $userId: {
      widget: 'select',
      allowClear: true,
      showSearch: true,
      placeholder: '请选择操作用户',
      asyncData: () => this.userSub.asObservable(),
    },
    $name: {
      widget: 'select',
      allowClear: true,
      showSearch: true,
      placeholder: '请选择操作对象',
      asyncData: () => this.nameSub.asObservable(),
    },
    $operate: {
      widget: 'select',
      allowClear: true,
      showSearch: true,
      placeholder: '请选择操作类型',
      asyncData: () => this.operateSub.asObservable(),
    },
    $start: { widget: 'date', showTime: true, format: 'T', placeholder: '默认最近 24 小时' },
    $end: { widget: 'date', showTime: true, format: 'T', placeholder: '默认当前时间' },
  };

  /** 页面初始化 */
  ngOnInit(): void {
    this.loadOptions();
    this.fresh();
  }

  /** 加载日志清单 */
  fresh(): void {
    this.loading.set(true);
    this.adminSrv.operates({ ...this.query(), pi: this.pi(), ps: this.ps() }).subscribe({
      next: (res) => {
        this.data.set(res?.data ?? []);
        this.total.set(res?.total ?? 0);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        // 失败时须复位加载态，否则表格会一直转圈
        this.loading.set(false);
        this.msgSrv.error(apiErrorMessage(err, '加载操作日志失败，请稍后重试！'));
      },
    });
  }

  /** 加载查询条件字典 */
  loadOptions(): void {
    this.adminSrv.operateOptions().subscribe({
      next: (res: OperateOptions) => {
        this.userSub.next(res.users);
        this.nameSub.next(res.names.map((item) => ({ value: item, label: nameText(item) })));
        this.operateSub.next(
          res.operates.map((item) => ({ value: item, label: operateText(item) })),
        );
      },
      error: (err: unknown) =>
        this.msgSrv.error(apiErrorMessage(err, '加载查询条件失败，请稍后重试！')),
    });
  }

  /**
   * 回写查询条件
   *
   * 注：sf 的 [formData] 是单向输入，用户输入不会回写绑定对象，
   * 必须通过 (formChange) 主动回写，否则查询条件恒为初始值
   *
   * @param value 查询表单当前取值
   */
  onFormChange(value: Record<string, unknown>): void {
    this.query.set(value as OperateQuery);
  }

  /** 按查询条件查询，注：条件变化后回到第 1 页 */
  search(): void {
    this.pi.set(1);
    this.fresh();
  }

  /** 重置查询条件并重新查询 */
  reset(): void {
    this.sf?.reset();
    this.query.set({});
    this.search();
  }

  /**
   * 分页变化处理
   *
   * @param e 表格变化事件
   */
  change(e: STChange): void {
    if (e.type === 'pi') {
      this.pi.set(e.pi);
      this.fresh();
    } else if (e.type === 'ps') {
      // 每页条数变化后回到第 1 页，避免停留在超出范围的页码上
      this.pi.set(1);
      this.ps.set(e.ps);
      this.fresh();
    }
  }

  /**
   * 查看操作日志详情
   *
   * @param record 操作日志记录
   */
  detail(record: OperateRow): void {
    this.modalSrv.create({
      nzContent: AdminOperateDetailComponent,
      nzData: { items: operateDetailItems(record) },
      nzTitle: '操作日志详情',
      nzFooter: null,
      nzWidth: 640,
    });
  }
}
