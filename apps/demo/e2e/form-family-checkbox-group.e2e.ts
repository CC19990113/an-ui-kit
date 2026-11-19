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

  test('原生 form：同名多值、取消和禁用同步，子 checkbox 不重复提交', async ({ page }) => {
    const form = await page.evaluate(async () => {
      await customElements.whenDefined('an-checkbox-group');
      await customElements.whenDefined('an-checkbox');
      const form = document.createElement('form');
      form.dataset.testid = 'native-checkbox-group-form';
      const group = document.createElement('an-checkbox-group') as HTMLElement & {
        value: string[];
        disabled: boolean;
      };
      group.setAttribute('name', 'topics');
      for (const value of ['one', 'two', 'three']) {
        const checkbox = document.createElement('an-checkbox');
        checkbox.setAttribute('value', value);
        checkbox.textContent = value;
        group.append(checkbox);
      }
      form.append(group);
      document.body.append(form);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      return true;
    });
    expect(form).toBe(true);

    const nativeForm = page.locator('[data-testid="native-checkbox-group-form"]');
    const group = nativeForm.locator('an-checkbox-group');
    const entries = () => nativeForm.evaluate((element) => new FormData(element as HTMLFormElement).getAll('topics'));
    const childEntries = () => nativeForm.evaluate((element) => new FormData(element as HTMLFormElement).getAll('child'));

    await group.locator('an-checkbox[value="one"] input[type="checkbox"]').click({ force: true });
    await group.locator('an-checkbox[value="two"] input[type="checkbox"]').click({ force: true });
    await expect.poll(entries).toEqual(['one', 'two']);
    await expect.poll(childEntries).toEqual([]);

    await group.locator('an-checkbox[value="one"] input[type="checkbox"]').click({ force: true });
    await expect.poll(entries).toEqual(['two']);

    await group.evaluate((element) => {
      (element as unknown as { disabled: boolean }).disabled = true;
    });
    await expect.poll(entries).toEqual([]);
    await group.evaluate((element) => {
      (element as unknown as { disabled: boolean }).disabled = false;
    });
    await expect.poll(entries).toEqual(['two']);
  });
});
