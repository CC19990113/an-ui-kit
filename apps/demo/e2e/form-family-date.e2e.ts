import { expect, test } from '@playwright/test';

import {
  dayButton,
  host,
  openDatePanel,
  openDemo,
  waitForEvent,
} from './family-helpers';

/**
 * `<an-date>`：点选、键盘（ArrowDown 进日历 / 方向键移动 / Enter 提交）、
 * inline 模式、min / max 禁用。
 */
test.describe('an-date · 表单族 demo', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page);
  });

  test('点触发器打开日历，点日期回填 value 并派发 an-date-change', async ({ page }) => {
    const date = host(page, 'family-date');
    await expect(date).toHaveJSProperty('value', '2026-11-10');

    await openDatePanel(date);
    await expect(date.locator('[part="panel"]')).toBeVisible();

    await dayButton(date, '2026-11-15').click();

    await expect(date).toHaveJSProperty('value', '2026-11-15');
    await expect(date.locator('[part="panel"]')).toBeHidden();
    await expect(date.locator('[part="input"]')).toHaveValue('2026-11-15');

    const change = await waitForEvent(page, 'an-date-change', 'family-date');
    expect(change.value).toBe('2026-11-15');
  });

  test('键盘：ArrowDown 进日历、ArrowRight 移动、Enter 选中', async ({ page }) => {
    const date = host(page, 'family-date');
    const input = date.locator('[part="input"]');
    await input.focus();

    await page.keyboard.press('ArrowDown');
    await expect(date.locator('[part="panel"]')).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');

    await expect(date).toHaveJSProperty('value', '2026-11-11');
    await expect(date.locator('[part="input"]')).toHaveValue('2026-11-11');
  });

  test('inline 模式：panel 常驻、没有 combobox 触发器、点选生效', async ({ page }) => {
    const inline = host(page, 'family-date-inline');
    await expect(inline.locator('[part="panel"]')).toBeVisible();
    await expect(inline.locator('[part="input"]')).toHaveCount(0);

    await dayButton(inline, '2026-11-20').click();
    await expect(inline).toHaveJSProperty('value', '2026-11-20');
    await expect(inline.locator('[part="panel"]')).toBeVisible();
  });

  test('min / max 之外的日期在日历里是 disabled', async ({ page }) => {
    const date = host(page, 'family-date');
    await openDatePanel(date);

    await expect(dayButton(date, '2026-11-04')).toBeDisabled();
    await expect(dayButton(date, '2026-11-26')).toBeDisabled();
    await expect(dayButton(date, '2026-11-05')).toBeEnabled();
    await expect(dayButton(date, '2026-11-25')).toBeEnabled();
  });
});
