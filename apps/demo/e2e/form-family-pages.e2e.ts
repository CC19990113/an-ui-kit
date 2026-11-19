import { expect, test } from '@playwright/test';

import {
  FRAMEWORKS,
  closeSelect,
  dayButton,
  familyState,
  fileInput,
  host,
  openDatePanel,
  openDemo,
  pickOption,
  pngFile,
  submitFamily,
} from './family-helpers';

/**
 * 三框架同构 smoke：native / react / vue 三页同一套 data-testid 契约，
 * 7 个新增组件每页都真实渲染并可用。深行为在各自组件文件里跑 native 页。
 */
for (const framework of FRAMEWORKS) {
  test.describe(`${framework.name} (${framework.path}) · 表单族 smoke`, () => {
    test('7 个组件都可用，提交结果一致', async ({ page }) => {
      await openDemo(page, framework.path);

      // select 单选 / 多选
      await pickOption(page, 'family-select-single', '上海');
      const multi = host(page, 'family-select-multi');
      await multi.locator('[part="trigger"]').click();
      await multi.locator('[part="option"]', { hasText: 'Vue' }).click();
      await closeSelect(multi);

      // upload（auto-upload 关闭，文件进队列）
      await fileInput(host(page, 'family-upload')).setInputFiles(pngFile());
      await expect(host(page, 'family-upload').locator('[part="item"]')).toHaveCount(1);

      // number 步进
      await host(page, 'family-number').locator('[part="spin-up"]').click();

      // date / date-range
      const date = host(page, 'family-date');
      await openDatePanel(date);
      await dayButton(date, '2026-11-15').click();

      const range = host(page, 'family-range');
      await openDatePanel(range);
      await dayButton(range, '2026-11-12').click();
      await dayButton(range, '2026-11-17').click();

      // checkbox-group
      await host(page, 'family-checkbox-group').locator('an-checkbox[value="perf"]').click();

      await submitFamily(page);

      const state = await familyState(page);
      expect(state.submit).toBe(1);
      expect(state.values).toMatchObject({
        single: 'sh',
        tags: 'vue',
        quantity: '5',
        day: '2026-11-15',
        from: '2026-11-12',
        to: '2026-11-17',
        topics: ['a11y', 'perf'],
      });
      expect(state.entries.find((entry) => entry.name === 'attachment')?.file?.name).toBe(
        'pixel.png',
      );
    });
  });
}
