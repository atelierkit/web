import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import { SFSchema, SFUISchema } from '@delon/form';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { catchError, map, of } from 'rxjs';

import { AuthRole, AuthService, UserCreatePayload, UserUpdatePayload } from '../../auth.service';

/** 用户名规则，注：与后端 USERNAME_RE 保持一致（后端入库前统一转小写） */
const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;

/** 密码规则，注：与后端 PASSWORD_MIN/MAX 与「必须含字母和数字」保持一致 */
const PASSWORD_RE = /^(?=.*[a-zA-Z])(?=.*\d).{8,64}$/;

/** 用户弹窗入参 */
interface UserEditData {
  /** 用户ID，注：缺省表示新建 */
  id?: number;
}

/** 角色下拉项，注：SF 的 select 枚举要求 { label, value } 结构 */
interface RoleOption {
  /** 展示文案 */
  label: string;
  /** 角色标识 */
  value: string;
}

/**
 * 用户编辑组件
 *
 * 负责建号与编辑资料；建号必须带登录用户名与密码，编辑态不含改密；
 * 表单用 `@delon/form` 的 SF 动态表单（schema 驱动，替代手写 ReactiveForms）
 */
@Component({
  selector: 'auth-user-edit',
  templateUrl: './edit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class AuthUserEditComponent implements OnInit {
  private readonly authSrv = inject(AuthService);
  private readonly modalRef = inject(NzModalRef);
  private readonly msgSrv = inject(NzMessageService);
  /** 弹窗入参 */
  private readonly data = inject<UserEditData>(NZ_MODAL_DATA);

  /** 待编辑的用户ID，注：为空表示新建 */
  readonly recordId = this.data?.id;
  /** 是否编辑态 */
  readonly editable = !!this.recordId;
  /** 表单数据，注：为 null 表示详情尚未就绪，SF 模板据此显示加载态 */
  readonly formData = signal<Record<string, unknown> | null>(
    this.editable ? null : { status: true, roles: [] },
  );

  /** 表单 schema */
  readonly schema: SFSchema = {
    properties: {
      username: {
        type: 'string',
        title: '用户名',
        maxLength: 20,
        pattern: USERNAME_RE.source,
        // 注：编辑态用户名是登录凭据、不可改，只读化由下方 ui 控制
        readOnly: this.editable,
      },
      password: {
        type: 'string',
        title: '密码',
        minLength: 8,
        maxLength: 64,
        pattern: PASSWORD_RE.source,
        // 注：编辑态不含改密，隐藏字段（隐藏项不参与校验）
        // 注：@delon/form 22 无独立 password widget，用 string widget 的 type 属性渲染密码框
        ui: { type: 'password', hidden: this.editable },
      },
      name: { type: 'string', title: '昵称', maxLength: 30 },
      avatar: { type: 'string', title: '头像' },
      email: { type: 'string', title: '邮箱', format: 'email' },
      roles: {
        // 注：多选字符串数组。不能写 type:'array'——SF 会套用 ArrayProperty（数组对象模型），
        // 它遍历每个元素用 schema.items 建子属性，基础类型数组没有 items 会抛
        // `Cannot read properties of undefined (reading '$ref')`；带 items 又会触发
        // resolveIfSchema 的 `Object.keys(undefined)`。故用 type:'string' + select multiple，
        // SelectWidget 多选时直接把字符串数组写入值，选项由 ui.$roles.asyncData 提供。
        type: 'string',
        title: '角色',
        default: [],
      },
      status: { type: 'boolean', title: '状态' },
      // 注：审计字段放在表单末尾做只读展示，仅在编辑态出现
      ...(this.editable
        ? {
            createAt: { type: 'number', title: '创建时间' },
            updateAt: { type: 'number', title: '更新时间' },
          }
        : {}),
    },
    // 注：必填项与后端 DTO 对齐 —— 新建只有用户名+密码必填，其余可选；
    // 编辑态只提交改动字段，全部可选（用户名只读展示，后端 update 不接收用户名）
    required: this.editable ? [] : ['username', 'password'],
  };

  /** 表单样式 */
  readonly ui: SFUISchema = {
    $username: {
      placeholder: '登录用户名（3-20 位字母、数字、下划线或短横线）',
      // 编辑态把「只读」落在 ui 层，避免登录凭据被误改
      readOnly: this.editable,
    },
    $password: { placeholder: '初始密码（8-64 位，含字母和数字）' },
    $name: { placeholder: '缺省取用户名' },
    $avatar: { placeholder: '头像图片地址' },
    $email: { placeholder: '可选资料，用于找回密码' },
    $roles: {
      widget: 'select',
      mode: 'multiple',
      placeholder: '未授权任何角色',
      // 注：角色清单动态拉取，失败时退化为管理员一项，避免下拉为空导致无法授权
      asyncData: () =>
        this.authSrv.roles().pipe(
          map((rows) => this.toOptions(rows)),
          catchError(() => of([{ label: '管理员', value: 'admin' }])),
        ),
    },
    $status: { checkedChildren: '启用', unCheckedChildren: '禁用' },
    // 注：时间戳只读展示，格式化交给 `at` 小部件（shared/json-schema/at）
    $createAt: { widget: 'at' },
    $updateAt: { widget: 'at' },
  };

  /** 页面初始化 */
  ngOnInit(): void {
    if (!this.recordId) {
      return;
    }
    this.authSrv.user(this.recordId).subscribe({
      next: (user) => {
        this.formData.set({
          username: user.username,
          name: user.name,
          avatar: user.avatar,
          email: user.email ?? '',
          roles: user.roles ?? [],
          status: user.status,
          // 注：只读项给原始时间戳，格式化由 `at` 小部件负责
          createAt: user.create?.at ?? null,
          updateAt: user.update?.at ?? null,
        });
      },
      error: (err: unknown) => {
        // 详情取不到时弹窗无法继续编辑，提示后关闭
        this.msgSrv.error(apiErrorMessage(err, '加载用户详情失败，请稍后重试！'));
        this.close();
      },
    });
  }

  /**
   * 保存用户信息（新建或更新）
   *
   * @param value SF 表单提交值
   */
  save(value: Record<string, unknown>): void {
    /** 电子邮箱，注：空串表示清空（后端转 NULL，避免撞唯一索引） */
    const email = String(value['email'] ?? '').trim();
    if (this.recordId) {
      /** 更新信息，注：不含用户名与密码，改密走用户自己的设置页或邮箱重置 */
      const payload: UserUpdatePayload = {
        name: String(value['name'] ?? '').trim(),
        avatar: String(value['avatar'] ?? '').trim(),
        email,
        status: value['status'] as boolean,
        roles: (value['roles'] as string[] | undefined) ?? [],
      };
      this.authSrv.updateUser(this.recordId, payload).subscribe({
        next: () => this.done('保存成功'),
        error: (err: unknown) =>
          this.msgSrv.error(apiErrorMessage(err, '保存用户信息失败，请稍后重试！')),
      });
      return;
    }
    /** 创建信息，注：用户名提交前转小写，密码明文交由服务端校验与哈希 */
    const payload: UserCreatePayload = {
      username: String(value['username'] ?? '')
        .trim()
        .toLowerCase(),
      password: String(value['password'] ?? ''),
      name: String(value['name'] ?? '').trim(),
      avatar: String(value['avatar'] ?? '').trim(),
      email,
      status: value['status'] as boolean,
      roles: (value['roles'] as string[] | undefined) ?? [],
    };
    this.authSrv.createUser(payload).subscribe({
      next: () => this.done('创建成功'),
      error: (err: unknown) =>
        this.msgSrv.error(apiErrorMessage(err, '创建用户失败，请稍后重试！')),
    });
  }

  /** 关闭弹窗 */
  close(): void {
    this.modalRef.close(false);
  }

  /**
   * 角色清单转下拉项
   *
   * @param rows 角色清单，注：类型与角色提交信息不同，只用到 id / name
   * @returns 下拉项
   */
  private toOptions(rows: AuthRole[]): RoleOption[] {
    return rows.map((item) => ({ label: item.name, value: item.id }));
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
