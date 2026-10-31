import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { apiErrorMessage } from '@core';
import type { SFComponent, SFSchema, SFSchemaEnum, SFUISchema } from '@delon/form';
import { SHARED_IMPORTS, formatDateTime } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { BehaviorSubject, map } from 'rxjs';

import { KongObjectService } from '../../../cloud/kong/object/object.service';
import type { KongObject } from '../../../cloud/kong/object/object.types';
import { TencentService, type SslDeployPayload } from '../../tencent.service';

/** 部署弹窗入参 */
export interface SslDeployData {
  /** 密钥ID */
  keyId: number;
  /** 证书ID */
  certificateId: string;
  /** 证书域名 */
  domain: string[];
  /** 到期时间 */
  end: string;
}

/**
 * 证书部署组件
 *
 * 注 1：证书的公私钥由后端找腾讯云现取，前端只提交证书ID与站点ID
 * 注 2：已部署证书的到期时间取 KONG 证书对象的 `end`（后端用 PEM 解析后补上的**秒级**时间戳），
 * 旧私有项目在前端用 `validity()` 解 PEM，现在不需要了
 */
@Component({
  selector: 'tencent-ssl-deploy',
  templateUrl: './deploy.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class TencentSslDeployComponent implements OnInit {
  private readonly tencentSrv = inject(TencentService);
  private readonly objectSrv = inject(KongObjectService);
  private readonly modalRef = inject(NzModalRef);
  private readonly msgSrv = inject(NzMessageService);
  /** 弹窗入参 */
  private readonly data = inject<SslDeployData>(NZ_MODAL_DATA);

  /** 表单实例，注：选证书后要回填到期时间 */
  @ViewChild('sf') private readonly sf?: SFComponent;

  /** 表单数据，注：为 null 表示尚未就绪 */
  readonly formData = signal<Record<string, unknown> | null>(null);
  /** 已部署证书缓存：KONG 证书ID → 证书对象 */
  private readonly certs = new Map<string, KongObject>();
  /** 待更新证书下拉数据 */
  private readonly certOptions = new BehaviorSubject<SFSchemaEnum[]>([]);

  /** 表单 schema */
  readonly schema: SFSchema = {
    properties: {
      deploying: {
        type: 'object',
        title: '待部署证书',
        properties: {
          certificateId: { type: 'string', title: 'ID' },
          domain: { type: 'string', title: '域名' },
          end: { type: 'string', title: '有效期' },
        },
      },
      kong: {
        type: 'object',
        title: 'KONG 站点',
        properties: {
          id: { type: 'number', title: '站点' },
          update: {
            type: 'number',
            title: '部署方式',
            default: 0,
            enum: [
              { value: 0, label: '新建' },
              { value: 1, label: '更新' },
            ],
          },
        },
        required: ['id', 'update'],
      },
      deployed: {
        type: 'object',
        title: '已部署证书',
        description: '站点里已有的证书；选它即覆盖该证书的公私钥与域名',
        properties: {
          id: { type: 'string', title: '证书' },
          end: { type: 'string', title: '到期时间' },
        },
      },
    },
  };

  /** 表单样式 */
  readonly ui: SFUISchema = {
    '*': { spanLabelFixed: 100, grid: { span: 24 } },
    $deploying: {
      showTitle: true,
      $certificateId: { widget: 'text' },
      $domain: { widget: 'text' },
      $end: { widget: 'text' },
    },
    $kong: {
      showTitle: true,
      $id: {
        widget: 'select',
        placeholder: '请选择 KONG 站点',
        change: (kongId: number) => this.loadCerts(kongId),
        asyncData: () =>
          this.tencentSrv
            .kongs()
            .pipe(map((rows) => rows.map((item) => ({ label: item.name, value: item.id })))),
      },
      $update: { widget: 'radio', styleType: 'button', buttonStyle: 'solid' },
    },
    $deployed: {
      showTitle: true,
      // 注：只有「更新」模式才需要选目标证书
      visibleIf: {
        '/kong/id': (value: number) => !!value,
        '/kong/update': (value: number) => value === 1,
      },
      visibleIfLogical: 'and',
      $id: {
        widget: 'select',
        placeholder: '请选择待更新的证书',
        change: (id: string) => this.showEnd(id),
        asyncData: () => this.certOptions.asObservable(),
      },
      $end: { widget: 'text' },
    },
  };

  /** 页面初始化 */
  ngOnInit(): void {
    this.formData.set({
      deploying: {
        certificateId: this.data.certificateId,
        domain: this.data.domain.join(', '),
        end: this.data.end,
      },
    });
  }

  /**
   * 加载站点上已有的证书
   *
   * @param kongId 站点ID
   */
  private loadCerts(kongId: number): void {
    if (!kongId) {
      return;
    }
    this.objectSrv.objects(kongId, 'certificates').subscribe({
      next: (rows) => {
        this.certs.clear();
        for (const row of rows) {
          this.certs.set(String(row['id']), row);
        }
        this.certOptions.next(
          rows.map((row) => ({
            value: String(row['id']),
            label: domainsOf(row) || String(row['id']),
          })),
        );
      },
      error: (err: unknown) =>
        this.msgSrv.error(apiErrorMessage(err, '加载站点证书失败，请稍后重试！')),
    });
  }

  /**
   * 回填所选证书的到期时间
   *
   * @param id KONG 证书ID
   */
  private showEnd(id: string): void {
    /** 证书对象 */
    const cert = this.certs.get(id);
    this.sf?.setValue('/deployed/end', formatDateTime(cert?.['end'] as number, 's'));
  }

  /**
   * 提交部署
   *
   * @param value 表单值
   */
  save(value: Record<string, unknown>): void {
    /** 站点与部署方式 */
    const kong = value['kong'] as { id?: number; update?: number } | undefined;
    if (!kong?.id) {
      this.msgSrv.warning('请选择 KONG 站点');
      return;
    }
    /** 部署入参 */
    const payload: SslDeployPayload = {
      CertificateId: this.data.certificateId,
      domain: this.data.domain,
      KongId: kong.id,
      update: kong.update ?? 0,
    };
    if (payload.update === 1) {
      /** 待更新的证书 */
      const target = (value['deployed'] as { id?: string } | undefined)?.id;
      if (!target) {
        this.msgSrv.warning('更新模式下必须选择待更新的证书');
        return;
      }
      payload.id = target;
    }
    this.tencentSrv.sslDeploy(this.data.keyId, payload).subscribe({
      next: (res) => {
        this.msgSrv.success(res.message ?? '证书部署成功');
        this.modalRef.close(true);
      },
      error: (err: unknown) =>
        this.msgSrv.error(apiErrorMessage(err, '证书部署失败，请稍后重试！')),
    });
  }

  /** 关闭弹窗 */
  close(): void {
    this.modalRef.close(false);
  }
}

/**
 * 取证书对象上的域名文本
 *
 * @param cert KONG 证书对象
 * @returns 域名（逗号分隔），没有时为 null
 */
function domainsOf(cert: KongObject): string | null {
  /** 域名清单 */
  const snis = cert['snis'];
  if (!Array.isArray(snis) || snis.length === 0) {
    return null;
  }
  return snis.join(', ');
}
