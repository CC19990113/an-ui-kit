import { expect, test, type Page } from '@playwright/test';

import {
  formatA11yReport,
  type A11yCheck,
  type A11ySnapshot,
} from '../../../scripts/a11y/index';

declare global {
  interface Window {
    /** 提交 / 约束校验计数：证明 invalid 时 submit 不触发。 */
    __anFormState: { submit: number; invalid: number; invalidTargets: string[] };
  }
}

/**
 * 完整表单的真实 Chromium e2e：native / react / vue 三个框架页跑同一套断言，
 * tailwind 页再单独证明 preflight 不进 Shadow DOM。
 *
 * 覆盖 6 件事：
 * 1. 约束校验拦截：姓名留空提交 → submit 不触发、`<an-field>` 显示 validationMessage、
 *    出错控件 `aria-invalid="true"`
 * 2. 填完提交成功：FormData 里拿到 name / bio / city / hobby / terms / notify；
 *    checkbox 未选中时没有条目，选中时是 `"on"`
 * 3. `<an-field>` 自动显示错误，输入内容后错误消失
 * 4. `form.reset()`：所有控件回到初始值（select 回 placeholder、radio 回初始 value 等）
 * 5. `<fieldset disabled>`：内部控件禁用且不进 FormData
 * 6. a11y：每个控件都有可访问名，无 critical / serious 失败
 *
 * 设计取舍：与 `input.e2e.ts` 一样不引入 axe-core，只写我们真的关心的检查；
 * 报告仍用仓库现有的 `formatA11yReport` 渲染。
 */

const FRAMEWORKS = [
  { name: 'native', path: '/native.html' },
  { name: 'react', path: '/react.html' },
  { name: 'vue', path: '/vue.html' },
] as const;

const TAILWIND = { name: 'tailwind', path: '/tailwind.html' } as const;

const T = (testId: string): string => `[data-testid="${testId}"]`;

const formRoot = (page: Page) => page.locator(T('form-root'));
const control = (page: Page, testId: string) => page.locator(T(testId));
const submitButton = (page: Page) => page.locator(T('form-submit'));
const resetButton = (page: Page) => page.locator(T('form-reset'));
const output = (page: Page) => page.locator(T('form-output'));

/** 打开页面并等到自定义元素全部定义（否则 FormData / invalid 的时机不可靠）。 */
async function openPage(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(formRoot(page)).toBeVisible();
  await page.waitForFunction(() =>
    ['an-field', 'an-textarea', 'an-select', 'an-checkbox', 'an-switch', 'an-radio-group'].every(
      (tag) => Boolean(customElements.get(tag)),
    ),
  );
}

/**
 * 在页面里挂 submit / invalid 计数器。
 * 用捕获阶段：`invalid` 不冒泡，但捕获阶段仍会经过 form。
 */
async function installFormRecorder(page: Page): Promise<void> {
  await page.evaluate(() => {
    const form = document.querySelector<HTMLFormElement>('[data-testid="form-root"]');
    if (!form) throw new Error('demo form not found');
    const state = { submit: 0, invalid: 0, invalidTargets: [] as string[] };
    window.__anFormState = state;
    form.addEventListener(
      'invalid',
      (event) => {
        state.invalid += 1;
        const target = event.target as Element | null;
        if (target) {
          state.invalidTargets.push(
            target.getAttribute('data-testid') ?? target.localName.toLowerCase(),
          );
        }
      },
      true,
    );
    form.addEventListener(
      'submit',
      () => {
        state.submit += 1;
      },
      true,
    );
  });
}

const formState = (page: Page) => page.evaluate(() => window.__anFormState);

/** 当前 form 的 FormData（不触发校验，和 `new FormData(form)` 一样是纯读）。 */
function formEntries(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const form = document.querySelector<HTMLFormElement>('[data-testid="form-root"]');
    if (!form) throw new Error('demo form not found');
    return Object.fromEntries(
      [...new FormData(form).entries()].map(([key, value]) => [
        key,
        typeof value === 'string' ? value : value.name,
      ]),
    );
  });
}

/** 填完三个必填/文本控件（name / bio / city），radio 与 checkbox 由各测试自己处理。 */
async function fillTextControls(page: Page): Promise<void> {
  await page.locator(`${T('form-name')} input`).fill('Ada Lovelace');
  await page.locator(`${T('form-bio')} textarea`).fill('第一个程序员');
  await page.locator(`${T('form-city')} select`).selectOption('bj');
}

for (const framework of FRAMEWORKS) {
  test.describe(`${framework.name} (${framework.path})`, () => {
    test.beforeEach(async ({ page }) => {
      await openPage(page, framework.path);
    });

    test('姓名留空点提交：submit 不触发、<an-field> 显示 validationMessage、控件 aria-invalid="true"', async ({
      page,
    }) => {
      await installFormRecorder(page);

      const name = control(page, 'form-name');
      const field = control(page, 'field-name');
      const error = field.locator('[part="error"]');

      // 初始状态：没有错误。
      await expect(error).toBeHidden();
      await expect(name).not.toHaveAttribute('aria-invalid', 'true');

      await submitButton(page).click();

      // field 捕获了控件的 invalid，error part 可见且文本来自 validationMessage。
      await expect(error).toBeVisible();
      const message = await name.evaluate(
        (element) => (element as unknown as { validationMessage: string }).validationMessage,
      );
      expect(message.length, 'an-input 应通过 setValidity 提供平台校验消息').toBeGreaterThan(0);
      await expect(error).toHaveText(message);
      await expect(name).toHaveAttribute('aria-invalid', 'true');

      const state = await formState(page);
      expect(state.submit, '约束校验失败时 submit 事件不应触发').toBe(0);
      expect(state.invalid, 'invalid 事件应触发（组件用 setValidity 参与约束校验）').toBeGreaterThan(0);
      expect(state.invalidTargets).toContain('form-name');
    });

    test('填完提交成功：FormData 拿到 name / bio / city / hobby / terms / notify，未选中的 checkbox 没有条目', async ({
      page,
    }) => {
      await installFormRecorder(page);

      const terms = control(page, 'form-terms');
      const notify = control(page, 'form-notify');
      const hobby = control(page, 'form-hobby');

      await fillTextControls(page);
      await page.locator('#demo-form an-radio[value="bike"]').click();
      await expect(hobby).toHaveJSProperty('value', 'bike');

      // 未选中时 checkbox / switch 都不贡献 FormData 条目。
      let entries = await formEntries(page);
      expect(entries).not.toHaveProperty('terms');
      expect(entries).not.toHaveProperty('notify');

      await terms.click();
      await expect(terms).toHaveJSProperty('checked', true);
      await expect(notify).toHaveJSProperty('checked', false);
      entries = await formEntries(page);
      expect(entries.terms, 'checkbox 默认 value 是 "on"').toBe('on');
      expect(entries).not.toHaveProperty('notify');

      await notify.click();
      await expect(notify).toHaveJSProperty('checked', true);
      entries = await formEntries(page);
      expect(entries).toMatchObject({
        name: 'Ada Lovelace',
        bio: '第一个程序员',
        city: 'bj',
        hobby: 'bike',
        terms: 'on',
        notify: 'on',
      });
      // 禁用的 fieldset 里的字段不进 FormData。
      expect(entries).not.toHaveProperty('locked');

      await submitButton(page).click();
      await expect.poll(async () => (await formState(page)).submit).toBe(1);
      await expect(output(page)).not.toBeEmpty();

      // <pre> 里的 JSON 就是提交那一刻的 FormData。
      const rendered = JSON.parse((await output(page).textContent()) ?? '{}');
      expect(rendered).toEqual(entries);
    });

    test('<an-field> 自动捕获 invalid：error part 可见且非空，输入内容后错误消失', async ({ page }) => {
      const name = control(page, 'form-name');
      const field = control(page, 'field-name');
      const error = field.locator('[part="error"]');

      await submitButton(page).click();
      await expect(error).toBeVisible();
      const text = (await error.textContent())?.trim() ?? '';
      expect(text.length, 'field 的 error part 文本应非空').toBeGreaterThan(0);

      await page.locator(`${T('form-name')} input`).fill('Ada');
      await expect(error).toBeHidden();
      await expect(name).not.toHaveAttribute('aria-invalid', 'true');
    });

    test('form.reset()：所有控件回到初始值（select placeholder / radio 初始 value / checkbox 与 switch 未选）', async ({
      page,
    }) => {
      const name = control(page, 'form-name');
      const bio = control(page, 'form-bio');
      const city = control(page, 'form-city');
      const hobby = control(page, 'form-hobby');
      const terms = control(page, 'form-terms');
      const notify = control(page, 'form-notify');
      const code = page.locator('#demo-form an-radio[value="code"]');
      const bike = page.locator('#demo-form an-radio[value="bike"]');

      // 初始值：name / bio / city 为空，hobby=code，checkbox / switch 未选。
      await expect(hobby).toHaveJSProperty('value', 'code');
      await expect(code).toHaveJSProperty('checked', true);

      // 先改一圈。
      await fillTextControls(page);
      await bike.click();
      await expect(hobby).toHaveJSProperty('value', 'bike');
      await terms.click();
      await notify.click();
      await expect(terms).toHaveJSProperty('checked', true);
      await expect(notify).toHaveJSProperty('checked', true);

      await submitButton(page).click();
      await expect(output(page)).not.toBeEmpty();

      // 点「重置」：原生 form.reset()，各控件走 onFormReset。
      await resetButton(page).click();

      await expect(name.locator('input')).toHaveValue('');
      await expect(bio.locator('textarea')).toHaveValue('');
      await expect(city.locator('select')).toHaveValue('');
      const placeholder = await city
        .locator('select')
        .evaluate((element) => (element as HTMLSelectElement).selectedOptions[0]?.textContent ?? '');
      expect(placeholder, 'select 重置后应回到 placeholder').toBe('请选择');

      await expect(hobby).toHaveJSProperty('value', 'code');
      await expect(code).toHaveJSProperty('checked', true);
      await expect(bike).toHaveJSProperty('checked', false);
      await expect(terms).toHaveJSProperty('checked', false);
      await expect(notify).toHaveJSProperty('checked', false);
      await expect(output(page)).toHaveText('');
    });

    test('<fieldset disabled>：内部控件禁用且不进 FormData', async ({ page }) => {
      await installFormRecorder(page);

      const locked = control(page, 'form-locked');
      await expect(locked.locator('input')).toBeDisabled();

      await fillTextControls(page);
      await control(page, 'form-terms').click();

      const entries = await formEntries(page);
      expect(entries).not.toHaveProperty('locked');

      await submitButton(page).click();
      await expect.poll(async () => (await formState(page)).submit).toBe(1);
      const rendered = JSON.parse((await output(page).textContent()) ?? '{}');
      expect(rendered).not.toHaveProperty('locked');
    });

    test('a11y：每个控件都有可访问名，无 critical / serious 失败', async ({ page }) => {
      const controls = page.locator(
        '#demo-form an-input, #demo-form an-textarea, #demo-form an-select, ' +
          '#demo-form an-checkbox, #demo-form an-switch, ' +
          '#demo-form an-radio-group, #demo-form an-radio, #demo-form an-button',
      );
      const count = await controls.count();
      const snapshots: FormControlSnapshot[] = [];
      for (let index = 0; index < count; index += 1) {
        // 每次只序列化 `snapshotControl` 本身（它不引用闭包，能在页面里独立跑）。
        snapshots.push(await controls.nth(index).evaluate(snapshotControl));
      }

      await assertControlA11y(snapshots, framework.name);
    });
  });
}

test.describe(`${TAILWIND.name} (${TAILWIND.path})`, () => {
  test('preflight 下精简表单：Shadow DOM 内输入框样式不塌，校验与提交照常', async ({ page }) => {
    await openPage(page, TAILWIND.path);

    // Tailwind preflight 的 `input { border: 0 }` 只能作用于文档，不能打穿 Shadow DOM。
    const inner = await page.locator(`${T('form-name')} input`).evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        height: Number.parseFloat(style.height),
        borderTopWidth: Number.parseFloat(style.borderTopWidth),
        paddingInlineStart: Number.parseFloat(style.paddingInlineStart),
      };
    });
    expect(inner.height, '输入框高度应来自组件自己的 CSS').toBeGreaterThan(20);
    expect(inner.borderTopWidth, '输入框边框不应被 preflight 清零').toBeGreaterThan(0);
    expect(inner.paddingInlineStart, '输入框内边距不应被 preflight 清零').toBeGreaterThan(0);

    await installFormRecorder(page);
    await submitButton(page).click();
    await expect(page.locator('[data-testid="field-name"] [part="error"]')).toBeVisible();
    expect((await formState(page)).submit).toBe(0);

    // 精简页只有 name / city / terms 三个控件（没有 bio textarea）。
    await page.locator(`${T('form-name')} input`).fill('Ada Lovelace');
    await page.locator(`${T('form-city')} select`).selectOption('bj');
    await control(page, 'form-terms').click();
    await submitButton(page).click();
    await expect.poll(async () => (await formState(page)).submit).toBe(1);

    const rendered = JSON.parse((await output(page).textContent()) ?? '{}');
    expect(rendered).toMatchObject({ name: 'Ada Lovelace', city: 'bj', terms: 'on' });
  });
});

/** 浏览器里采集到的表单控件事实（只记录，不判断）。 */
interface FormControlSnapshot {
  host: string;
  testId: string | null;
  hasShadowRoot: boolean;
  innerTag: string | null;
  ariaLabel: string;
  labelAttr: string;
  shadowLabelText: string;
  slottedText: string;
  hostTabIndex: string | null;
  /** label 属性 / aria-label / 阴影内 label 文本 / 插槽文本，任一非空即视为有可访问名。 */
  accessibleName: string;
}

/**
 * 在浏览器上下文里采集事实。
 * 注意：这个函数会被序列化进页面，不能引用模块作用域里的任何变量。
 */
function snapshotControl(element: Element): FormControlSnapshot {
  const host = element as HTMLElement;
  const root = host.shadowRoot;
  const inner =
    root?.querySelector('input, textarea, select, [role="radiogroup"], button') ?? null;
  const ariaLabel = (host.getAttribute('aria-label') ?? '').trim();
  const labelAttr = (host.getAttribute('label') ?? '').trim();
  const shadowLabelText = (root?.querySelector('label')?.textContent ?? '').trim();
  const slottedText = (host.textContent ?? '').trim();
  const accessibleName = ariaLabel || labelAttr || shadowLabelText || slottedText;

  return {
    host: host.tagName.toLowerCase(),
    testId: host.getAttribute('data-testid'),
    hasShadowRoot: root !== null && root !== undefined,
    innerTag: inner?.tagName.toLowerCase() ?? null,
    ariaLabel,
    labelAttr,
    shadowLabelText,
    slottedText,
    hostTabIndex: host.getAttribute('tabindex'),
    accessibleName,
  };
}

/** 检查的严重级别：critical / serious 必须全过，moderate 只进报告。 */
type Severity = 'critical' | 'serious' | 'moderate';

interface SeverityCheck {
  check: A11yCheck;
  severity: Severity;
}

function evaluateControlA11y(snapshots: FormControlSnapshot[]): SeverityCheck[] {
  const checks: SeverityCheck[] = [];

  for (const snapshot of snapshots) {
    const who = snapshot.testId ?? snapshot.host;

    checks.push({
      severity: 'critical',
      check: {
        id: `${who}/accessible-name`,
        name: '控件有可访问名（来自 an-field label / 控件 label 属性 / 插槽文本）',
        ok: snapshot.accessibleName.length > 0,
        detail: `aria-label=${snapshot.ariaLabel || '∅'} label=${snapshot.labelAttr || '∅'} shadowLabel=${
          snapshot.shadowLabelText || '∅'
        } text=${snapshot.slottedText || '∅'}`,
      },
    });

    checks.push({
      severity: 'critical',
      check: {
        id: `${who}/inner-control`,
        name: 'Shadow DOM 里是原生表单控件（input / textarea / select / radiogroup / button）',
        ok: snapshot.hasShadowRoot && snapshot.innerTag !== null,
        detail: `shadow=${snapshot.hasShadowRoot} inner=${snapshot.innerTag ?? 'missing'}`,
      },
    });

    checks.push({
      severity: 'serious',
      check: {
        id: `${who}/no-negative-tabindex`,
        name: '宿主没有被作者塞上 tabindex="-1"（键盘可达）',
        ok: snapshot.hostTabIndex !== '-1',
        detail: `host tabindex=${snapshot.hostTabIndex ?? '∅'}`,
      },
    });
  }

  return checks;
}

/** 用现有 `formatA11yReport` 出可读报告，并断言没有 critical / serious 失败项。 */
function assertControlA11y(snapshots: FormControlSnapshot[], label: string): void {
  expect(snapshots.length, `${label}: 表单应至少包含 9 个控件`).toBeGreaterThanOrEqual(9);

  const severityChecks = evaluateControlA11y(snapshots);
  const checks = severityChecks.map((entry) => entry.check);
  const report = formatA11yReport({
    ok: checks.every((check) => check.ok),
    checks,
    // `formatA11yReport` 只消费 checks；snapshot 是 button 专用形状，这里不需要。
    snapshot: snapshots[0] as unknown as A11ySnapshot,
  });
  console.log(`[a11y] ${label}\n${report}`);

  // 每个控件都必须有可访问名 —— 这是表单可用性的硬约束。
  const anonymous = snapshots.filter((snapshot) => snapshot.accessibleName.length === 0);
  expect(
    anonymous.map((snapshot) => snapshot.testId ?? snapshot.host),
    `${label}: 缺少可访问名的表单控件`,
  ).toEqual([]);

  const severeFailures = severityChecks.filter(
    (entry) => !entry.check.ok && entry.severity !== 'moderate',
  );
  expect(
    severeFailures.map((entry) => `${entry.severity}:${entry.check.id}`),
    `${label} a11y 有 critical / serious 失败项\n${report}`,
  ).toEqual([]);
}
