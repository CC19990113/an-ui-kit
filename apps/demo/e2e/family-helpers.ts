/**
 * 表单族 e2e 的共用工具：打开页面、读 `window.__familyState`、操作自绘控件。
 *
 * 这些 helper 不写断言语义，只做定位与等待；断言留在各 `*.e2e.ts` 里。
 */
import { expect, type Locator, type Page } from '@playwright/test';

import type { FamilyDemoState, FamilyEventRecord } from '../src/form-family-demo';

/** 三个框架页：同一份组件产物，同一套 data-testid 契约。 */
export const FRAMEWORKS = [
  { name: 'native', path: '/native.html' },
  { name: 'react', path: '/react.html' },
  { name: 'vue', path: '/vue.html' },
] as const;

/** tailwind fixture：只验证 preflight 不穿透 Shadow DOM。 */
export const TAILWIND = { name: 'tailwind', path: '/tailwind.html' } as const;

/** `data-testid` 选择器。 */
export const T = (id: string): string => `[data-testid="${id}"]`;

/** 按 testid 取宿主元素。 */
export const host = (page: Page, id: string): Locator => page.locator(T(id));

/** 打开 demo 页并等到自定义元素注册、表单族行为装好。 */
export async function openDemo(page: Page, path: string = '/native.html'): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(
    () => customElements.get('an-form') !== undefined && Boolean(window.__familyState),
  );
  await expect(host(page, 'family-form')).toBeVisible();
}

/** 读 `window.__familyState`（只含 JSON-safe 数据）。 */
export function familyState(page: Page): Promise<FamilyDemoState> {
  return page.evaluate(() => window.__familyState);
}

/** 按类型（可选 testid）过滤事件记录。 */
export async function familyEvents(
  page: Page,
  type: string,
  id?: string,
): Promise<FamilyEventRecord[]> {
  const state = await familyState(page);
  return state.events.filter(
    (record) => record.type === type && (id === undefined || record.id === id),
  );
}

/** 等到至少有一条匹配事件，返回最后一条。 */
export async function waitForEvent(
  page: Page,
  type: string,
  id?: string,
): Promise<FamilyEventRecord> {
  await expect
    .poll(async () => (await familyEvents(page, type, id)).length, {
      message: `等待事件 ${type}${id === undefined ? '' : ` @${id}`}`,
    })
    .toBeGreaterThan(0);
  const all = await familyEvents(page, type, id);
  return all[all.length - 1] as FamilyEventRecord;
}

// ---------------------------------------------------------------------------
// an-select
// ---------------------------------------------------------------------------

/** select 的 combobox 触发器。 */
export const selectTrigger = (select: Locator): Locator => select.locator('[part="trigger"]');

/** 打开 select 面板并确认 listbox 可见。 */
export async function openSelect(select: Locator): Promise<void> {
  await selectTrigger(select).click();
  await expect(select.locator('[part="listbox"]')).toBeVisible();
}

/** 面板里文本匹配的 option 行。 */
export const optionRow = (select: Locator, text: string): Locator =>
  select.locator('[part="option"]', { hasText: text }).first();

/** 读多选 select 的全部 values（`value` 只返回第一个）。 */
export function selectValues(select: Locator): Promise<string[]> {
  return select.evaluate((element) => (element as unknown as { values: string[] }).values);
}

/** 收起 select 面板（多选面板保持展开，会盖住下方控件）。 */
export async function closeSelect(select: Locator): Promise<void> {
  await selectTrigger(select).focus();
  await select.evaluate((element) => {
    (element as unknown as { close: () => void }).close();
  });
  await expect(select.locator('[part="listbox"]')).toBeHidden();
}

/** 打开面板并点选一个选项。 */
export async function pickOption(page: Page, id: string, text: string): Promise<void> {
  const select = host(page, id);
  await openSelect(select);
  await optionRow(select, text).click();
}

// ---------------------------------------------------------------------------
// an-upload
// ---------------------------------------------------------------------------

/** 1×1 透明 PNG（合法图片，供 accept="image/*" 通过）。 */
export const PNG_BYTES = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
    '0000000d49444154789c6360000000020001e221bc330000000049454e44ae426082',
  'hex',
);

/** 合法的小图片。 */
export function pngFile(name = 'pixel.png'): {
  name: string;
  mimeType: string;
  buffer: Buffer;
} {
  return { name, mimeType: 'image/png', buffer: PNG_BYTES };
}

/** 超过 max-size（2 KB）的“图片”。 */
export function oversizedPng(name = 'huge.png'): {
  name: string;
  mimeType: string;
  buffer: Buffer;
} {
  return { name, mimeType: 'image/png', buffer: Buffer.alloc(4096, 0x89) };
}

/** 类型不在 accept 里的文本文件。 */
export function textFile(name = 'notes.txt'): {
  name: string;
  mimeType: string;
  buffer: Buffer;
} {
  return { name, mimeType: 'text/plain', buffer: Buffer.from('not an image', 'utf8') };
}

/** an-upload 内部的 file input（Playwright 会穿透 shadow root）。 */
export const fileInput = (upload: Locator): Locator => upload.locator('input[type="file"]');

// ---------------------------------------------------------------------------
// an-date / an-date-range
// ---------------------------------------------------------------------------

/** 日历里的某个日期按钮（part 含多个 token，用 ~=）。 */
export const dayButton = (component: Locator, iso: string): Locator =>
  component.locator(`[part~="day"][data-iso="${iso}"]`);

/** 点开日期触发器并确认 panel 可见。 */
export async function openDatePanel(component: Locator): Promise<void> {
  await component.locator('[part="input"]').click();
  await expect(component.locator('[part="panel"]')).toBeVisible();
}

// ---------------------------------------------------------------------------
// an-form
// ---------------------------------------------------------------------------

/** `an-form` 的提交 / 重置按钮与回显节点。 */
export const familySubmit = (page: Page): Locator => host(page, 'family-submit');
export const familyReset = (page: Page): Locator => host(page, 'family-reset');
export const familyOutput = (page: Page): Locator => host(page, 'family-output');
export const familyErrors = (page: Page): Locator => host(page, 'family-errors');

/** 点提交并等到 submit / invalid 之一落地（避免读到点击前状态）。 */
export async function submitFamily(page: Page): Promise<void> {
  const before = await familyState(page);
  await familySubmit(page).click();
  await expect
    .poll(async () => {
      const state = await familyState(page);
      return state.submit + state.invalid;
    })
    .toBeGreaterThan(before.submit + before.invalid);
}
