import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    isolate: true,
    testTimeout: 2000,
    hookTimeout: 2000,
    browser: {
      screenshotFailures: false,
    },
    coverage: {
      // 注：`@angular/build:unit-test` 会自己决定统计范围（被测试加载过的文件），
      // 在这里写 include 会与它冲突（实测覆盖率直接算成 0%），因此只设门槛不圈口径。
      // 由此带来一个坑：页面组件一旦被某个 spec 加载（哪怕只想测它的一个纯函数），
      // 它 import 的 `SHARED_IMPORTS` 会把整片页面模块带进分母，实测全局语句覆盖率 92% → 72%。
      // 所以纯函数要抽到 `*.format.ts` 这类独立模块里测，别从组件文件里导入。
      // 门槛设在实际值下方 2-3 个百分点，防回退又不容易误红；
      // 注：只有 `ng test -c coverage --coverage` 会校验门槛（CI 跑这条），钩子里的 `ng test` 不跑覆盖率。
      thresholds: {
        statements: 90,
        branches: 78,
        functions: 88,
        lines: 92,
      },
    },
  },
});
