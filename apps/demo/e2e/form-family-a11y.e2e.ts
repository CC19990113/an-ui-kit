import { expect, test, type Locator } from '@playwright/test';

import {
  formatA11yReport,
  runRoleA11yChecks,
  type A11yRoleExpectation,
} from '../../../scripts/a11y/index';

import {
  dayButton,
  host,
  openDatePanel,
  openDemo,
  openSelect,
} from './family-helpers';

/** 一步到位：采集 + 断言，失败时打印完整报告。 */
async function expectRoles(
  locator: Locator,
  expectation: A11yRoleExpectation,
  label: string,
): Promise<void> {
  const report = await runRoleA11yChecks(locator, expectation);
  const failed = report.checks.filter((check) => !check.ok);
  expect(
    failed.map((check) => check.id),
    `${label}\n${formatA11yReport(report)}`,
  ).toEqual([]);
}

/**
 * 通用角色快照的浏览器验证：select 的 combobox/listbox、date 的 dialog/grid、
 * upload 的可聚焦触发区、number 的 spinbutton、checkbox-group 的 group。
 */
test.describe('表单族 · 角色级 a11y 快照', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page);
  });

  test('select：闭合与展开都暴露 combobox / listbox 语义', async ({ page }) => {
    const select = host(page, 'family-select-single');
    await expectRoles(select, { profile: 'select', open: false }, 'select 闭合');

    await openSelect(select);
    await expectRoles(select, { profile: 'select', open: true }, 'select 展开');

    // 多选版本额外声明 aria-multiselectable。
    const multi = host(page, 'family-select-multi');
    await openSelect(multi);
    await expectRoles(
      multi,
      { profile: 'select', open: true, multiple: true },
      'select 多选展开',
    );
  });

  test('date：dialog + grid + gridcell，inline 没有 combobox', async ({ page }) => {
    const date = host(page, 'family-date');
    await expectRoles(date, { profile: 'date', open: false }, 'date 闭合');

    await openDatePanel(date);
    await expectRoles(date, { profile: 'date', open: true }, 'date 展开');

    const inline = host(page, 'family-date-inline');
    await expectRoles(inline, { profile: 'date', open: true, inline: true }, 'date inline');
  });

  test('date-range 复用同一套 dialog / grid 语义', async ({ page }) => {
    const range = host(page, 'family-range');
    await openDatePanel(range);
    await expectRoles(range, { profile: 'date', open: true }, 'date-range 展开');
    await expect(dayButton(range, '2026-11-12')).toBeVisible();
  });

  test('upload：dropzone 是可聚焦的 role="button" 触发区', async ({ page }) => {
    const upload = host(page, 'family-upload');
    await expectRoles(upload, { profile: 'upload' }, 'upload dropzone');

    const dropzone = upload.locator('[part="dropzone"]');
    await expect(dropzone).toBeVisible();
    await expect(dropzone).toContainText('选择文件');
    await expect(upload.getByRole('button', { name: /选择文件/ })).toBeVisible();
  });

  test('number：spinbutton 暴露 aria-valuenow / min / max，步进按钮有名字', async ({ page }) => {
    const number = host(page, 'family-number');
    await expectRoles(
      number,
      { profile: 'number', value: '3', min: '1', max: '10', stepper: true },
      'number 初始',
    );

    await number.locator('[part="spin-up"]').click();
    await expectRoles(
      number,
      { profile: 'number', value: '5', min: '1', max: '10', stepper: true },
      'number 步进后',
    );
  });

  test('checkbox-group：role="group" 且 aria-required 与属性一致', async ({ page }) => {
    await expectRoles(
      host(page, 'family-checkbox-group'),
      { profile: 'checkbox-group', required: false },
      'checkbox-group',
    );
  });
});
