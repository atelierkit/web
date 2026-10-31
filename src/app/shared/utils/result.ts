/**
 * 业务操作结果
 *
 * 注：后端「只回一句提示」类接口（改密 / 重置密码 / 发送验证码 / 激活邮箱）统一返回 `{ code, msg }`，
 * `code` 为 0 表示成功；失败走 HTTP 异常，不会返回 `code !== 0`，所以前端只需在 next 分支取 `msg`
 */
export interface OperationResult {
  /** 业务状态码，0 表示成功 */
  code: number;
  /** 提示文案，注：可直接展示给用户（改密会说明踢掉了几个其它会话） */
  msg: string;
}
