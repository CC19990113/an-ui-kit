import { expect, test } from '@playwright/test';

import {
  closeSelect,
  familyState,
  host,
  openDemo,
  openSelect,
  optionRow,
  pickOption,
  selectTrigger,
  selectValues,
  submitFamily,
  waitForEvent,
} from './family-helpers';

/**
 * `<an-select>` 在表单族 demo 上的真实浏览器行为：
 * 开合、单选 / 多选、搜索过滤、option 里的 HTML、键盘、FormData。
 */
test.describe('an-select · 表单族 demo', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page);
  });

  test('点触发器打开、单选后回填 value 并派发 an-select-change', async ({ page }) => {
    const select = host(page, 'family-select-single');
    const trigger = selectTrigger(select);

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await openSelect(select);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(select.locator('[part="option"]')).toHaveCount(4);

    await optionRow(select, '上海').click();

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(select).toHaveJSProperty('value', 'sh');
    await expect(select.locator('[part="trigger"] .value')).toHaveText('上海');

    const change = await waitForEvent(page, 'an-select-change', 'family-select-single');
    expect(change.value).toBe('sh');
    expect(change.values).toEqual(['sh']);
  });

  test('多选：点两个选项出现两个 tag，第三个进 +N 溢出，再点取消', async ({ page }) => {
    const select = host(page, 'family-select-multi');
    await openSelect(select);

    await optionRow(select, 'React').click();
    await optionRow(select, 'Vue').click();

    // 多选不关面板，触发器上出现两个 tag。
    await expect(select.locator('[part="tags"]')).toBeVisible();
    await expect(select.locator('[part="tag"]')).toHaveCount(2);
    await expect(select).toHaveJSProperty('value', 'react');
    expect(await selectValues(select)).toEqual(['react', 'vue']);

    // max-tags="2"：第三个只显示 +1，不撑爆触发器。
    await optionRow(select, 'TypeScript').click();
    await expect(select.locator('[part="tag"]')).toHaveCount(2);
    await expect(select.locator('.tag-overflow')).toHaveText('+1');

    // 再点已选项 = 取消。
    await optionRow(select, 'React').click();
    await expect(select.locator('[part="tag"]')).toHaveCount(2);
    await expect(select.locator('.tag-overflow')).toHaveCount(0);
    expect(await selectValues(select)).toEqual(['vue', 'ts']);
  });

  test('searchable：输入过滤、无匹配空态、清空恢复', async ({ page }) => {
    const select = host(page, 'family-select-multi');
    await openSelect(select);
    const search = select.locator('[part="search"]');
    await expect(search).toBeVisible();

    await search.fill('type');
    await expect(select.locator('[part="option"]')).toHaveCount(1);
    await expect(select.locator('[part="option"]')).toContainText('TypeScript');

    await search.fill('zzz');
    await expect(select.locator('[part="option"]')).toHaveCount(0);
    await expect(select.locator('[part="empty"]')).toBeVisible();

    await search.fill('');
    await expect(select.locator('[part="option"]')).toHaveCount(5);
    await expect(select.locator('[part="empty"]')).toBeHidden();
  });

  test('option 的子元素 HTML 会镜像进面板（b / small 可见）', async ({ page }) => {
    const select = host(page, 'family-select-multi');
    await openSelect(select);

    const reactRow = optionRow(select, 'React');
    await expect(reactRow.locator('b')).toHaveText('React');
    await expect(reactRow.locator('small')).toHaveText('组件化 UI');
    await expect(reactRow.locator('small')).toBeVisible();

    // 选中的标签只显示 label 文本，不显示内部 HTML 样式。
    await reactRow.click();
    await expect(select.locator('[part="tag"]')).toContainText('React');
  });

  test('键盘：ArrowDown 打开并移动、Enter 选中、Escape 关闭', async ({ page }) => {
    const select = host(page, 'family-select-single');
    const trigger = selectTrigger(select);
    await trigger.focus();

    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(select.locator('[part="listbox"]')).toBeVisible();

    // 打开时 active 落在第一个可用项（北京），再按一次到上海。
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /.+/);
    await page.keyboard.press('Enter');

    await expect(select).toHaveJSProperty('value', 'sh');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // 再打开，Escape 关闭且焦点回到触发器。
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(
      await trigger.evaluate((element) => {
        const root = element.getRootNode() as ShadowRoot;
        return root.activeElement === element;
      }),
    ).toBe(true);
  });

  test('selectAll / clear 与 Backspace 移除最后一个 tag', async ({ page }) => {
    const select = host(page, 'family-select-multi');
    await openSelect(select);

    await select.evaluate((element) => {
      (element as unknown as { selectAll: () => void }).selectAll();
    });
    await expect(select.locator('[part="tag"]')).toHaveCount(2);
    expect(await selectValues(select)).toHaveLength(5);

    await select.evaluate((element) => {
      (element as unknown as { clear: () => void }).clear();
    });
    expect(await selectValues(select)).toEqual([]);
    await expect(select.locator('[part="tags"]')).toBeHidden();

    await optionRow(select, 'Vue').click();
    await expect(select.locator('[part="tag"]')).toHaveCount(1);
    await selectTrigger(select).focus();
    await page.keyboard.press('Backspace');
    expect(await selectValues(select)).toEqual([]);
  });

  test('FormData：单选与多选分别贡献一个 / 多个条目', async ({ page }) => {
    await pickOption(page, 'family-select-single', '北京');

    const multi = host(page, 'family-select-multi');
    await openSelect(multi);
    await optionRow(multi, 'React').click();
    await optionRow(multi, 'Vue').click();
    await expect(multi.locator('[part="tag"]')).toHaveCount(2);
    await closeSelect(multi);

    await submitFamily(page);

    const state = await familyState(page);
    expect(state.submit).toBe(1);
    expect(state.values.single).toBe('bj');
    expect(state.values.tags).toEqual(['react', 'vue']);
  });
});
