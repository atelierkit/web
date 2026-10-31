import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import { SFSchema, SFUISchema } from '@delon/form';
import { SettingsService } from '@delon/theme';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { finalize } from 'rxjs';

import { userStatusLabel } from '../user.format';
import { ProfileUser, UserService } from '../user.service';

/**
 * 基本资料组件
 *
 * 注 1：只允许改昵称与头像 —— 状态与角色归管理端（`/auth/user`），这里提交上去也会被后端 DTO 剥掉
 * 注 2：登录用户名是登录凭据，只读展示
 * 注 3：表单为 `null` 时模板显示加载态，取数失败时置空对象，避免一直转圈
 */
@Component({
  selector: 'user-basic',
  templateUrl: './basic.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class UserBasicComponent implements OnInit {
  private readonly userSrv = inject(UserService);
  private readonly msgSrv = inject(NzMessageService);
  private readonly settingsSrv = inject(SettingsService);

  /** 表单数据，注：为 null 表示资料尚未就绪，模板据此显示加载态 */
  readonly formData = signal<Record<string, unknown> | null>(null);
  /** 保存请求在途 */
  readonly saving = signal(false);

  /** 表单配置 */
  readonly schema: SFSchema = {
    properties: {
      username: { type: 'string', title: '登录用户名' },
      email: { type: 'string', title: '邮箱' },
      name: { type: 'string', title: '昵称', minLength: 1, maxLength: 30 },
      avatar: { type: 'string', title: '头像地址', minLength: 1 },
      status: { type: 'string', title: '状态' },
      loginTimes: { type: 'number', title: '登录次数' },
      firstLoginAt: { type: 'number', title: '首次登录时间' },
      lastLoginIp: { type: 'string', title: '最后登录IP' },
      lastLoginAt: { type: 'number', title: '最后登录时间' },
      lastSessionAt: { type: 'number', title: '最后会话时间' },
    },
    required: ['name', 'avatar'],
  };

  /** 表单样式配置 */
  readonly ui: SFUISchema = {
    '*': { spanLabelFixed: 140, size: 'large', grid: { span: 24 } },
    $username: { widget: 'text' },
    $email: { widget: 'text', placeholder: '未绑定邮箱，可到「更换邮箱」绑定' },
    $name: { placeholder: '展示在页头与用户列表里的名字' },
    $avatar: { placeholder: '头像图片地址，留空会导致页头头像异常' },
    $status: { widget: 'text' },
    $loginTimes: { widget: 'text' },
    // 注：时间戳统一交给 `at` 小部件渲染，组件里不再手工格式化
    $firstLoginAt: { widget: 'at' },
    $lastLoginIp: { widget: 'text' },
    $lastLoginAt: { widget: 'at' },
    $lastSessionAt: { widget: 'at' },
  };

  /** 页面初始化 */
  ngOnInit(): void {
    this.load();
  }

  /** 加载当前登录用户的资料 */
  load(): void {
    this.userSrv.show().subscribe({
      next: (user) => this.formData.set(this.toForm(user)),
      error: (err: unknown) => {
        // 失败时也要给表单一个对象，否则模板会一直停在加载态
        this.formData.set({});
        this.msgSrv.error(apiErrorMessage(err, '加载个人资料失败，请稍后重试！'));
      },
    });
  }

  /**
   * 保存昵称与头像
   *
   * @param value SF 表单提交值
   */
  save(value: Record<string, unknown>): void {
    // 前置守卫：请求在途时直接忽略，避免重复提交
    if (this.saving()) {
      return;
    }
    /** 昵称 */
    const name = String(value['name'] ?? '').trim();
    /** 头像地址 */
    const avatar = String(value['avatar'] ?? '').trim();
    // 后端 DTO 这两个字段都是必填，前端先挡一次，避免白跑一趟接口
    if (!name || !avatar) {
      this.msgSrv.warning('昵称与头像地址不能为空！');
      return;
    }
    this.saving.set(true);
    this.userSrv
      .update({ name, avatar })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.msgSrv.success('信息修改完成');
          // 页头与用户菜单都读 SettingsService，改完立即同步，不必刷新整页
          this.settingsSrv.setUser({ ...this.settingsSrv.user, name, avatar });
          this.load();
        },
        error: (err: unknown) =>
          this.msgSrv.error(apiErrorMessage(err, '保存个人资料失败，请稍后重试！')),
      });
  }

  /**
   * 用户资料转表单值
   *
   * @param user 用户资料
   * @returns 表单值
   */
  private toForm(user: ProfileUser): Record<string, unknown> {
    return {
      username: user.username,
      email: user.email ?? '',
      name: user.name,
      avatar: user.avatar,
      status: userStatusLabel(user.status),
      loginTimes: user.loginTimes ?? 0,
      firstLoginAt: user.firstLoginAt ?? 0,
      lastLoginIp: user.lastLoginIp ?? '',
      lastLoginAt: user.lastLoginAt ?? 0,
      lastSessionAt: user.lastSessionAt ?? 0,
    };
  }
}
