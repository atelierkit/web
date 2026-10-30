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
      // 目前承诺的是 core 层的用例，页面组件尚未补 TestBed 用例、也不在统计内。
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
