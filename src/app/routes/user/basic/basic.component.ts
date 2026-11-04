import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '@core';
import { SFSchema, SFUISchema } from '@delon/form';
import { SHARED_IMPORTS, UserAvatar } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzUploadFile, NzUploadModule } from 'ng-zorro-antd/upload';
import { finalize, firstValueFrom } from 'rxjs';

import { AVATAR_SIDE, cropRectOf, userStatusLabel } from '../user.format';
import { ProfileUser, UserService } from '../user.service';

/**
 * 基本资料组件
 *
 * 注 1：只允许改昵称与头像 —— 状态与角色归管理端（`/auth/user`），这里提交上去也会被后端 DTO 剥掉
 * 注 2：登录用户名是登录凭据，只读展示
 * 注 3：表单为 `null` 时模板显示加载态，取数失败时置空对象，避免一直转圈
 * 注 4：头像不再让用户填地址 —— 走上传，前端先裁成 256×256 的正方形再提交，
 *      否则用户传一张 4MB 的手机原图，页头加载会明显拖慢
 */
@Component({
  selector: 'user-basic',
  templateUrl: './basic.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS, UserAvatar, NzUploadModule],
})
export class UserBasicComponent implements OnInit {
  private readonly userSrv = inject(UserService);
  private readonly msgSrv = inject(NzMessageService);

  /** 表单数据，注：为 null 表示资料尚未就绪，模板据此显示加载态 */
  readonly formData = signal<Record<string, unknown> | null>(null);
  /** 保存请求在途 */
  readonly saving = signal(false);
  /** 当前头像地址（后端下发的可加载地址，空串表示未设置，模板回退首字符） */
  readonly avatar = signal('');
  /** 昵称，注：头像回退文本用它 */
  readonly nickname = signal('');
  /** 登录用户名，注：昵称为空时兜底 */
  readonly username = signal('');
  /** 头像上传在途 */
  readonly uploading = signal(false);

  /** 表单配置 */
  readonly schema: SFSchema = {
    properties: {
      username: { type: 'string', title: '登录用户名' },
      email: { type: 'string', title: '邮箱' },
      name: { type: 'string', title: '昵称', minLength: 1, maxLength: 30 },
      status: { type: 'string', title: '状态' },
      loginTimes: { type: 'number', title: '登录次数' },
      firstLoginAt: { type: 'number', title: '首次登录时间' },
      lastLoginIp: { type: 'string', title: '最后登录IP' },
      lastLoginAt: { type: 'number', title: '最后登录时间' },
      lastSessionAt: { type: 'number', title: '最后会话时间' },
    },
    required: ['name'],
  };

  /** 表单样式配置 */
  readonly ui: SFUISchema = {
    '*': { spanLabelFixed: 140, size: 'large', grid: { span: 24 } },
    $username: { widget: 'text' },
    $email: { widget: 'text', placeholder: '未绑定邮箱，可到「更换邮箱」绑定' },
    $name: { placeholder: '展示在页头与用户列表里的名字' },
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

  /**
   * 选中文件后的处理
   *
   * 注：返回 false 阻止 `nz-upload` 自己发请求 —— 请求必须走 `UserService`，
   * 否则拿不到统一拦截器里的令牌与错误处理
   *
   * @param file 用户选中的文件
   * @returns 恒为 false
   */
  protected readonly beforeUpload = (file: NzUploadFile): boolean => {
    // nz-upload 不做包装，运行时拿到的就是 File（只是多挂了一个 uid），这里做一次类型收窄
    void this.upload(file as unknown as File);
    return false;
  };

  /** 加载当前登录用户的资料 */
  load(): void {
    this.userSrv.show().subscribe({
      next: (user) => {
        this.avatar.set(user.avatar ?? '');
        this.nickname.set(user.name ?? '');
        this.username.set(user.username ?? '');
        this.formData.set(this.toForm(user));
      },
      error: (err: unknown) => {
        // 失败时也要给表单一个对象，否则模板会一直停在加载态
        this.formData.set({});
        this.msgSrv.error(apiErrorMessage(err, '加载个人资料失败，请稍后重试！'));
      },
    });
  }

  /**
   * 保存昵称
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
    if (!name) {
      this.msgSrv.warning('昵称不能为空！');
      return;
    }
    this.saving.set(true);
    this.userSrv
      .update({ name })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.msgSrv.success('信息修改完成');
          // 页头与侧栏都读 SettingsService，改完立即写回，不必刷新整页
          this.nickname.set(name);
          this.userSrv.syncProfile({ name });
          this.load();
        },
        error: (err: unknown) =>
          this.msgSrv.error(apiErrorMessage(err, '保存个人资料失败，请稍后重试！')),
      });
  }

  /**
   * 上传头像
   *
   * @param file 用户选中的原图
   */
  private async upload(file: File): Promise<void> {
    if (this.uploading()) {
      return;
    }
    // 只做第一道筛：真正的格式判定在后端按文件头做，前端这道只为给出更快的提示
    if (!/^image\/(?:png|jpeg|webp)$/i.test(file.type)) {
      this.msgSrv.warning('仅支持 PNG、JPEG、WebP 格式的图片！');
      return;
    }
    this.uploading.set(true);
    try {
      /** 压缩后的图片 */
      const blob = await this.cropToBlob(file);
      /** 上传结果 */
      const result = await firstValueFrom(this.userSrv.uploadAvatar(blob));
      this.avatar.set(result.avatar);
      // 页头与侧栏都读 SettingsService，上传后立即写回，不必刷新整页；
      // 后端按 UUID 命名，新旧地址必然不同，图片不会被浏览器缓存成旧图
      this.userSrv.syncProfile({ avatar: result.avatar });
      this.msgSrv.success('头像已更新');
    } catch (err) {
      this.msgSrv.error(apiErrorMessage(err, '头像上传失败，请稍后重试！'));
    } finally {
      this.uploading.set(false);
    }
  }

  /**
   * 居中裁剪并压缩为 WebP
   *
   * 注：用 `createImageBitmap` + `imageOrientation: 'from-image'` 修手机竖拍横躺；
   * 个别浏览器不认这个选项，降级时仍能裁剪，只是方向可能依赖 EXIF
   *
   * @param file 原图
   * @returns 256×256 的图片数据
   */
  private async cropToBlob(file: File): Promise<Blob> {
    /** 解码后的位图 */
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      bitmap = await createImageBitmap(file);
    }
    try {
      /** 裁剪区域 */
      const { sx, sy, size } = cropRectOf(bitmap.width, bitmap.height);
      if (!size) {
        throw new Error('图片尺寸不合法');
      }
      /** 画布 */
      const canvas = document.createElement('canvas');
      canvas.width = AVATAR_SIDE;
      canvas.height = AVATAR_SIDE;
      /** 2D 上下文 */
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('当前浏览器不支持图片处理');
      }
      ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, AVATAR_SIDE, AVATAR_SIDE);
      /** 压缩后的图片，注：浏览器不支持 WebP 时会回退 PNG，后端两种都收 */
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', 0.85),
      );
      if (!blob) {
        throw new Error('图片压缩失败');
      }
      return blob;
    } finally {
      bitmap.close();
    }
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
      status: userStatusLabel(user.status),
      loginTimes: user.loginTimes ?? 0,
      firstLoginAt: user.firstLoginAt ?? 0,
      lastLoginIp: user.lastLoginIp ?? '',
      lastLoginAt: user.lastLoginAt ?? 0,
      lastSessionAt: user.lastSessionAt ?? 0,
    };
  }
}
