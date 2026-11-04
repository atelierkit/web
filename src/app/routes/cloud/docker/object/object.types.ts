/**
 * 宿主机下可管理的资源类型
 *
 * 注：与后端 `DOCKER_OBJECT_TYPES` 一一对应，后端拿它做白名单校验，这里只用于拼请求与类型约束
 */
export type DockerObjectType = 'containers' | 'images' | 'volumes' | 'networks';

/** 资源动作，注：与后端 `DOCKER_ACTION_NAMES` 一致 */
export type DockerAction = 'start' | 'stop' | 'restart' | 'remove';

/**
 * Docker 资源
 *
 * 注：后端已做投影（短 ID、端口文本、字节数等），字段随资源类型不同，前端不建模具体字段
 */
export type DockerObject = Record<string, unknown>;

/** 动作参数 */
export interface DockerActionOptions {
  /** 删除时是否强制，注：默认 false，需用户显式确认 */
  force?: boolean;
  /** 停止 / 重启前的等待秒数 */
  timeout?: number;
}

/** 批量动作的定义 */
export interface DockerBatchAction {
  /** 动作 */
  action: DockerAction;
  /** 按钮文案 */
  text: string;
  /** 二次确认文案 */
  confirm: string;
  /** 是否为危险操作（红色按钮） */
  danger?: boolean;
  /** 动作参数 */
  options?: DockerActionOptions;
}

/** 日志流 */
export type DockerLogStream = 'stdout' | 'stderr';

/** 一行日志，注：与后端 `DockerLogLine` 一一对应 */
export interface DockerLogLine {
  /** 时间戳（RFC3339Nano 原串），注：空串表示该行没有时间戳前缀 */
  ts: string;
  /** 所属流 */
  stream: DockerLogStream;
  /** 正文 */
  text: string;
  /** 本行因超过单行上限被截断 */
  truncated?: boolean;
  /** 流结束时残留的半行 */
  incomplete?: boolean;
}

/** 日志快照 */
export interface DockerLogSnapshot {
  /** 日志行，注：命中上限时丢弃的是最旧的行 */
  lines: DockerLogLine[];
  /** 容器是否为 TTY 模式，注：为真时无法区分 stdout/stderr */
  tty: boolean;
  /** 是否因行数 / 字节上限发生过丢弃 */
  truncated: boolean;
}

/** 日志快照的查询参数 */
export interface DockerLogQuery {
  /** 拉取的历史行数 */
  tail?: number;
  /** 起始时刻 */
  since?: string;
  /** 行首是否带时间戳 */
  timestamps?: boolean;
}
