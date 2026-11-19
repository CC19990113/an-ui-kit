import { expect, test } from '@playwright/test';

import {
  dayButton,
  familyState,
  host,
  openDatePanel,
  openDemo,
  submitFamily,
  waitForEvent,
} from './family-helpers';

/**
 * `<an-date-range>`：两次点击成区间、反向点击自动排序、键盘移动、两字段提交。
 */
test.describe('an-date-range · 表单族 demo', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page);
  });

  test('两次点击组成区间，派发 start / end 并关闭面板', async ({ page }) => {
    const range = host(page, 'family-range');
    await openDatePanel(range);

    await dayButton(range, '2026-11-12').click();
    // 第一次点击只定起点，面板保持打开。
    await expect(range.locator('[part="panel"]')).toBeVisible();
    await expect(range).toHaveJSProperty('start', '2026-11-12');
    await expect(range).toHaveJSProperty('end', '');

    await dayButton(range, '2026-11-17').click();

    await expect(range).toHaveJSProperty('start', '2026-11-12');
    await expect(range).toHaveJSProperty('end', '2026-11-17');
    await expect(range.locator('[part="panel"]')).toBeHidden();

    const change = await waitForEvent(page, 'an-date-range-change', 'family-range');
    expect(change.start).toBe('2026-11-12');
    expect(change.end).toBe('2026-11-17');
  });

  test('先点晚再点早：自动排序成 start <= end', async ({ page }) => {
    const range = host(page, 'family-range');
    await openDatePanel(range);

    await dayButton(range, '2026-11-20').click();
    await dayButton(range, '2026-11-08').click();

    await expect(range).toHaveJSProperty('start', '2026-11-08');
    await expect(range).toHaveJSProperty('end', '2026-11-20');
  });

  test('键盘：ArrowDown 进日历、ArrowRight 移动、Enter 定起点、Escape 关闭', async ({ page }) => {
    const range = host(page, 'family-range');
    await openDatePanel(range);

    await page.keyboard.press('ArrowDown');
    await expect(range.locator('[part="grid"]')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(range.locator('[part="panel"]')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(range.locator('[part="panel"]')).toBeHidden();
    await expect(range).toHaveJSProperty('start', '2026-11-06');
  });

  test('FormData：完整区间提交 from / to 两个字段', async ({ page }) => {
    const range = host(page, 'family-range');
    await openDatePanel(range);
    await dayButton(range, '2026-11-12').click();
    await dayButton(range, '2026-11-17').click();

    await submitFamily(page);

    const state = await familyState(page);
    expect(state.submit).toBe(1);
    expect(state.values.from).toBe('2026-11-12');
    expect(state.values.to).toBe('2026-11-17');
  });
});
