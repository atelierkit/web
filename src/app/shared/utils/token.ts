/** 令牌有效期可选档位（单位：分钟），注：0 表示长期有效，与后端白名单保持一致 */
export const TOKEN_VALID_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 60, label: '1小时' },
  { value: 1440, label: '1天' },
  { value: 10080, label: '7天' },
  { value: 43200, label: '30天' },
  { value: 0, label: '长期有效' },
];

/** 令牌有效期默认档位（单位：分钟），注：与后端 TOKEN_VALID_DEFAULT 保持一致 */
export const TOKEN_VALID_DEFAULT = 1440;

/**
 * 获取令牌有效期文案
 *
 * @param valid 有效期（单位：分钟），注：0 表示长期有效
 * @returns 有效期文案
 */
export function tokenValidLabel(valid: number): string {
  return TOKEN_VALID_OPTIONS.find((item) => item.value === valid)?.label ?? `${valid}分钟`;
}
