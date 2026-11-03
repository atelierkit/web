/**
 * 集群下可管理的资源类型
 *
 * 注：与后端 `KUBERNETES_OBJECT_TYPES` 一一对应，后端拿它做白名单校验，这里只用于拼请求与类型约束
 */
export type KubernetesObjectType =
  'namespaces' | 'nodes' | 'pods' | 'deployments' | 'statefulsets' | 'services';

/** 资源动作，注：与后端 `KUBERNETES_ACTION_NAMES` 一致 */
export type KubernetesAction = 'remove' | 'scale' | 'restart' | 'cordon' | 'uncordon';

/**
 * 集群资源
 *
 * 注：后端已做投影（就绪数文本、CPU 核数、内存字节、端口文本等），字段随资源类型不同，
 * 前端不建模具体字段
 */
export type KubernetesObject = Record<string, unknown>;

/** 动作参数 */
export interface KubernetesActionOptions {
  /** 扩缩容的目标副本数 */
  replicas?: number;
  /** 删除时的优雅退出秒数，注：不传交给 Pod 自己 */
  gracePeriod?: number;
}

/** 批量动作的定义 */
export interface KubernetesBatchAction {
  /** 动作 */
  action: KubernetesAction;
  /** 按钮文案 */
  text: string;
  /** 二次确认文案 */
  confirm: string;
  /** 是否为危险操作（红色按钮） */
  danger?: boolean;
  /** 动作参数 */
  options?: KubernetesActionOptions;
}
