import { expect, test } from '@playwright/test';

import {
  familyErrors,
  familyState,
  host,
  openDemo,
  submitFamily,
  waitForEvent,
} from './family-helpers';

/**
 * `<an-number>`：步进、clamp / 精度归一化、键盘、required 校验。
 */
test.describe('an-number · 表单族 demo', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page);
  });

  test('stepper 按钮按 step=2 步进并派发 an-number-change', async ({ page }) => {
    const number = host(page, 'family-number');
    const input = number.locator('[part="input"]');
    await expect(input).toHaveValue('3');

    await number.locator('[part="spin-up"]').click();
    await expect(number).toHaveJSProperty('value', 5);
    await expect(input).toHaveValue('5');

    await number.locator('[part="spin-down"]').click();
    await expect(number).toHaveJSProperty('value', 3);

    const change = await waitForEvent(page, 'an-number-change', 'family-number');
    expect(change.value).toBe(3);
  });

  test('输入越界在 blur 时 clamp 到 min / max', async ({ page }) => {
    const number = host(page, 'family-number');
    const input = number.locator('[part="input"]');

    await input.fill('99');
    await page.keyboard.press('Tab');
    await expect(input).toHaveValue('10');
    await expect(number).toHaveJSProperty('value', 10);

    await input.fill('-5');
    await page.keyboard.press('Tab');
    await expect(input).toHaveValue('1');
    await expect(number).toHaveJSProperty('value', 1);
  });

  test('键盘 ArrowUp / ArrowDown 走 step', async ({ page }) => {
    const number = host(page, 'family-number');
    const input = number.locator('[part="input"]');
    await input.focus();

    await page.keyboard.press('ArrowUp');
    await expect(input).toHaveValue('5');
    await page.keyboard.press('ArrowDown');
    await expect(input).toHaveValue('3');
    await expect(number).toHaveJSProperty('value', 3);
  });

  test('required 为空时提交被拦截，填值后提交成功', async ({ page }) => {
    const number = host(page, 'family-number');
    const input = number.locator('[part="input"]');

    await input.fill('');
    await submitFamily(page);

    const invalid = await familyState(page);
    expect(invalid.submit).toBe(0);
    expect(invalid.invalid).toBe(1);
    expect(invalid.errors.map((error) => error.name)).toEqual(['quantity']);
    await expect(familyErrors(page).locator('[data-testid="family-error-item"]')).toHaveCount(1);
    await expect(familyErrors(page)).toContainText('quantity');

    // min=1 + step=2：合法值是 1/3/5/7/9，4 会 stepMismatch。
    await input.fill('5');
    await submitFamily(page);

    const valid = await familyState(page);
    expect(valid.submit).toBe(1);
    expect(valid.values.quantity).toBe('5');
  });
});
