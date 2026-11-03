import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import { SFSchema, SFUISchema } from '@delon/form';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';

import { CloudService, RemotePayload } from '../../cloud.service';

/** 弹窗入参 */
interface RemoteEditData {
  /** 主机ID，注：缺省表示新建 */
  id?: number;
}

/**
 * 远程主机编辑组件
 *
 * 注 1：`host` 必须是**后端能访问到**的地址（不是浏览器访问的地址）—— 连接由 api 发起
 * 注 2：切鉴权方式时后端会清掉另一套凭据（详情不下发密文，空串只能表示「不修改」）
 * 注 3：私钥在保存时由后端解析一遍，`.ppk` 会被直接拒并提示转换命令
 */
@Component({
  selector: 'cloud-remote-edit',
  templateUrl: './edit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class CloudRemoteEditComponent implements OnInit {
  private readonly cloudSrv = inject(CloudService);
  private readonly modalRef = inject(NzModalRef);
  private readonly msgSrv = inject(NzMessageService);
  /** 弹窗入参 */
  private readonly data = inject<RemoteEditData>(NZ_MODAL_DATA);

  /** 待编辑的主机ID，注：为空表示新建 */
  readonly recordId = this.data?.id;
  /** 是否编辑态 */
  readonly editable = !!this.recordId;
  /** 表单数据，注：为 null 表示详情尚未就绪，SF 模板据此显示加载态 */
  readonly formData = signal<Record<string, unknown> | null>(
    this.editable
      ? null
      : {
          authType: 'password',
          port: 22,
          charset: 'utf-8',
          status: true,
          keyState: '未配置',
        },
  );

  /** 表单 schema */
  readonly schema: SFSchema = {
    properties: {
      name: { type: 'string', title: '主机名称', maxLength: 50 },
      description: { type: 'string', title: '说明', maxLength: 200 },
      host: {
        type: 'string',
        title: '主机地址',
        maxLength: 200,
        pattern: '^[A-Za-z0-9]([A-Za-z0-9._-]{0,198}[A-Za-z0-9])?$',
      },
      port: { type: 'number', title: 'SSH 端口', minimum: 1, maximum: 65535 },
      authType: {
        type: 'string',
        title: '鉴权方式',
        enum: [
          { label: '密码', value: 'password' },
          { label: '私钥', value: 'key' },
        ],
        default: 'password',
      },
      username: { type: 'string', title: '登录用户', maxLength: 64 },
      password: { type: 'string', title: '登录密码' },
      privateKey: { type: 'string', title: '私钥' },
      passphrase: { type: 'string', title: '私钥口令' },
      keyState: { type: 'string', title: '私钥状态' },
      charset: {
        type: 'string',
        title: '终端字符集',
        enum: [
          { label: 'UTF-8（默认）', value: 'utf-8' },
          { label: 'GB18030（老系统 / GBK locale）', value: 'gb18030' },
        ],
        default: 'utf-8',
      },
      rootPath: { type: 'string', title: 'SFTP 起始目录', maxLength: 200 },
      status: { type: 'boolean', title: '状态' },
      // 注：审计字段只读展示，仅编辑态出现；`save()` 是显式构造 payload，不会被带出去
      ...(this.editable
        ? {
            createAt: { type: 'number', title: '创建时间' },
            updateAt: { type: 'number', title: '更新时间' },
          }
        : {}),
    },
    required: ['name', 'description', 'host', 'port', 'authType', 'username'],
  };

  /** 表单样式 */
  readonly ui: SFUISchema = {
    '*': { spanLabelFixed: 120, grid: { span: 24 } },
    $name: { placeholder: '便于识别的名称，如「工控机」' },
    $description: { placeholder: '这台机器是做什么用的' },
    $host: { placeholder: '主机名或 IP，如 192.168.1.3（不要带 ssh://）' },
    $port: { widget: 'number' },
    $authType: { widget: 'select' },
    $username: { placeholder: '远程登录用户名，如 root / atelier' },
    $password: {
      type: 'password',
      placeholder: '编辑时留空表示保持原值',
      visibleIf: { authType: ['password'] },
    },
    $privateKey: {
      widget: 'textarea',
      autosize: { minRows: 4, maxRows: 12 },
      placeholder:
        'OpenSSH 或 PEM 格式的私钥；PuTTY 的 .ppk 不受支持，请先用 puttygen 转换。编辑时留空表示保持原值',
      visibleIf: { authType: ['key'] },
    },
    $passphrase: {
      type: 'password',
      placeholder: '私钥未加密时留空',
      visibleIf: { authType: ['key'] },
    },
    $keyState: { widget: 'text', visibleIf: { authType: ['key'] } },
    $charset: { widget: 'select' },
    $rootPath: { placeholder: 'SFTP 的起始目录，留空表示用户 home（P1 功能，当前仅登记）' },
    $status: { checkedChildren: '启用', unCheckedChildren: '禁用' },
    $createAt: { widget: 'at' },
    $updateAt: { widget: 'at' },
  };

  /** 页面初始化 */
  ngOnInit(): void {
    if (!this.recordId) {
      return;
    }
    this.cloudSrv.remote(this.recordId).subscribe({
      next: (remote) => {
        this.formData.set({
          name: remote.name,
          description: remote.description,
          host: remote.host,
          port: remote.port,
          authType: remote.authType,
          username: remote.username,
          // 注：凭据永不下发，这里一律留空；`keyState` 只负责告诉用户「已配置」
          password: '',
          privateKey: '',
          passphrase: '',
          keyState: remote.hasKey
            ? remote.hasPassphrase
              ? '已配置（含口令）'
              : '已配置'
            : '未配置',
          charset: remote.charset || 'utf-8',
          rootPath: remote.rootPath,
          status: remote.status,
          createAt: remote.create?.at ?? null,
          updateAt: remote.update?.at ?? null,
        });
      },
      error: (err: unknown) => {
        // 详情取不到时弹窗无法继续编辑，提示后关闭
        this.msgSrv.error(apiErrorMessage(err, '加载主机详情失败，请稍后重试！'));
        this.close();
      },
    });
  }

  /**
   * 保存主机（新建或更新）
   *
   * @param value SF 表单提交值
   */
  save(value: Record<string, unknown>): void {
    /** 鉴权方式 */
    const authType = value['authType'] === 'key' ? 'key' : 'password';
    /** 密码 */
    const password = String(value['password'] ?? '');
    /** 私钥 */
    const privateKey = String(value['privateKey'] ?? '');
    // 注：新建时必须齐一套凭据 —— 后端也会拦，这里先给一句人话，省一次往返
    if (!this.editable) {
      if (authType === 'password' && password.trim() === '') {
        this.msgSrv.error('密码鉴权时请填写登录密码！');
        return;
      }
      if (authType === 'key' && privateKey.trim() === '') {
        this.msgSrv.error('私钥鉴权时请填写私钥！');
        return;
      }
    }
    /** 提交信息 */
    const payload: RemotePayload = {
      name: String(value['name'] ?? '').trim(),
      description: String(value['description'] ?? '').trim(),
      host: String(value['host'] ?? '').trim(),
      port: Number(value['port'] ?? 22),
      authType,
      username: String(value['username'] ?? '').trim(),
      password,
      privateKey,
      passphrase: String(value['passphrase'] ?? ''),
      charset: String(value['charset'] ?? 'utf-8'),
      rootPath: String(value['rootPath'] ?? '').trim(),
      status: value['status'] === true,
    };
    if (this.recordId) {
      this.cloudSrv.updateRemote(this.recordId, payload).subscribe({
        next: () => this.done('保存成功'),
        error: (err: unknown) =>
          this.msgSrv.error(apiErrorMessage(err, '保存主机失败，请稍后重试！')),
      });
      return;
    }
    this.cloudSrv.createRemote(payload).subscribe({
      next: () => this.done('创建成功'),
      error: (err: unknown) =>
        this.msgSrv.error(apiErrorMessage(err, '创建主机失败，请稍后重试！')),
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
