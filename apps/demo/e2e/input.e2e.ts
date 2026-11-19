import { expect, test, type Page } from '@playwright/test';

import {
  formatA11yReport,
  type A11yCheck,
  type A11ySnapshot,
} from '../../../scripts/a11y/index';
import type { InputEventRecord } from '../src/input-log';

declare global {
  interface Window {
    /** required 校验测试用：submit / invalid 事件计数。 */
    __inputFormState: { submit: number; invalid: number };
  }
}

/**
 * `<an-input>` 的真实浏览器 e2e。
 *
 * 单元测试跑在 happy-dom 上，它没有 Form-Associated Custom Elements（FACE）：
 * `attachInternals()`、`setFormValue()`、`formResetCallback`、`formDisabledCallback`
 * 都是 shim 模拟的。这里在真 Chromium 里把「表单语义」重新验一遍：
 *
 * 1. 键入派发 `an-input`（detail.value），能回显；失焦派发 `an-change`
 * 2. 提交时 `FormData` 里拿到 name 对应的值（走 ElementInternals，不是隐藏 input）
 * 3. `required` 空值时 `form.requestSubmit()` 被拦（submit 不触发、invalid 触发）
 * 4. `form.reset()` 后 value 回到初始值；键入不回写 attribute
 * 5. `<fieldset disabled>` 让内部 input 禁用、且该字段不进 FormData
 * 6. a11y：每个 `an-input` 都有可访问名（label 或 aria-label），且结构/焦点/状态映射全过
 *
 * 三个框架页跑同一套断言：native / react / vue（tailwind 页只多跑 a11y + 回显，
 * 因为它证明的是 preflight 不穿透 Shadow DOM）。
 */

const FRAMEWORKS = [
  { name: 'native', path: '/native.html' },
  { name: 'react', path: '/react.html' },
  { name: 'vue', path: '/vue.html' },
] as const;

const TAILWIND = { name: 'tailwind', path: '/tailwind.html' } as const;

const INPUT = (testId: string): string => `an-input[data-testid="${testId}"]`;

/** fixture 里的 5 个 `<an-input>`：3 个正常 + 1 个 required + 1 个 fieldset 内。 */
const INPUT_IDS = ['inp-name', 'inp-email', 'inp-search', 'inp-required', 'inp-fieldset'] as const;

async function openPage(page: Page, path: string): Promise<void> {
  await page.goto(path);
  // 自定义元素注册 + 首次渲染完成（Shadow DOM 里能看到内部 input）。
  await page.waitForFunction(() => customElements.get('an-input') !== undefined);
  await expect(page.locator(`${INPUT('inp-name')} input`)).toBeVisible();
}

/** 组件内部的原生 input（Playwright 的选择器会穿透 open shadow root）。 */
function innerInput(page: Page, testId: string) {
  return page.locator(`${INPUT(testId)} input`);
}

/** 从页面读事件日志（三个框架页共用同一形状，见 `src/input-log.ts`）。 */
async function inputLog(page: Page): Promise<InputEventRecord[]> {
  return page.evaluate(() => window.__anInputLog ?? []);
}

async function entriesOf(page: Page, formTestId: string): Promise<Record<string, string>> {
  return page.evaluate((testId) => {
    const form = document.querySelector<HTMLFormElement>(`[data-testid="${testId}"]`);
    if (!form) throw new Error(`form ${testId} not found`);
    return Object.fromEntries(
      [...new FormData(form).entries()].map(([key, value]) => [
        key,
        typeof value === 'string' ? value : value.name,
      ]),
    );
  }, formTestId);
}

test.describe('<an-input> · 真实 Chromium', () => {
  for (const framework of FRAMEWORKS) {
    test.describe(`${framework.name} (${framework.path})`, () => {
      test('键入派发 an-input（detail.value）并回显；失焦派发 an-change', async ({ page }) => {
        await openPage(page, framework.path);

        await innerInput(page, 'inp-name').fill('Alice');

        // 框架自己的监听器能读到 value（native 用 document 监听，react/vue 用各自绑定）。
        await expect(page.locator('[data-testid="input-echo"]')).toHaveText('Alice');

        await expect
          .poll(async () => (await inputLog(page)).filter((entry) => entry.kind === 'an-input').length)
          .toBeGreaterThan(0);

        const typed = (await inputLog(page)).find(
          (entry) => entry.kind === 'an-input' && entry.id === 'inp-name',
        );
        expect(typed, 'an-input 记录').toMatchObject({
          tag: 'an-input',
          value: 'Alice',
          bubbles: true,
          composed: true,
        });

        // 失焦 → 原生 change → 组件的 an-change。
        await page.keyboard.press('Tab');
        await expect
          .poll(async () => (await inputLog(page)).filter((entry) => entry.kind === 'an-change').length)
          .toBeGreaterThan(0);

        const changed = (await inputLog(page)).find(
          (entry) => entry.kind === 'an-change' && entry.id === 'inp-name',
        );
        expect(changed, 'an-change 记录').toMatchObject({ value: 'Alice', bubbles: true, composed: true });
      });

      test('提交时 FormData 里拿到 name 对应的值（ElementInternals，不是隐藏 input）', async ({
        page,
      }) => {
        await openPage(page, framework.path);
        await innerInput(page, 'inp-name').fill('Alice');

        const entries = await entriesOf(page, 'input-form');
        expect(entries).toMatchObject({ name: 'Alice', email: 'a@b.com', keyword: '' });

        await page.locator('an-button[data-testid="btn-submit"]').click();

        await expect(page.locator('[data-testid="input-form-result"]')).toContainText('name=Alice');
        await expect(page.locator('[data-testid="input-form-result"]')).toContainText('email=a@b.com');
      });

      test('required 空值时 form.requestSubmit() 被拦：submit 不触发、invalid 触发', async ({
        page,
      }) => {
        await openPage(page, framework.path);

        const before = await page.evaluate(() => {
          const form = document.querySelector<HTMLFormElement>('[data-testid="input-required-form"]');
          if (!form) throw new Error('required form not found');
          const state = { submit: 0, invalid: 0 };
          form.addEventListener('submit', () => {
            state.submit += 1;
          });
          // invalid 不冒泡，用捕获阶段挂在 form 上也能收到。
          form.addEventListener(
            'invalid',
            () => {
              state.invalid += 1;
            },
            true,
          );
          window.__inputFormState = state;
          form.requestSubmit();
          return { valid: form.checkValidity(), ...state };
        });

        expect(before.valid, '空 required 时 form.checkValidity() 应为 false').toBe(false);
        expect(before.submit, '被拦下时 submit 事件不应触发').toBe(0);
        expect(before.invalid, '应触发 invalid 事件（组件通过 setValidity 参与约束校验）').toBeGreaterThan(0);

        // 证明拦下来的是 required（而不是 submit 永远不工作）：填上值后应当能提交。
        await innerInput(page, 'inp-required').fill('Bob');
        const after = await page.evaluate(() => {
          const form = document.querySelector<HTMLFormElement>('[data-testid="input-required-form"]');
          if (!form) throw new Error('required form not found');
          form.requestSubmit();
          return { valid: form.checkValidity(), ...window.__inputFormState };
        });
        expect(after.valid).toBe(true);
        expect(after.submit).toBe(1);
        await expect(page.locator('[data-testid="input-required-result"]')).toContainText('被提交');
      });

      test('form.reset() 回到初始值；键入不回写 value attribute', async ({ page }) => {
        await openPage(page, framework.path);

        const host = page.locator(INPUT('inp-name'));
        const hostValue = (): Promise<string> =>
          host.evaluate((element) => (element as HTMLInputElement).value);

        // HTML 页面用 `value` attribute 提供初始值；React/Vue 会把自定义元素的
        // `value` 写成 property（两边语义相同：只做初始值）。
        const initialAttribute = await host.getAttribute('value');
        expect(await hostValue()).toBe('初始值');

        await innerInput(page, 'inp-name').fill('changed');
        expect(await hostValue()).toBe('changed');
        // 契约：value 只读一次，键入不回写 attribute。
        expect(await host.getAttribute('value')).toBe(initialAttribute);

        await page.evaluate(() => {
          document.querySelector<HTMLFormElement>('[data-testid="input-form"]')?.reset();
        });

        await expect(innerInput(page, 'inp-name')).toHaveValue('初始值');
        expect(await hostValue()).toBe('初始值');
        expect(await host.getAttribute('value')).toBe(initialAttribute);
      });

      test('<fieldset disabled> 让内部 input 禁用，且该字段不进 FormData', async ({ page }) => {
        await openPage(page, framework.path);

        const locked = page.locator(INPUT('inp-fieldset'));
        await expect(innerInput(page, 'inp-fieldset')).toBeDisabled();

        // 禁用状态下无法获得焦点（真的被平台拦下，不是只有样式）。
        const focusState = await page.evaluate(() => {
          const host = document.querySelector<HTMLElement>('an-input[data-testid="inp-fieldset"]');
          const root = host?.shadowRoot;
          const input = root?.querySelector('input');
          if (!root || !input) throw new Error('fieldset input not found');
          input.focus();
          return {
            focused: root.activeElement === input,
            disabled: input.disabled,
          };
        });
        expect(focusState.disabled).toBe(true);
        expect(focusState.focused, 'disabled 的 input 不应被 focus() 聚焦').toBe(false);

        // 平台语义：disabled 的 form-associated 元素不进 FormData。
        const entries = await entriesOf(page, 'input-form');
        expect(entries).not.toHaveProperty('locked');
        expect(entries).toMatchObject({ name: '初始值', email: 'a@b.com' });
        // value 仍然保留在组件里（禁用只是拦住提交与交互）。
        expect(await locked.evaluate((element) => (element as HTMLInputElement).value)).toBe('locked');
      });

      test('a11y：可访问名 + 结构/焦点/状态映射全过（每个 an-input 都必须有 label 或 aria-label）', async ({
        page,
      }) => {
        await openPage(page, framework.path);
        await assertInputA11y(page, framework.name);
      });
    });
  }

  test.describe(`${TAILWIND.name} (${TAILWIND.path})`, () => {
    test('preflight 下键入照常派发 an-input 并回显', async ({ page }) => {
      await openPage(page, TAILWIND.path);
      await innerInput(page, 'inp-name').fill('Alice');
      await expect(page.locator('[data-testid="input-echo"]')).toHaveText('Alice');
      await expect
        .poll(async () => (await inputLog(page)).filter((entry) => entry.kind === 'an-input').length)
        .toBeGreaterThan(0);
    });

    test('preflight 下的 a11y 与三框架页一致', async ({ page }) => {
      await openPage(page, TAILWIND.path);
      await assertInputA11y(page, TAILWIND.name);
    });
  });
});

/** 浏览器里采集到的 `<an-input>` 事实（不判断，只记录）。 */
interface InputA11ySnapshot {
  host: string;
  testId: string | null;
  hasShadowRoot: boolean;
  innerTag: string | null;
  innerPart: string | null;
  innerType: string | null;
  labelText: string;
  labelAssociated: boolean;
  ariaLabel: string;
  ariaLabelledBy: string;
  /** label 文本 / aria-label / aria-labelledby 三者任一非空，就是有可访问名。 */
  accessibleName: string;
  innerTabIndex: number | null;
  innerDisabled: boolean;
  innerRequired: boolean;
  innerReadOnly: boolean;
  hostRequired: boolean;
  hostDisabledAttr: boolean;
  fieldsetDisabled: boolean;
  focusable: boolean;
  focused: boolean;
}

/**
 * 在浏览器上下文里采集事实。
 * 注意：这个函数会被序列化进页面，不能引用模块作用域里的任何变量。
 */
function snapshotInput(element: Element): InputA11ySnapshot {
  const host = element as HTMLElement;
  const root = host.shadowRoot;
  const input = root?.querySelector('input') ?? null;
  const label = root?.querySelector('label') ?? null;
  const labelText = (label?.textContent ?? '').trim();
  const ariaLabel = input?.getAttribute('aria-label')?.trim() ?? '';
  const ariaLabelledBy = input?.getAttribute('aria-labelledby')?.trim() ?? '';

  let focused = false;
  if (input && !input.disabled) {
    input.focus();
    focused = root?.activeElement === input;
    input.blur();
  }

  return {
    host: host.tagName.toLowerCase(),
    testId: host.getAttribute('data-testid'),
    hasShadowRoot: root !== null && root !== undefined,
    innerTag: input?.tagName.toLowerCase() ?? null,
    innerPart: input?.getAttribute('part') ?? null,
    innerType: input?.getAttribute('type') ?? null,
    labelText,
    // label 包裹 input（隐式关联）。shadow root 内的 tree scope 里 input.labels 能查到。
    labelAssociated: input !== null && input.labels !== null && input.labels.length > 0,
    ariaLabel,
    ariaLabelledBy,
    accessibleName: labelText || ariaLabel || ariaLabelledBy,
    innerTabIndex: input?.tabIndex ?? null,
    innerDisabled: input?.disabled ?? false,
    innerRequired: input?.required ?? false,
    innerReadOnly: input?.readOnly ?? false,
    hostRequired: host.hasAttribute('required'),
    hostDisabledAttr: host.hasAttribute('disabled'),
    fieldsetDisabled: host.closest('fieldset[disabled]') !== null,
    focusable: input !== null && !input.disabled && !input.readOnly && (input.tabIndex ?? -1) >= 0,
    focused,
  };
}

/**
 * 把快照变成断言结果。
 *
 * `scripts/a11y/index.ts` 的检查集是 `<an-button>` 专用的（内部 button、loading 等），
 * 且 `scripts/**` 不在本次可写范围，所以 input 的检查集放在 e2e 里；报告格式继续复用
 * 仓库现有的 `formatA11yReport`。
 */
function evaluateInputA11y(snapshots: InputA11ySnapshot[]): A11yCheck[] {
  const checks: A11yCheck[] = [];

  for (const snapshot of snapshots) {
    const who = snapshot.testId ?? snapshot.host;
    checks.push({
      id: `${who}/native-input`,
      name: '内部是原生 <input> 且带 part="input"',
      ok: snapshot.hasShadowRoot && snapshot.innerTag === 'input' && snapshot.innerPart === 'input',
      detail: `shadow=${snapshot.hasShadowRoot} tag=${snapshot.innerTag ?? 'missing'} part=${
        snapshot.innerPart ?? 'missing'
      }`,
    });

    checks.push({
      id: `${who}/accessible-name`,
      name: '有可访问名（label 文本 / aria-label / aria-labelledby）',
      ok: snapshot.accessibleName.length > 0,
      detail: `label="${snapshot.labelText}" aria-label="${snapshot.ariaLabel}" aria-labelledby="${snapshot.ariaLabelledBy}"`,
    });

    checks.push({
      id: `${who}/label-association`,
      name: '渲染了可见 label 时 label 与 input 已关联',
      ok: snapshot.labelText.length === 0 || snapshot.labelAssociated,
      detail: `label="${snapshot.labelText}" associated=${snapshot.labelAssociated}`,
    });

    const disabled = snapshot.hostDisabledAttr || snapshot.fieldsetDisabled;
    checks.push({
      id: `${who}/focusable`,
      name: '启用状态下内部 input 可聚焦，且没有 tabindex="-1"',
      ok: disabled || (snapshot.focusable && snapshot.focused),
      detail: `disabled=${disabled} tabIndex=${snapshot.innerTabIndex} focusable=${snapshot.focusable} focused=${snapshot.focused}`,
    });

    checks.push({
      id: `${who}/disabled-forwarded`,
      name: '禁用态（自身 disabled 或 fieldset disabled）映射到内部 input.disabled',
      ok: !disabled || snapshot.innerDisabled,
      detail: `hostDisabled=${snapshot.hostDisabledAttr} fieldsetDisabled=${snapshot.fieldsetDisabled} innerDisabled=${snapshot.innerDisabled}`,
    });

    checks.push({
      id: `${who}/required-forwarded`,
      name: 'required 映射到内部 input.required（参与平台约束校验）',
      ok: !snapshot.hostRequired || snapshot.innerRequired,
      detail: `hostRequired=${snapshot.hostRequired} innerRequired=${snapshot.innerRequired}`,
    });
  }

  return checks;
}

function formatInputA11yReport(checks: A11yCheck[]): string {
  return formatA11yReport({
    ok: checks.every((check) => check.ok),
    checks,
    // formatA11yReport 只消费 checks；snapshot 是 button 专用形状，这里不需要。
    snapshot: null as unknown as A11ySnapshot,
  });
}

async function assertInputA11y(page: Page, label: string): Promise<void> {
  const inputs = page.locator('an-input');
  const count = await inputs.count();
  const snapshots: InputA11ySnapshot[] = [];
  for (let index = 0; index < count; index += 1) {
    // 每次只序列化 `snapshotInput` 本身（它不引用闭包，能在页面里独立跑）。
    snapshots.push(await inputs.nth(index).evaluate(snapshotInput));
  }
  expect(snapshots.length, `${label}: 页面上的 <an-input> 数量`).toBeGreaterThanOrEqual(
    INPUT_IDS.length,
  );

  const checks = evaluateInputA11y(snapshots);
  const report = formatInputA11yReport(checks);
  console.log(`[a11y] ${label}\n${report}`);

  // 每个 an-input 都必须有 label 或 aria-label —— 这是组件的真实 a11y 约束。
  const anonymous = snapshots.filter((snapshot) => snapshot.accessibleName.length === 0);
  expect(
    anonymous.map((snapshot) => snapshot.testId ?? snapshot.host),
    `${label}: 缺少可访问名的 <an-input>`,
  ).toEqual([]);

  expect(checks.filter((check) => !check.ok), `${label} a11y 失败项\n${report}`).toEqual([]);
}
