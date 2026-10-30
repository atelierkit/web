import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import { SFSchema, SFUISchema } from '@delon/form';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';

import { AuthService, RolePayload } from '../../auth.service';

/** 角色弹窗入参 */
interface RoleEditData {
  /** 角色标识，注：缺省表示新建 */
  id?: string;
}

/**
 * 角色编辑组件
 *
 * 负责角色的创建与编辑，以弹窗形式由角色列表打开；
 * 表单用 `@delon/form` 的 SF 动态表单（schema 驱动，替代手写 ReactiveForms）
 */
@Component({
  selector: 'auth-role-edit',
  templateUrl: './edit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class AuthRoleEditComponent implements OnInit {
  private readonly authSrv = inject(AuthService);
  private readonly modalRef = inject(NzModalRef);
  private readonly msgSrv = inject(NzMessageService);
  /** 弹窗入参 */
  private readonly data = inject<RoleEditData>(NZ_MODAL_DATA);

  /** 待编辑的角色标识，注：为空表示新建 */
  readonly recordId = this.data?.id;
  /** 是否编辑态，注：编辑态下角色标识不可改（它是鉴权比对用的键） */
  readonly editable = !!this.recordId;
  /** 详情加载标记，注：为 null 表示尚未就绪，SF 模板据此显示加载态 */
  readonly formData = signal<Record<string, unknown> | null>(
    this.editable ? null : { status: true },
  );

  /** 表单 schema */
  readonly schema: SFSchema = {
    properties: {
      id: {
        type: 'string',
        title: '角色标识',
        maxLength: 30,
        // 注：编辑态下角色标识是主键、不可改，只读化由下方 ui 控制
        readOnly: this.editable,
      },
      name: { type: 'string', title: '名称', maxLength: 30 },
      description: {
        type: 'string',
        title: '描述',
        maxLength: 200,
        ui: { widget: 'textarea', autosize: { minRows: 2, maxRows: 4 } },
      },
      status: { type: 'boolean', title: '状态' },
    },
    // 注：与后端 RoleUpdateDto 对齐，四字段皆必填；status 为布尔，false 也是合法值
    required: ['id', 'name', 'description', 'status'],
  };

  /** 表单样式 */
  readonly ui: SFUISchema = {
    $id: {
      placeholder: '鉴权用的唯一标识，如 admin',
      // 编辑态把「只读」落在 ui 层，避免主键被误改后撞主键或破坏鉴权比对
      readOnly: this.editable,
    },
    $name: { placeholder: '展示用名称' },
    $description: { placeholder: '角色职责说明' },
    $status: { checkedChildren: '启用', unCheckedChildren: '禁用' },
  };

  /** 页面初始化 */
  ngOnInit(): void {
    if (!this.recordId) {
      return;
    }
    this.authSrv.role(this.recordId).subscribe({
      next: (role) => {
        this.formData.set({
          id: role.id,
          name: role.name,
          description: role.description,
          status: role.status,
        });
      },
      error: (err: unknown) => {
        // 详情取不到时弹窗无法继续编辑，提示后关闭
        this.msgSrv.error(apiErrorMessage(err, '加载角色详情失败，请稍后重试！'));
        this.close();
      },
    });
  }

  /**
   * 保存角色信息（新建或更新）
   *
   * @param value SF 表单提交值
   */
  save(value: Record<string, unknown>): void {
    /** 提交信息，注：编辑态下 id 只读但仍在值里，直接取用即可 */
    const payload: RolePayload = {
      id: String(value['id'] ?? '').trim(),
      name: String(value['name'] ?? '').trim(),
      description: String(value['description'] ?? '').trim(),
      status: value['status'] as boolean,
    };
    /** 提交请求 */
    const request =
      this.editable && this.recordId
        ? this.authSrv.updateRole(this.recordId, payload)
        : this.authSrv.createRole(payload);
    request.subscribe({
      next: () => {
        this.msgSrv.success(this.editable ? '保存成功' : '创建成功');
        this.modalRef.close(true);
      },
      error: (err: unknown) =>
        this.msgSrv.error(
          apiErrorMessage(
            err,
            this.editable ? '保存角色失败，请稍后重试！' : '创建角色失败，请稍后重试！',
          ),
        ),
    });
  }

  /** 关闭弹窗 */
  close(): void {
    this.modalRef.close(false);
  }
}
