/**
 * `<x-button>` 无障碍断言集 —— 不引入 axe-core，只写我们真的关心的 5 条：
 *
 * 1. 内部元素是 `<button>` 且带 `part="base"`（真原生按钮 + 契约里的 CSS part）
 * 2. 没有非预期的 `tabindex="-1"`，且启用状态下默认可聚焦
 * 3. `disabled` 时内部 button 有 `disabled` 属性
 * 4. `loading` 时内部 button 有 `aria-busy="true"`
 * 5. 有可访问名（slot 文本非空）
 *
 * 设计成两级，方便 Playwright 直接调用：
 * - `snapshotButton` 在浏览器里跑（`locator.evaluate(snapshotButton)`）
 * - `evaluateA11y` 在 Node 里跑，把快照变成可读的断言结果
 * - `runA11yChecks` 是给 Playwright 的一步到位入口
 */

/** 在浏览器里采集到的事实，不做判断。 */
export interface A11ySnapshot {
  /** Shadow DOM 内部按钮的标签名，小写；找不到时为 null。 */
  innerTagName: string | null;
  /** 内部按钮的 `part` 属性。 */
  part: string | null;
  /** 内部按钮的 class（契约里 `.base` 应命中）。 */
  className: string | null;
  /** host 上的 tabindex 属性。 */
  hostTabIndex: string | null;
  /** 内部按钮上的 tabindex 属性。 */
  innerTabIndex: string | null;
  /** 启用状态下调用 focus() 后，shadowRoot.activeElement 是否就是内部按钮。 */
  focusable: boolean | null;
  /** 内部按钮是否有 disabled 属性。 */
  disabledAttr: boolean;
  /** 内部按钮的 aria-busy 属性。 */
  ariaBusy: string | null;
  /** host 的 slot 文本（可访问名来源）。 */
  slotText: string;
  /** host 上的 aria-label（若有，优先作为可访问名）。 */
  ariaLabel: string | null;
}

/** 断言的预期状态；不传的项只做「正向契约」检查。 */
export interface A11yExpectation {
  /** 这个按钮应该处于 disabled 状态。 */
  disabled?: boolean;
  /** 这个按钮应该处于 loading 状态。 */
  loading?: boolean;
}

export interface A11yCheck {
  id: string;
  name: string;
  ok: boolean;
  detail: string;
}

export interface A11yReport {
  ok: boolean;
  checks: A11yCheck[];
  snapshot: A11ySnapshot;
}

/**
 * 在浏览器上下文中采集事实。
 * 注意：这个函数会被序列化进页面，不能引用模块作用域里的任何变量。
 */
export function snapshotButton(element: Element): A11ySnapshot {
  const host = element as HTMLElement;
  const root = host.shadowRoot;

  if (!root) {
    return {
      innerTagName: null,
      part: null,
      className: null,
      hostTabIndex: host.getAttribute('tabindex'),
      innerTabIndex: null,
      focusable: null,
      disabledAttr: false,
      ariaBusy: null,
      slotText: (host.textContent ?? '').trim(),
      ariaLabel: host.getAttribute('aria-label'),
    };
  }

  const inner = root.querySelector('button');
  const slotText = (host.textContent ?? '').trim();
  let focusable: boolean | null = null;

  if (inner && !inner.disabled) {
    const previous = document.activeElement as HTMLElement | null;
    inner.focus();
    focusable = root.activeElement === inner;
    inner.blur();
    previous?.focus?.();
  }

  return {
    innerTagName: inner?.tagName.toLowerCase() ?? null,
    part: inner?.getAttribute('part') ?? null,
    className: inner?.getAttribute('class') ?? null,
    hostTabIndex: host.getAttribute('tabindex'),
    innerTabIndex: inner?.getAttribute('tabindex') ?? null,
    focusable,
    disabledAttr: inner?.hasAttribute('disabled') ?? false,
    ariaBusy: inner?.getAttribute('aria-busy') ?? null,
    slotText,
    ariaLabel: host.getAttribute('aria-label'),
  };
}

/** 把快照变成 5 条断言结果（纯函数，Node 里跑）。 */
export function evaluateA11y(
  snapshot: A11ySnapshot,
  expectation: A11yExpectation = {},
): A11yCheck[] {
  const checks: A11yCheck[] = [];

  checks.push({
    id: 'internal-button-part',
    name: '内部元素是 <button> 且 part="base"',
    ok: snapshot.innerTagName === 'button' && snapshot.part === 'base',
    detail: `tag=${snapshot.innerTagName ?? 'missing'} part=${snapshot.part ?? 'missing'} class=${
      snapshot.className ?? 'missing'
    }`,
  });

  const hasUnexpectedTabIndex =
    (snapshot.innerTabIndex !== null && snapshot.innerTabIndex === '-1') ||
    (snapshot.hostTabIndex !== null && snapshot.hostTabIndex === '-1');
  const focusOk =
    hasUnexpectedTabIndex === false &&
    (snapshot.disabledAttr ? snapshot.focusable === null : snapshot.focusable === true);

  checks.push({
    id: 'focusable',
    name: '无非预期 tabindex="-1"，启用时默认可聚焦',
    ok: focusOk,
    detail: `hostTabIndex=${snapshot.hostTabIndex ?? 'none'} innerTabIndex=${
      snapshot.innerTabIndex ?? 'none'
    } focusable=${
      snapshot.focusable === null ? 'n/a (disabled)' : String(snapshot.focusable)
    }`,
  });

  checks.push({
    id: 'disabled-attr',
    name: 'disabled 时内部 button 带 disabled 属性',
    ok: expectation.disabled ? snapshot.disabledAttr : true,
    detail: expectation.disabled
      ? `disabled=${snapshot.disabledAttr}`
      : `not asserted (disabled=${snapshot.disabledAttr})`,
  });

  const busyOk = expectation.loading ? snapshot.ariaBusy === 'true' : true;
  checks.push({
    id: 'aria-busy',
    name: 'loading 时内部 button 带 aria-busy="true"',
    ok: busyOk,
    detail: expectation.loading
      ? `aria-busy=${snapshot.ariaBusy === null ? 'missing' : snapshot.ariaBusy}`
      : `not asserted (aria-busy=${snapshot.ariaBusy ?? 'none'})`,
  });

  const accessibleName = snapshot.ariaLabel?.trim() || snapshot.slotText;
  checks.push({
    id: 'accessible-name',
    name: '有可访问名（slot 文本非空）',
    ok: accessibleName.length > 0,
    detail: `slotText=${JSON.stringify(snapshot.slotText)} ariaLabel=${JSON.stringify(
      snapshot.ariaLabel,
    )} -> name=${JSON.stringify(accessibleName)}`,
  });

  return checks;
}

/** Playwright `Locator` 的最小结构类型；只用到 evaluate，因此不依赖 @playwright/test。 */
export interface A11yLocatorLike {
  evaluate(snapshot: (element: Element) => A11ySnapshot): Promise<A11ySnapshot>;
}

/** 一步到位：采集 + 断言。Playwright 里直接 `runA11yChecks(page.locator(sel), {...})`。 */
export async function runA11yChecks(
  locator: A11yLocatorLike,
  expectation: A11yExpectation = {},
): Promise<A11yReport> {
  const snapshot = await locator.evaluate(snapshotButton);
  const checks = evaluateA11y(snapshot, expectation);
  return { ok: checks.every((check) => check.ok), checks, snapshot };
}

/** 断言失败时打印用的可读摘要。 */
export function formatA11yReport(report: A11yReport): string {
  return report.checks
    .map((check) => `${check.ok ? 'PASS' : 'FAIL'} ${check.id} — ${check.name} :: ${check.detail}`)
    .join('\n');
}
