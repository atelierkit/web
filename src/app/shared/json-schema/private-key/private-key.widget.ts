import { ChangeDetectionStrategy, Component, ElementRef, signal, viewChild } from '@angular/core';
import { ControlWidget, DelonFormModule } from '@delon/form';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';

/** 私钥文件的大小上限（字节），注：与后端 `MAX_KEY_CHARS` 对应 —— 2048 位 RSA 的 PEM 约 1.7 KB */
const MAX_FILE_BYTES = 16 * 1024;

/**
 * 私钥录入小部件
 *
 * 注 1：主路径是**选择本地私钥文件** —— 私钥都是本地文件，让用户打开文件再复制粘贴纯属多一道手；
 * 复制过程还容易漏掉首尾行，那是最难排查的一类「私钥看起来没问题但解析不了」
 * 注 2：小部件只负责读文件与写字段值，**不做格式识别**（那是后端 `POST /cloud/remote/key/inspect` 的事）：
 * 识别要调 HTTP 与业务服务，放进来会让 `shared` 反向依赖 `routes`
 * 注 3：保留「手动粘贴」折叠入口 —— 从跳板机 / 聊天窗口里拿到的私钥没有本地文件
 */
@Component({
  selector: 'sf-widget-private-key',
  templateUrl: './private-key.widget.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DelonFormModule, NzAlertModule, NzButtonModule, NzInputModule],
})
export class PrivateKeyWidget extends ControlWidget {
  /** 小部件 key，schema 里通过 `ui: { $字段: { widget: 'privateKey' } }` 指定 */
  static readonly KEY = 'privateKey';

  /** 隐藏的文件选择框，注：交给浏览器原生选择器，不引入 `nz-upload`（这里不需要上传） */
  private readonly picker = viewChild<ElementRef<HTMLInputElement>>('picker');

  /** 已选文件名 */
  readonly fileName = signal('');
  /** 已选文件大小（字节） */
  readonly fileSize = signal(0);
  /** 手动粘贴区是否展开 */
  readonly pasting = signal(false);
  /** 字段当前文本，注：粘贴区与「已填写」提示都读它 */
  readonly text = signal('');
  /** 是否已有内容，注：编辑态为空表示「不修改」 */
  readonly hasContent = signal(false);
  /** 本地提示（文件过大 / 读不出来），与字段自身的校验错误分开显示 */
  readonly localError = signal('');

  /**
   * 字段值回填
   *
   * 注：框架在初始化与值变化时都会调；编辑态后端不下发私钥，这里通常是空串
   *
   * @param value 字段值
   */
  override reset(value: string | null | undefined): void {
    /** 当前文本 */
    const text = value ?? '';
    // 注：用 `set` 前先比较，避免把 textarea 的绑定值重置一遍导致光标跳到末尾
    if (this.text() !== text) {
      this.text.set(text);
    }
    this.hasContent.set(text.trim() !== '');
    if (text === '') {
      this.fileName.set('');
      this.fileSize.set(0);
      this.localError.set('');
    }
  }

  /**
   * 已选文件的体积文案
   *
   * @returns 如 `1.7 KB`，未选文件时为空串
   */
  sizeText(): string {
    if (this.fileSize() <= 0) {
      return '';
    }
    return `${(this.fileSize() / 1024).toFixed(1)} KB`;
  }

  /** 打开文件选择框 */
  pick(): void {
    this.picker()?.nativeElement.click();
  }

  /** 切换手动粘贴区 */
  togglePaste(): void {
    this.pasting.update((open) => !open);
  }

  /**
   * 选中文件后的处理
   *
   * 注：`file.text()` 按 UTF-8 解码 —— 私钥一定是 ASCII（PEM 正文是 base64），
   * 不存在 GBK 之类的可能，故不必像终端那样考虑字符集
   *
   * @param event 文件选择事件
   */
  async onFile(event: Event): Promise<void> {
    /** 选择框元素 */
    const input = event.target as HTMLInputElement;
    /** 选中的文件 */
    const file = input.files?.[0];
    // 注：清空选择框的值，否则再次选同一个文件不会触发 change
    input.value = '';
    if (!file) {
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      this.localError.set(
        `文件过大（${(file.size / 1024).toFixed(1)} KB，上限 16 KB），请确认选择的是私钥文件本身！`,
      );
      return;
    }
    /** 文件内容，注：`file.text()` 失败时在下面 return，故这里不需要初值 */
    let content: string;
    try {
      content = await file.text();
    } catch {
      this.localError.set('读取文件失败，请确认文件是否被其他程序占用后重试！');
      return;
    }
    if (content.trim() === '') {
      this.localError.set('这个文件是空的，请重新选择私钥文件！');
      return;
    }
    this.localError.set('');
    this.fileName.set(file.name);
    this.fileSize.set(file.size);
    this.pasting.set(false);
    this.setValue(content);
    this.reset(content);
  }

  /**
   * 手动粘贴的输入
   *
   * @param event 输入事件
   */
  onInput(event: Event): void {
    /** 输入框当前内容 */
    const content = (event.target as HTMLTextAreaElement).value ?? '';
    this.text.set(content);
    this.hasContent.set(content.trim() !== '');
    this.localError.set('');
    this.setValue(content);
  }

  /** 清空字段 */
  clear(): void {
    this.localError.set('');
    this.fileName.set('');
    this.fileSize.set(0);
    this.setValue('');
    this.reset('');
  }
}
