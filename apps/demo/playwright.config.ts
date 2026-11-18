import { existsSync } from 'node:fs';

import { chromium, defineConfig, devices } from '@playwright/test';

// 端口避开常用 4173/5173：同机可能还有其它项目的 dev server 在跑。
const PORT = 4317;

/**
 * 默认用 Playwright 自带的 Chromium；如果本机没下过浏览器（`chromium.executablePath()`
 * 指向的文件不存在），自动退回系统 Chrome，避免 e2e 被一次 150MB 下载卡住。
 * 也可以用 `PLAYWRIGHT_CHANNEL=chrome` 显式指定。
 */
function resolveChannel(): string | undefined {
  if (process.env.PLAYWRIGHT_CHANNEL) return process.env.PLAYWRIGHT_CHANNEL;
  return existsSync(chromium.executablePath()) ? undefined : 'chrome';
}
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * e2e 跑的是 `vite build` 的产物（`vite preview`），不是 dev server，
 * 这样 CI 与本地验证的都是真正会发布的打包结果。
 * 单独跑 `npx playwright test` 会自动先 build 再起 preview。
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    channel: resolveChannel(),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command:
      'pnpm run build && pnpm exec vite preview --port 4317 --strictPort --host 127.0.0.1',
    url: `${BASE_URL}/demo-health.json`,
    cwd: import.meta.dirname,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
