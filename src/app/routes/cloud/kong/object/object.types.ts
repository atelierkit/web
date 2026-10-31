/**
 * 站点下可管理的 KONG 对象类型
 *
 * 注：与后端 `KONG_OBJECT_TYPES` 一一对应，后端拿它做白名单校验，这里只用于拼请求与类型约束
 */
export type KongObjectType =
  'routes' | 'services' | 'consumers' | 'certificates' | 'plugins' | 'upstreams';

/**
 * KONG 对象
 *
 * 注：各组对象字段差异很大且随 Kong 版本增减，前端不建模具体字段（列定义用字符串索引取，
 * 需要结构的地方就地收窄），否则每次 Kong 升级都要跟着改类型
 */
export type KongObject = Record<string, unknown>;

/** 对象编辑弹窗的动作 */
export type KongAction = 'add' | 'edit' | 'copy';

/** 对象编辑弹窗的入参 */
export interface KongObjectEditData {
  /** 站点ID */
  kongId: number;
  /** 对象类型 */
  type: KongObjectType;
  /** 动作，注：`copy` 表示读取现有对象后以新建方式提交 */
  action: KongAction;
  /** 对象ID，注：新建时为空 */
  id?: string;
}
