import { expect, test } from '@playwright/test';

import {
  familyState,
  host,
  openDemo,
  submitFamily,
  waitForEvent,
} from './family-helpers';

/**
 * `<an-checkbox-group>`：多选、方向键 roving focus、FormData 多值。
 */
test.describe('an-checkbox-group · 表单族 demo', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page);
  });

  test('点选多个选项，value 按 DOM 顺序累积并派发 detail', async ({ page }) => {
    const group = host(page, 'family-checkbox-group');
    await expect(group).toHaveJSProperty('value', ['a11y']);

    await group.locator('an-checkbox[value="perf"]').click();
    await group.locator('an-checkbox[value="docs"]').click();

    await expect(group).toHaveJSProperty('value', ['a11y', 'perf', 'docs']);
    await expect(group.locator('an-checkbox[value="perf"]')).toHaveJSProperty('checked', true);

    const change = await waitForEvent(page, 'an-checkbox-group-change', 'family-checkbox-group');
    expect(change.values).toEqual(['a11y', 'perf', 'docs']);
  });

  test('方向键移动 roving focus，Space 切换选中', async ({ page }) => {
    const group = host(page, 'family-checkbox-group');
    const first = group.locator('an-checkbox[value="a11y"] input[type="checkbox"]');
    await first.focus();

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Space');

    await expect(group).toHaveJSProperty('value', ['a11y', 'perf']);
    await expect(group.locator('an-checkbox[value="perf"]')).toHaveJSProperty('checked', true);
  });

  test('FormData：选中项作为同名多值提交', async ({ page }) => {
    const group = host(page, 'family-checkbox-group');
    await group.locator('an-checkbox[value="perf"]').click();

    await submitFamily(page);

    const state = await familyState(page);
    expect(state.submit).toBe(1);
    expect(state.values.topics).toEqual(['a11y', 'perf']);
  });
});
