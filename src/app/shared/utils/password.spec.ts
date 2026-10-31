import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import { PASSWORD_MAX, PASSWORD_MIN, PASSWORD_PATTERN, passwordValidator } from './password';

/**
 * 校验结果
 *
 * @param value 密码
 * @returns 校验器返回的错误
 */
function validate(value: string): unknown {
  return passwordValidator(new FormControl(value));
}

describe('password 规则', () => {
  it('长度上下限与后端 PASSWORD_MIN / PASSWORD_MAX 一致', () => {
    // 注：后端 user.constant.ts 的 PASSWORD_MIN=8 / PASSWORD_MAX=64，改一边必须改另一边
    expect(PASSWORD_MIN).toBe(8);
    expect(PASSWORD_MAX).toBe(64);
  });

  it('表单 pattern 与校验器口径一致（都要求字母 + 数字）', () => {
    expect(PASSWORD_PATTERN.test('abc12345')).toBe(true);
    expect(PASSWORD_PATTERN.test('abcdefgh')).toBe(false);
    expect(PASSWORD_PATTERN.test('12345678')).toBe(false);
    expect(PASSWORD_PATTERN.test('ab1')).toBe(false);
  });

  it('纯字母或纯数字判为复杂度不足', () => {
    expect(validate('abcdefgh')).toEqual({ password: true });
    expect(validate('12345678')).toEqual({ password: true });
  });

  it('字母 + 数字通过（不强制大小写与符号）', () => {
    expect(validate('abc12345')).toBeNull();
    expect(validate('ABC12345')).toBeNull();
  });

  it('空值放行，必填交给 required', () => {
    expect(validate('')).toBeNull();
  });

  it('长度不在此校验内，避免与 minLength / maxLength 的提示打架', () => {
    // 注：1 位但含字母与数字，复杂度校验应通过（长度由另一个校验器负责）
    expect(validate('a1')).toBeNull();
  });
});
