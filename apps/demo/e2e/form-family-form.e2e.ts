import { expect, test } from '@playwright/test';

import {
  closeSelect,
  familyErrors,
  familyOutput,
  familyReset,
  familyState,
  fileInput,
  host,
  openDemo,
  pngFile,
  pickOption,
  submitFamily,
} from './family-helpers';

/**
 * `<an-form>`：约束校验拦截、成功提交 detail、reset、novalidate、validate()。
 * demo 里 `<an-number required>` 是专门的校验开关。
 */
test.describe('an-form · 表单族 demo', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page);
  });

  test('校验失败：submit 不触发、an-form-invalid 带字段、错误列表可见且焦点回到控件', async ({
    page,
  }) => {
    await host(page, 'family-number').locator('[part="input"]').fill('');
    await submitFamily(page);

    const state = await familyState(page);
    expect(state.submit).toBe(0);
    expect(state.invalid).toBe(1);
    expect(state.errors.map((error) => error.name)).toEqual(['quantity']);
    expect(state.errors[0]?.message.length).toBeGreaterThan(0);

    await expect(familyErrors(page)).toContainText('quantity');
    await expect(familyErrors(page).locator('[data-testid="family-error-item"]')).toHaveCount(1);
    await expect(familyOutput(page)).toBeEmpty();

    // 首个错误控件拿到焦点（内部 input）。
    const focused = await page.evaluate(() => {
      const number = document.querySelector('[data-testid="family-number"]');
      return number?.shadowRoot?.activeElement?.getAttribute('part') ?? null;
    });
    expect(focused).toBe('input');
  });

  test('成功提交：an-form-submit detail 带 FormData / values / File', async ({ page }) => {
    await pickOption(page, 'family-select-single', '北京');
    const multi = host(page, 'family-select-multi');
    await multi.locator('[part="trigger"]').click();
    await multi.locator('[part="option"]', { hasText: 'React' }).click();
    await closeSelect(multi);
    await fileInput(host(page, 'family-upload')).setInputFiles(pngFile());
    await host(page, 'family-checkbox-group').locator('an-checkbox[value="perf"]').click();

    await submitFamily(page);

    const state = await familyState(page);
    expect(state.submit).toBe(1);
    expect(state.invalid).toBe(0);
    expect(state.values).toMatchObject({
      single: 'bj',
      tags: 'react',
      quantity: '3',
      day: '2026-11-10',
      from: '2026-11-05',
      to: '2026-11-09',
      topics: ['a11y', 'perf'],
    });
    const attachment = state.entries.find((entry) => entry.name === 'attachment');
    expect(attachment?.file?.name).toBe('pixel.png');

    // 页面回显的 JSON 与状态一致。
    const rendered = JSON.parse((await familyOutput(page).textContent()) ?? '{}');
    expect(rendered.values).toEqual(state.values);
    expect(rendered.entries).toEqual(state.entries);
  });

  test('重置：控件回初始值、错误清空、an-form-reset 触发', async ({ page }) => {
    const number = host(page, 'family-number');
    await number.locator('[part="input"]').fill('7');
    await page.keyboard.press('Tab');
    await host(page, 'family-checkbox-group').locator('an-checkbox[value="perf"]').click();
    await submitFamily(page);
    expect((await familyState(page)).values.quantity).toBe('7');

    await familyReset(page).click();

    await expect(number.locator('[part="input"]')).toHaveValue('3');
    await expect(host(page, 'family-checkbox-group')).toHaveJSProperty('value', ['a11y']);
    expect(JSON.parse((await familyOutput(page).textContent()) ?? '{}')).toEqual({
      values: {},
      entries: [],
    });
    await expect(familyErrors(page)).toBeEmpty();

    const state = await familyState(page);
    expect(state.reset).toBe(1);
    expect(state.values).toEqual({});
  });

  test('novalidate：跳过约束校验，空 required 也照常提交', async ({ page }) => {
    const form = host(page, 'family-form');
    await host(page, 'family-number').locator('[part="input"]').fill('');
    await form.evaluate((element) => element.setAttribute('novalidate', ''));

    await submitFamily(page);

    const state = await familyState(page);
    expect(state.submit).toBe(1);
    expect(state.invalid).toBe(0);
    expect(state.values.quantity).toBe('');
  });

  test('validate()：返回缺失字段的 name 与 message', async ({ page }) => {
    const form = host(page, 'family-form');
    await host(page, 'family-number').locator('[part="input"]').fill('');

    const report = await form.evaluate((element) => {
      const result = (
        element as unknown as {
          validate: () => { valid: boolean; fields: Array<{ name: string; message: string }> };
        }
      ).validate();
      return {
        valid: result.valid,
        fields: result.fields.map((field) => ({ name: field.name, message: field.message })),
      };
    });

    expect(report.valid).toBe(false);
    expect(report.fields.map((field) => field.name)).toEqual(['quantity']);
    expect(report.fields[0]?.message.length).toBeGreaterThan(0);
  });

  test('checkbox-group 的 min 约束也拦截提交', async ({ page }) => {
    // 取消唯一选中项，group 的 min=1 不满足。
    await host(page, 'family-checkbox-group').locator('an-checkbox[value="a11y"]').click();
    await submitFamily(page);

    const state = await familyState(page);
    expect(state.submit).toBe(0);
    expect(state.invalid).toBe(1);
    expect(state.errors.map((error) => error.name)).toContain('topics');
  });
});
