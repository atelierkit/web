# 建议统一在 `widgets` 目录下自定义小部件

> 注：`@delon/form` 本身提供 NG-ZORRO 数据录入组件的全部实现，以及若干第三方组件的代码，可从[widgets-third](https://github.com/ng-alain/delon/tree/master/packages/form/widgets-third)中获取并放置 `widgets` 目录下注册即可。

## 已内置的自定义小部件

| KEY | 文件 | 用途 |
| --- | --- | --- |
| `at` | `at/at.widget.ts` | 只读展示时间戳（纯文本，不生成输入框） |

### `at`：时间戳只读展示

```ts
// schema：值就是后端原样的时间戳
createAt: { type: 'number', title: '创建时间' },
// ui：交给小部件格式化
$createAt: { widget: 'at' },

// 单位是秒时才需要声明 `timestamp: 's'`，缺省按毫秒
expiredAt: { type: 'number', title: '过期时间', timestamp: 's' },
$expiredAt: { widget: 'at' },
```

约定：

- 格式化规则与列表列的 `dateFormat: 'yyyy-MM-dd HH:mm:ss'` 一致，**不显示毫秒**；
- 空值（`null` / `undefined` / `0`）显示 `-`，不会出现 `1970-01-01`；
- 该小部件会把 `ui._required` 置为 `false`，所以这类字段不参与必填校验；
- 时间字段一律走它，页面里不要再自己 `formatDateTime` 后塞进 `formData` —— 那样表单值就变成展示文本了。
