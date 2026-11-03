import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import { SFSchema, SFUISchema } from '@delon/form';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';

import { CloudService, KubernetesPayload } from '../../cloud.service';

/** 弹窗入参 */
interface KubernetesEditData {
  /** 集群ID，注：缺省表示新建 */
  id?: number;
}

/** 默认命名空间 */
const DEFAULT_NAMESPACE = 'default';

/**
 * Kubernetes 集群编辑组件
 *
 * 注 1：`endpoint` 必须是**后端能访问到**的 API Server 地址（不是浏览器访问的地址），
 * 端口通常是 6443
 * 注 2：Token 与客户端私钥详情接口都不下发，编辑时留空即表示保持原值；
 * 要清空得打开 `clearToken` / 关掉「使用客户端证书」
 * 注 3：从 Token 切到客户端证书时**必须**勾选清空 Token —— API Server 先试 Bearer，
 * 一个失效的旧 Token 会直接 401，不会回退到证书
 */
@Component({
  selector: 'cloud-kubernetes-edit',
  templateUrl: './edit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class CloudKubernetesEditComponent implements OnInit {
  private readonly cloudSrv = inject(CloudService);
  private readonly modalRef = inject(NzModalRef);
  private readonly msgSrv = inject(NzMessageService);
  /** 弹窗入参 */
  private readonly data = inject<KubernetesEditData>(NZ_MODAL_DATA);

  /** 待编辑的集群ID，注：为空表示新建 */
  readonly recordId = this.data?.id;
  /** 是否编辑态 */
  readonly editable = !!this.recordId;
  /** 表单数据，注：为 null 表示详情尚未就绪，SF 模板据此显示加载态 */
  readonly formData = signal<Record<string, unknown> | null>(
    this.editable
      ? null
      : {
          tokenState: '新建时需填写 Token 或客户端证书',
          clearToken: false,
          useCert: false,
          verify: true,
          allowInsecure: false,
          namespace: DEFAULT_NAMESPACE,
          status: true,
        },
  );

  /** 表单 schema */
  readonly schema: SFSchema = {
    properties: {
      name: { type: 'string', title: '名称', maxLength: 50 },
      description: { type: 'string', title: '说明', maxLength: 200 },
      endpoint: { type: 'string', title: 'API Server', maxLength: 200 },
      token: { type: 'string', title: 'Token' },
      tokenState: { type: 'string', title: 'Token 状态' },
      clearToken: { type: 'boolean', title: '清空 Token' },
      useCert: { type: 'boolean', title: '客户端证书' },
      ca: { type: 'string', title: 'CA 证书' },
      cert: { type: 'string', title: '客户端证书' },
      key: { type: 'string', title: '客户端私钥' },
      verify: { type: 'boolean', title: '校验证书' },
      namespace: { type: 'string', title: '默认命名空间', maxLength: 63 },
      allowInsecure: { type: 'boolean', title: '允许明文连接' },
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
    $name: { placeholder: '便于识别的名称，如「家用 k3s」' },
    $description: { placeholder: '这个集群是做什么用的' },
    $endpoint: {
      placeholder: 'https://192.168.1.3:6443（端口通常是 6443，不要填集群内域名）',
    },
    $token: {
      widget: 'textarea',
      autosize: { minRows: 3, maxRows: 6 },
      placeholder: 'ServiceAccount 的 Token（eyJ...）；编辑时留空表示保持原值',
    },
    $tokenState: { widget: 'text' },
    $clearToken: {
      checkedChildren: '清空',
      unCheckedChildren: '保留',
      description:
        '仅在切换到客户端证书时需要：API Server 会先试 Bearer，失效的旧 Token 会直接 401',
    },
    $useCert: {
      checkedChildren: '使用',
      unCheckedChildren: '不用',
      description: '与 Token 二选一（也可以都配），留空私钥表示保持原值',
    },
    $ca: {
      widget: 'textarea',
      autosize: { minRows: 3, maxRows: 8 },
      placeholder: 'CA 证书 PEM（kubeadm 集群是 /etc/kubernetes/pki/ca.crt），留空用系统根证书',
      visibleIf: { useCert: [true] },
    },
    $cert: {
      widget: 'textarea',
      autosize: { minRows: 3, maxRows: 8 },
      placeholder:
        '客户端证书 PEM —— 只放客户端证书本身，不要拼接 CA 或服务端证书（混在一起会导致「证书与私钥不匹配」）',
      visibleIf: { useCert: [true] },
    },
    $key: {
      widget: 'textarea',
      autosize: { minRows: 3, maxRows: 8 },
      placeholder: '客户端私钥 PEM；编辑时留空表示保持原值',
      visibleIf: { useCert: [true] },
    },
    $verify: {
      checkedChildren: '校验',
      unCheckedChildren: '不校验',
      visibleIf: { useCert: [true] },
    },
    $namespace: { placeholder: '列表可以看全部，但删除 / 扩缩容需要具体命名空间，缺省 default' },
    $allowInsecure: {
      checkedChildren: '允许',
      unCheckedChildren: '不允许',
      description:
        '只在地址是 http://（本机 kubectl proxy）时需要勾选；明文会把 Token 暴露在链路上',
    },
    $status: { checkedChildren: '启用', unCheckedChildren: '禁用' },
    $createAt: { widget: 'at' },
    $updateAt: { widget: 'at' },
  };

  /** 页面初始化 */
  ngOnInit(): void {
    if (!this.recordId) {
      return;
    }
    this.cloudSrv.kubernetes(this.recordId).subscribe({
      next: (cluster) => {
        this.formData.set({
          name: cluster.name,
          description: cluster.description,
          endpoint: cluster.endpoint,
          // 注：Token 永不下发，这里一律留空；`tokenState` 只负责告诉用户「已配置」
          token: '',
          tokenState: cluster.hasToken ? '已配置（留空表示不修改）' : '未配置',
          clearToken: false,
          useCert: cluster.cert !== '' || cluster.hasKey,
          ca: cluster.ca,
          cert: cluster.cert,
          key: '',
          verify: cluster.verify,
          namespace: cluster.namespace || DEFAULT_NAMESPACE,
          allowInsecure: false,
          status: cluster.status,
          createAt: cluster.create?.at ?? null,
          updateAt: cluster.update?.at ?? null,
        });
      },
      error: (err: unknown) => {
        // 详情取不到时弹窗无法继续编辑，提示后关闭
        this.msgSrv.error(apiErrorMessage(err, '加载集群详情失败，请稍后重试！'));
        this.close();
      },
    });
  }

  /**
   * 保存集群（新建或更新）
   *
   * @param value SF 表单提交值
   */
  save(value: Record<string, unknown>): void {
    /** 是否使用客户端证书 */
    const useCert = value['useCert'] === true;
    /** 地址，注：是否明文由它的前缀决定 */
    const endpoint = String(value['endpoint'] ?? '').trim();
    /** 本次提交的 Token */
    const token = String(value['token'] ?? '').trim();
    /** 是否清空 Token，注：提交了新 Token 时以新值为准 */
    const clearToken = this.editable && token === '' && value['clearToken'] === true;
    /** 提交信息 */
    const payload: KubernetesPayload = {
      name: String(value['name'] ?? '').trim(),
      description: String(value['description'] ?? '').trim(),
      endpoint,
      verify: useCert ? value['verify'] === true : true,
      namespace: String(value['namespace'] ?? '').trim() || DEFAULT_NAMESPACE,
      status: value['status'] === true,
    };
    if (token !== '') {
      payload.token = token;
    }
    if (clearToken) {
      payload.clearToken = true;
    }
    if (useCert) {
      payload.ca = String(value['ca'] ?? '');
      payload.cert = String(value['cert'] ?? '');
      payload.key = String(value['key'] ?? '');
    } else if (this.editable) {
      // 注：关掉证书开关是**显式**操作，服务层据此清空 CA / 证书 / 私钥
      payload.clearCert = true;
    }
    // 注：只在明文地址时才需要确认
    if (endpoint.startsWith('http://')) {
      payload.allowInsecure = value['allowInsecure'] === true;
    }
    if (this.recordId) {
      this.cloudSrv.updateKubernetes(this.recordId, payload).subscribe({
        next: () => this.done('保存成功'),
        error: (err: unknown) =>
          this.msgSrv.error(apiErrorMessage(err, '保存集群失败，请稍后重试！')),
      });
      return;
    }
    this.cloudSrv.createKubernetes(payload).subscribe({
      next: () => this.done('创建成功'),
      error: (err: unknown) =>
        this.msgSrv.error(apiErrorMessage(err, '创建集群失败，请稍后重试！')),
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
