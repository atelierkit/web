import type { AbstractControl, ValidationErrors } from '@angular/forms';

/** 密码最小长度，注：与后端 `PASSWORD_MIN` 保持一致 */
export const PASSWORD_MIN = 8;

/** 密码最大长度，注：与后端 `PASSWORD_MAX` 保持一致 */
export const PASSWORD_MAX = 64;

/**
 * 密码规则
 *
 * 注：与后端 `UserService.checkPassword` 一致 —— 8-64 位、必须同时包含字母与数字；
 * 故意不强制大小写与符号，个人工具自己都记不住就没意义了
 */
export const PASSWORD_PATTERN = /^(?=.*[a-zA-Z])(?=.*\d).{8,64}$/;

/**
 * 密码复杂度校验
 *
 * 注 1：长度交给 `Validators.minLength` / `Validators.maxLength`，本校验只管「字母 + 数字」，
 * 这样表单提示才能分别显示「长度不对」与「复杂度不够」
 * 注 2：空值直接放行，必填由 `Validators.required` 负责
 *
 * @param control 表单控件
 * @returns 校验结果
 */
export function passwordValidator(control: AbstractControl): ValidationErrors | null {
  /** 密码值 */
  const value = String(control.value ?? '');
  if (!value) {
    return null;
  }
  if (!/[a-zA-Z]/.test(value) || !/\d/.test(value)) {
    return { password: true };
  }
  return null;
}
