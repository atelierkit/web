import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import type { SFSchema, SFSchemaEnum, SFUISchema } from '@delon/form';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { BehaviorSubject } from 'rxjs';

import { businessError } from '../../tencent.format';
import { TencentService, type DnsPayload } from '../../tencent.service';

/** 记录编辑弹窗入参 */
export interface DnsEditData {
  /** 密钥ID */
  keyId: number;
  /** 域名套餐等级 */
  grade: string;
  /** 域名 */
  domain: string;
  /** 记录ID，注：缺省表示新增 */
  recordId?: number;
}

/** 常用记录类型，注：拉不到接口时用它兜底 */
const DEFAULT_TYPES: SFSchemaEnum[] = [
  { label: 'A', value: 'A' },
  { label: 'CNAME', value: 'CNAME' },
  { label: 'MX', value: 'MX' },
  { label: 'TXT', value: 'TXT' },
  { label: 'NS', value: 'NS' },
  { label: 'AAAA', value: 'AAAA' },
  { label: 'SRV', value: 'SRV' },
];

/** 新增记录时的默认值 */
const DEFAULT_VALUE: Record<string, unknown> = {
  SubDomain: '',
  RecordType: 'A',
  Value: '',
  TTL: 600,
  MX: 0,
  RecordLine: '默认',
  Enabled: 1,
  Remark: '',
};

/**
 * 解析记录编辑组件
 *
 * 注 1：回显走 `DescribeRecord`（`RecordInfo`），不是列表接口 —— 旧项目用列表接口取详情，
 * 拿不到值只能退回默认表单
 * 注 2：`RecordInfo.Enabled` 是 1 / 0，而提交时腾讯云要 `Status: ENABLE / DISABLE`，
 * 两者在 `save()` 里转换
 */
@Component({
  selector: 'tencent-dns-edit',
  templateUrl: './edit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class TencentDnsEditComponent implements OnInit {
  private readonly tencentSrv = inject(TencentService);
  private readonly modalRef = inject(NzModalRef);
  private readonly msgSrv = inject(NzMessageService);
  /** 弹窗入参 */
  private readonly data = inject<DnsEditData>(NZ_MODAL_DATA);

  /** 表单数据，注：为 null 表示回显数据尚未就绪 */
  readonly formData = signal<Record<string, unknown> | null>(null);
  /** 是否编辑态 */
  readonly editable = !!this.data.recordId;
  /** 记录类型下拉数据 */
  private readonly types = new BehaviorSubject<SFSchemaEnum[]>(DEFAULT_TYPES);
  /** 记录线路下拉数据 */
  private readonly lines = new BehaviorSubject<SFSchemaEnum[]>([{ label: '默认', value: '默认' }]);

  /** 表单 schema */
  readonly schema: SFSchema = {
    properties: {
      SubDomain: { type: 'string', title: '主机记录' },
      RecordType: { type: 'string', title: '记录类型' },
      Value: { type: 'string', title: '记录值' },
      TTL: { type: 'integer', title: 'TTL' },
      MX: { type: 'integer', title: 'MX 优先级' },
      RecordLine: { type: 'string', title: '线路' },
      Enabled: { type: 'number', title: '状态' },
      Remark: { type: 'string', title: '备注' },
    },
    required: ['RecordType', 'Value'],
  };

  /** 表单样式 */
  readonly ui: SFUISchema = {
    '*': { spanLabelFixed: 100, grid: { span: 24 } },
    $SubDomain: { placeholder: '如 www，留空表示 @' },
    $RecordType: { widget: 'select', asyncData: () => this.types.asObservable() },
    $Value: { placeholder: 'A 记录填 IP，CNAME 填目标域名' },
    $TTL: { widget: 'number', placeholder: '缓存时间（秒），默认 600' },
    $MX: { widget: 'number', placeholder: '仅 MX 记录需要，1-20' },
    $RecordLine: { widget: 'select', asyncData: () => this.lines.asObservable() },
    $Enabled: {
      widget: 'radio',
      enum: [
        { value: 0, label: '禁用' },
        { value: 1, label: '启用' },
      ],
    },
    $Remark: { widget: 'textarea', autosize: { minRows: 2, maxRows: 4 } },
  };

  /** 页面初始化 */
  ngOnInit(): void {
    this.tencentSrv.dnsType(this.data.keyId, this.data.grade).subscribe({
      next: (res) => {
        if (res.TypeList && res.TypeList.length > 0) {
          this.types.next(res.TypeList.map((item) => ({ label: item, value: item })));
        }
      },
      // 类型清单拉不到不影响填表（已有兜底枚举）
      error: () => this.types.next(DEFAULT_TYPES),
    });
    this.tencentSrv.dnsLine(this.data.keyId, this.data.domain, this.data.grade).subscribe({
      next: (res) => {
        /** 线路清单 */
        const rows = res.LineList ?? [];
        if (rows.length > 0) {
          this.lines.next(
            rows
              .filter((row) => !!row.Name)
              .map((row) => ({ label: String(row.Name), value: String(row.Name) })),
          );
        }
      },
      error: () => this.lines.next([{ label: '默认', value: '默认' }]),
    });
    if (!this.data.recordId) {
      this.formData.set({ ...DEFAULT_VALUE });
      return;
    }
    this.tencentSrv.dnsRecord(this.data.keyId, this.data.domain, this.data.recordId).subscribe({
      next: (res) => {
        /** 记录详情 */
        const info = res.RecordInfo;
        if (!info) {
          this.formData.set({ ...DEFAULT_VALUE });
          return;
        }
        this.formData.set({
          SubDomain: info.SubDomain ?? '',
          RecordType: info.RecordType ?? 'A',
          Value: info.Value ?? '',
          TTL: info.TTL ?? 600,
          MX: info.MX ?? 0,
          RecordLine: info.RecordLine ?? '默认',
          Enabled: info.Enabled ?? 1,
          Remark: info.Remark ?? '',
        });
      },
      error: (err: unknown) => {
        this.msgSrv.error(apiErrorMessage(err, '加载记录详情失败，请稍后重试！'));
        this.modalRef.close(false);
      },
    });
  }

  /**
   * 保存记录
   *
   * @param value 表单值
   */
  save(value: Record<string, unknown>): void {
    /** 记录内容 */
    const payload: DnsPayload = {
      Domain: this.data.domain,
      RecordType: String(value['RecordType'] ?? ''),
      RecordLine: String(value['RecordLine'] ?? '默认'),
      Value: String(value['Value'] ?? ''),
      SubDomain: String(value['SubDomain'] ?? ''),
      TTL: Number(value['TTL'] ?? 600),
      MX: Number(value['MX'] ?? 0),
      Status: value['Enabled'] ? 'ENABLE' : 'DISABLE',
      Remark: String(value['Remark'] ?? ''),
    };
    /** 请求 */
    const request = this.data.recordId
      ? this.tencentSrv.dnsModify(this.data.keyId, { ...payload, RecordId: this.data.recordId })
      : this.tencentSrv.dnsCreate(this.data.keyId, payload);
    request.subscribe({
      next: (res) => {
        /** 业务错误 */
        const message = businessError(res);
        if (message) {
          this.msgSrv.error(message);
          return;
        }
        this.msgSrv.success(this.data.recordId ? '修改成功' : '创建成功');
        this.modalRef.close(true);
      },
      error: (err: unknown) => this.msgSrv.error(apiErrorMessage(err, '保存失败，请稍后重试！')),
    });
  }

  /** 关闭弹窗 */
  close(): void {
    this.modalRef.close(false);
  }
}
