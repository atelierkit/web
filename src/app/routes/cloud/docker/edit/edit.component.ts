import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import { SFSchema, SFUISchema } from '@delon/form';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';

import { CloudService, DockerPayload } from '../../cloud.service';

/** 弹窗入参 */
interface DockerEditData {
  /** 宿主机ID，注：缺省表示新建 */
  id?: number;
}

/**
 * Docker 宿主机编辑组件
 *
 * 注 1：`endpoint` 必须是**后端能访问到**的 daemon 地址（不是浏览器访问的地址）；
 * 本模块不支持 `unix://`，同机部署也请走 tcp + TLS
 * 注 2：客户端私钥只在新建时必填；编辑时详情接口不下发私钥，留空即表示保持原值
 * 注 3：明文连接（2375）需要显式勾选「允许明文连接」，否则后端直接 422 拒绝
 */
@Component({
  selector: 'cloud-docker-edit',
  templateUrl: './edit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class CloudDockerEditComponent implements OnInit {
  private readonly cloudSrv = inject(CloudService);
  private readonly modalRef = inject(NzModalRef);
  private readonly msgSrv = inject(NzMessageService);
  /** 弹窗入参 */
  private readonly data = inject<DockerEditData>(NZ_MODAL_DATA);

  /** 待编辑的宿主机ID，注：为空表示新建 */
  readonly recordId = this.data?.id;
  /** 是否编辑态 */
  readonly editable = !!this.recordId;
  /** 表单数据，注：为 null 表示详情尚未就绪，SF 模板据此显示加载态 */
  readonly formData = signal<Record<string, unknown> | null>(
    this.editable
      ? null
      : {
          tls: true,
          verify: true,
          allowInsecure: false,
          status: true,
          keyState: '新建时需填写私钥',
        },
  );

  /** 表单 schema */
  readonly schema: SFSchema = {
    properties: {
      name: { type: 'string', title: '名称', maxLength: 50 },
      description: { type: 'string', title: '说明', maxLength: 200 },
      endpoint: { type: 'string', title: '地址', maxLength: 200 },
      tls: { type: 'boolean', title: 'TLS 客户端证书' },
      ca: { type: 'string', title: 'CA 证书' },
      cert: { type: 'string', title: '客户端证书' },
      key: { type: 'string', title: '客户端私钥' },
      keyState: { type: 'string', title: '私钥状态' },
      verify: { type: 'boolean', title: '校验证书' },
      allowInsecure: { type: 'boolean', title: '允许明文连接' },
      apiVersion: { type: 'string', title: 'API 版本', maxLength: 10 },
      status: { type: 'boolean', title: '状态' },
      // 注：审计字段放在表单末尾做只读展示，仅在编辑态出现；
      // 它们不属于可提交内容，`save()` 里是显式构造 payload，不会被带出去
      ...(this.editable
        ? {
            createAt: { type: 'number', title: '创建时间' },
            updateAt: { type: 'number', title: '更新时间' },
          }
        : {}),
    },
    required: ['name', 'description', 'endpoint'],
  };

  /** 表单样式 */
  readonly ui: SFUISchema = {
    '*': { spanLabelFixed: 130, grid: { span: 24 } },
    $name: { placeholder: '便于识别的名称，如「家用宿主机」' },
    $description: { placeholder: '这台机器是做什么用的' },
    $endpoint: {
      placeholder: 'tcp://192.168.1.3:2376（不要填 unix://，端口省略时按 TLS 取 2376 / 2375）',
    },
    $tls: { checkedChildren: '启用', unCheckedChildren: '关闭' },
    $ca: {
      widget: 'textarea',
      autosize: { minRows: 3, maxRows: 8 },
      placeholder: 'CA 证书 PEM，留空表示使用系统根证书',
      visibleIf: { tls: [true] },
    },
    $cert: {
      widget: 'textarea',
      autosize: { minRows: 3, maxRows: 8 },
      placeholder:
        '客户端证书 PEM —— 只放客户端证书本身，不要拼接 CA 或服务端证书（混在一起会导致「证书与私钥不匹配」）',
      visibleIf: { tls: [true] },
    },
    $key: {
      widget: 'textarea',
      autosize: { minRows: 3, maxRows: 8 },
      placeholder: '客户端私钥 PEM；编辑时留空表示保持原值',
      visibleIf: { tls: [true] },
    },
    $keyState: { widget: 'text', visibleIf: { tls: [true] } },
    $verify: {
      checkedChildren: '校验',
      unCheckedChildren: '不校验',
      visibleIf: { tls: [true] },
    },
    $allowInsecure: {
      checkedChildren: '允许',
      unCheckedChildren: '不允许',
      visibleIf: { tls: [false] },
    },
    $apiVersion: { placeholder: '留空自动探测，如 1.47' },
    $status: { checkedChildren: '启用', unCheckedChildren: '禁用' },
    $createAt: { widget: 'at' },
    $updateAt: { widget: 'at' },
  };

  /** 页面初始化 */
  ngOnInit(): void {
    if (!this.recordId) {
      return;
    }
    this.cloudSrv.docker(this.recordId).subscribe({
      next: (docker) => {
        this.formData.set({
          name: docker.name,
          description: docker.description,
          endpoint: docker.endpoint,
          tls: docker.tls,
          ca: docker.ca,
          cert: docker.cert,
          // 注：私钥永不下发，这里一律留空；`keyState` 只负责告诉用户「已配置」
          key: '',
          keyState: docker.hasKey ? '已配置（留空表示不修改）' : '未配置',
          verify: docker.verify,
          allowInsecure: false,
          apiVersion: docker.apiVersion,
          status: docker.status,
          createAt: docker.create?.at ?? null,
          updateAt: docker.update?.at ?? null,
        });
      },
      error: (err: unknown) => {
        // 详情取不到时弹窗无法继续编辑，提示后关闭
        this.msgSrv.error(apiErrorMessage(err, '加载宿主机详情失败，请稍后重试！'));
        this.close();
      },
    });
  }

  /**
   * 保存宿主机（新建或更新）
   *
   * @param value SF 表单提交值
   */
  save(value: Record<string, unknown>): void {
    /** 是否启用 TLS */
    const tls = value['tls'] === true;
    /** API 版本，注：空串不能提交（后端 `@Matches` 会判非法），用 undefined 表示「不指定」 */
    const apiVersion = String(value['apiVersion'] ?? '').trim();
    /** 提交信息 */
    const payload: DockerPayload = {
      name: String(value['name'] ?? '').trim(),
      description: String(value['description'] ?? '').trim(),
      endpoint: String(value['endpoint'] ?? '').trim(),
      tls,
      ca: tls ? String(value['ca'] ?? '') : '',
      cert: tls ? String(value['cert'] ?? '') : '',
      key: tls ? String(value['key'] ?? '') : '',
      verify: tls ? value['verify'] === true : true,
      ...(apiVersion === '' ? {} : { apiVersion }),
      // 注：只在没开 TLS 时才需要确认明文；开了 TLS 必然走 https
      ...(tls ? {} : { allowInsecure: value['allowInsecure'] === true }),
      status: value['status'] === true,
    };
    if (this.recordId) {
      this.cloudSrv.updateDocker(this.recordId, payload).subscribe({
        next: () => this.done('保存成功'),
        error: (err: unknown) =>
          this.msgSrv.error(apiErrorMessage(err, '保存宿主机失败，请稍后重试！')),
      });
      return;
    }
    this.cloudSrv.createDocker(payload).subscribe({
      next: () => this.done('创建成功'),
      error: (err: unknown) =>
        this.msgSrv.error(apiErrorMessage(err, '创建宿主机失败，请稍后重试！')),
    });
  }

  /** 关闭弹窗 */
  close(): void {
    this.modalRef.close(false);
  }

  /**
   * 保存成功后的收尾
   *
   * @param text 提示文案
   */
  private done(text: string): void {
    this.msgSrv.success(text);
    this.modalRef.close(true);
  }
}
