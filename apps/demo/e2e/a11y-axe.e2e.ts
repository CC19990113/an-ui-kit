import { expect, test } from '@playwright/test';

import { scanAxe } from './axe-helpers';
import {
  fileInput,
  familyErrors,
  familySubmit,
  FRAMEWORKS,
  host,
  openDatePanel,
  openDemo,
  openSelect,
  pngFile,
  T,
} from './family-helpers';

/**
 * axe-core 全量扫描：native / react / vue 三页的表单族区块，
 * 覆盖 select（面板打开）、date（面板打开）、upload（队列有文件）、
 * number（静态 + 错误态）与 `an-form` 的校验错误态。
 *
 * 扫描范围是 `[data-testid="family-form"]`；组件内部的 open shadow root
 * 由 axe 自己穿透。断言口径见 `axe-helpers.ts`：只卡 critical/serious。
 */
for (const framework of FRAMEWORKS) {
  test.describe(`axe · ${framework.name}`, () => {
    test('表单族：select / date / upload / number / 错误态 无 critical·serious', async ({
      page,
    }) => {
      // axe 注入 + 五次 analyze 比普通交互慢；三浏览器都要跑。
      test.setTimeout(120_000);
      await openDemo(page, framework.path);

      // 1. 静态表单族：select 关闭、date 关闭、upload 空、number 正常。
      await scanAxe(page, `${framework.name}-form-idle`, T('family-form'));

      // 2. upload 排队一项（accept 通过的小图），扫文件项内部的进度/移除按钮。
      const upload = host(page, 'family-upload');
      await fileInput(upload).setInputFiles(pngFile('axe-pixel.png'));
      await expect(upload.locator('[part="item"]')).toHaveCount(1);
      await scanAxe(page, `${framework.name}-upload-queued`, T('family-form'));

      // 3. 错误态：清空 required 的 number 再提交，错误列表挂到 DOM 上。
      const number = host(page, 'family-number');
      await number.locator('input').fill('');
      await familySubmit(page).click();
      await expect(familyErrors(page).locator('[data-testid="family-error-item"]')).toHaveCount(1);
      await scanAxe(page, `${framework.name}-form-error`, T('family-form'));

      // 4. date 面板打开（dialog + 日历网格）。
      const date = host(page, 'family-date');
      await openDatePanel(date);
      await scanAxe(page, `${framework.name}-date-open`, T('family-form'));
      await date.evaluate((element) => {
        (element as unknown as { close: () => void }).close();
      });
      await expect(date.locator('[part="panel"]')).toBeHidden();

      // 5. select 面板打开（listbox + option 行），最后扫，避免面板互相干扰。
      const select = host(page, 'family-select-single');
      await openSelect(select);
      await expect(select.locator('[part="listbox"]')).toBeVisible();
      await scanAxe(page, `${framework.name}-select-open`, T('family-form'));
    });
  });
}
