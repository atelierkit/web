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
import { BehaviorSubject, forkJoin } from 'rxjs';

import {
  REQ_STATUS_ENUM,
  REQ_STATUS_TAGS,
  ReqForm,
  buildReqQuery,
  isSlow,
  reqDetailItems,
  timeText,
  userText,
} from '../admin.format';
import { AdminService, ReqQuery, ReqRow } from '../admin.service';
import { AdminReqDetailComponent } from './detail/detail.component';

/**
 * 请求日志组件
 *
 * 提供按条件查询、服务端分页与详情查看；查询条件里的「方法名」依赖「控制器」，
 * 控制器一变就要重拉方法名下拉并清掉已选方法名，否则会拿旧控制器的方法去筛新控制器
 */
@Component({
  selector: 'admin-req',
  templateUrl: './req.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class AdminReqComponent implements OnInit {
  private readonly adminSrv = inject(AdminService);
  private readonly msgSrv = inject(NzMessageService);
  private readonly modalSrv = inject(NzModalService);

  /** 查询表单 */
  @ViewChild('sf') private readonly sf?: SFComponent;

  /** 日志清单 */
  readonly data = signal<ReqRow[]>([]);
  /** 加载标记 */
  readonly loading = signal(true);
  /** 当前页码 */
  readonly pi = signal(1);
  /** 每页条数 */
  readonly ps = signal(20);
  /** 满足条件的总记录数 */
  readonly total = signal(0);

  /** 查询表单取值，注：sf 的 formData 是单向输入，用户输入由 (formChange) 回写此处 */
  readonly form = signal<ReqForm>({});
  /** 表单已选控制器，注：用于判断是否需要联动刷新方法名下拉 */
  private readonly controller = signal('');

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

  /** 请求用户字典，注：下拉选项通过 asyncData 推送，避免重建表单导致已输入条件丢失 */
  private readonly userSub = new BehaviorSubject<SFSchemaEnumType[]>([]);
  /** 请求路径字典 */
  private readonly pathSub = new BehaviorSubject<SFSchemaEnumType[]>([]);
  /** 控制器字典 */
  private readonly ctrlSub = new BehaviorSubject<SFSchemaEnumType[]>([]);
  /** 方法名字典 */
  private readonly actionSub = new BehaviorSubject<SFSchemaEnumType[]>([]);

  /** 列定义 */
  readonly columns: STColumn[] = [
    { title: '请求ID', index: 'reqId', width: 110 },
    { title: '请求路径', index: 'url', className: 'text-left', width: 280 },
    { title: '控制器', index: 'controller', width: 170 },
    { title: '方法名', index: 'action', width: 120 },
    { title: '结果', index: 'status', width: 150, type: 'tag', tag: REQ_STATUS_TAGS },
    { title: '耗时', render: 'duration', width: 100 },
    {
      title: '请求用户',
      index: 'email',
      width: 200,
      format: (record: STData) => userText(record as ReqRow, '未登录'),
    },
    { title: '客户端IP', index: 'clientIp', width: 140 },
    {
      title: '请求时间',
      index: 'startAt',
      width: 180,
      format: (record: STData) => timeText(record['startAt'] as number),
    },
    {
      title: '操作',
      fixed: 'right',
      width: 100,
      buttons: [
        {
          text: '详情',
          icon: 'profile',
          click: (record: STData) => this.detail(record as ReqRow),
        },
      ],
    },
  ];

  /** 查询表单结构 */
  readonly schema: SFSchema = {
    properties: {
      userId: { type: 'number', title: '请求用户' },
      path: { type: 'string', title: '请求路径' },
      controller: { type: 'string', title: '控制器' },
      action: { type: 'string', title: '方法名' },
      result: {
        type: 'string',
        title: '结果',
        enum: [
          { value: 'success', label: '成功（2xx）' },
          { value: 'error', label: '异常（非 2xx）' },
        ],
      },
      status: { type: 'number', title: '状态码', enum: REQ_STATUS_ENUM },
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
      placeholder: '请选择请求用户',
      asyncData: () => this.userSub.asObservable(),
    },
    $path: {
      widget: 'select',
      allowClear: true,
      showSearch: true,
      placeholder: '请选择请求路径',
      asyncData: () => this.pathSub.asObservable(),
    },
    $controller: {
      widget: 'select',
      allowClear: true,
      showSearch: true,
      placeholder: '请选择控制器',
      asyncData: () => this.ctrlSub.asObservable(),
    },
    $action: {
      widget: 'select',
      allowClear: true,
      showSearch: true,
      placeholder: '请先选择控制器',
      asyncData: () => this.actionSub.asObservable(),
    },
    $result: { widget: 'select', allowClear: true, placeholder: '请选择结果' },
    $status: { widget: 'select', allowClear: true, showSearch: true, placeholder: '请选择状态码' },
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
    this.adminSrv.reqs(this.buildQuery()).subscribe({
      next: (res) => {
        this.data.set(res?.data ?? []);
        this.total.set(res?.total ?? 0);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        // 失败时须复位加载态，否则表格会一直转圈
        this.loading.set(false);
        this.msgSrv.error(apiErrorMessage(err, '加载请求日志失败，请稍后重试！'));
      },
    });
  }

  /** 加载查询条件字典 */
  loadOptions(): void {
    forkJoin({
      users: this.adminSrv.reqUsers(),
      paths: this.adminSrv.reqPaths(),
      controllers: this.adminSrv.reqControllers(),
    }).subscribe({
      next: (res) => {
        this.userSub.next(res.users);
        this.pathSub.next(res.paths);
        this.ctrlSub.next(res.controllers);
      },
      error: (err: unknown) =>
        this.msgSrv.error(apiErrorMessage(err, '加载查询条件失败，请稍后重试！')),
    });
  }

  /**
   * 加载指定控制器的方法名字典
   *
   * @param controller 控制器名
   */
  loadActions(controller: string): void {
    if (!controller) {
      this.actionSub.next([]);
      return;
    }
    this.adminSrv.reqActions(controller).subscribe({
      next: (res: string[]) => this.actionSub.next(res),
      error: (err: unknown) =>
        this.msgSrv.error(apiErrorMessage(err, '加载方法名失败，请稍后重试！')),
    });
  }

  /**
   * 回写查询条件，并在控制器变化时联动刷新方法名下拉
   *
   * 注：sf 的 [formData] 是单向输入，用户输入不会回写绑定对象，
   * 必须通过 (formChange) 主动回写，否则查询条件恒为初始值
   *
   * @param value 查询表单当前取值
   */
  onFormChange(value: Record<string, unknown>): void {
    /** 查询表单取值 */
    const form = value as ReqForm;
    /** 表单已选控制器，注：统一按空串归一，避免 undefined 与空串反复判定为变化 */
    const controller = form.controller ?? '';
    // 控制器变化时，方法名下拉需同步刷新，且原方法名不再有效
    if (controller !== this.controller()) {
      this.controller.set(controller);
      this.sf?.setValue('/action', null);
      this.loadActions(controller);
      this.form.set({ ...form, action: undefined });
      return;
    }
    this.form.set(form);
  }

  /**
   * 组装接口查询条件
   *
   * @returns 请求日志查询条件
   */
  buildQuery(): ReqQuery {
    return buildReqQuery(this.form(), this.pi(), this.ps());
  }

  /** 按查询条件查询，注：条件变化后回到第 1 页 */
  search(): void {
    this.pi.set(1);
    this.fresh();
  }

  /** 重置查询条件并重新查询 */
  reset(): void {
    this.sf?.reset();
    this.controller.set('');
    this.actionSub.next([]);
    this.form.set({});
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
   * 判断是否为慢请求，注：模板里给耗时上色用
   *
   * @param record 请求日志记录
   * @returns 超过阈值时为 true
   */
  isSlow(record: ReqRow): boolean {
    return isSlow(record.duration);
  }

  /**
   * 查看请求日志详情
   *
   * @param record 请求日志记录
   */
  detail(record: ReqRow): void {
    this.modalSrv.create({
      nzContent: AdminReqDetailComponent,
      nzData: { items: reqDetailItems(record) },
      nzTitle: '请求日志详情',
      nzFooter: null,
      nzWidth: 640,
    });
  }
}
