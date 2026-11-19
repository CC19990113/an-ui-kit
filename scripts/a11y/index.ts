/**
 * `<an-button>` 无障碍断言集 —— 不引入 axe-core，只写我们真的关心的 5 条：
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

/** 任何带 `ok` + `checks` 的断言报告（button / 通用角色共用）。 */
export interface A11yReportLike {
  ok: boolean;
  checks: A11yCheck[];
  /** button 快照 / 通用角色快照，报告只用来打印，故只要求存在。 */
  snapshot?: unknown;
}

/** 断言失败时打印用的可读摘要。 */
export function formatA11yReport(report: A11yReportLike): string {
  return report.checks
    .map((check) => `${check.ok ? 'PASS' : 'FAIL'} ${check.id} — ${check.name} :: ${check.detail}`)
    .join('\n');
}

// ---------------------------------------------------------------------------
// 通用角色快照
//
// 表单族组件把真正的语义角色画在 Shadow DOM 里：`an-select` 的
// combobox + listbox、`an-date` 的 dialog + grid、`an-number` 的 spinbutton、
// `an-upload` 的可聚焦 dropzone、`an-checkbox-group` 的 group。这里只采集
// 「带 role 或 part 的节点」作为事实，再按组件 profile 生成断言；不引入 axe-core。
// ---------------------------------------------------------------------------

/** Shadow DOM 里一个带角色/part 的节点事实。 */
export interface A11yRoleNodeFact {
  tagName: string;
  role: string | null;
  part: string | null;
  /** 节点的文本内容（规范化）。 */
  text: string;
  /** 浏览器渲染的可见文本（规范化）。 */
  visibleText: string;
  /** 近似计算的可访问名：aria-label、aria-labelledby、可见文本。 */
  accessibleName: string;
  focusable: boolean | null;
  tabIndex: string | null;
  ariaLabel: string | null;
  /** 解析 `aria-labelledby` 指向节点后的文本（Shadow DOM 内可见标签）。 */
  labelledbyText: string;
  ariaExpanded: string | null;
  ariaHaspopup: string | null;
  ariaMultiselectable: string | null;
  ariaValuenow: string | null;
  ariaValuemin: string | null;
  ariaValuemax: string | null;
  ariaRequired: string | null;
  /** 自己或祖先带 `hidden`（面板收起时的状态）。 */
  hidden: boolean;
  disabled: boolean;
}

/** 一个宿主元素的通用无障碍快照。 */
export interface A11yRoleSnapshot {
  hostTag: string;
  hasShadow: boolean;
  hostFocusable: boolean | null;
  hostTabIndex: string | null;
  hostAriaLabel: string | null;
  nodes: A11yRoleNodeFact[];
}

/** 通用角色断言的预期状态。 */
export type A11yRoleProfile = 'select' | 'date' | 'upload' | 'number' | 'checkbox-group';

export interface A11yRoleExpectation {
  profile: A11yRoleProfile;
  /** 组件当前应处于展开态（select / date）。 */
  open?: boolean;
  /** 多选 select 应暴露 aria-multiselectable。 */
  multiple?: boolean;
  /** inline 日期没有 combobox 触发器。 */
  inline?: boolean;
  /** spinbutton 的 aria-valuenow / min / max 期望。 */
  value?: string;
  min?: string;
  max?: string;
  /** number 是否应渲染步进按钮。 */
  stepper?: boolean;
  /** checkbox-group 是否 required。 */
  required?: boolean;
}

/** 通用角色快照的 Playwright `Locator` 最小结构。 */
export interface A11yRoleLocatorLike {
  evaluate(snapshot: (element: Element) => A11yRoleSnapshot): Promise<A11yRoleSnapshot>;
}

/**
 * 在浏览器上下文里采集角色事实。
 * 注意：这个函数会被序列化进页面，不能引用模块作用域里的任何变量。
 */
export function snapshotA11yRoles(element: Element): A11yRoleSnapshot {
  const host = element as HTMLElement;
  const shadow = host.shadowRoot;
  const root: ParentNode = shadow ?? host;
  const active = (): Element | null => {
    if (shadow) return shadow.activeElement;
    return document.activeElement;
  };

  const readFocus = (node: Element): boolean | null => {
    const html = node as HTMLElement;
    if (html.hasAttribute('disabled') || html.closest('[hidden]') !== null) return null;
    try {
      html.focus();
    } catch {
      return null;
    }
    const focused = active() === html;
    if (focused) html.blur();
    return focused;
  };

  const readVisibleText = (node: Element): string => {
    const html = node as HTMLElement;
    const text = typeof html.innerText === 'string' ? html.innerText : node.textContent ?? '';
    return text.replace(/\s+/g, ' ').trim();
  };

  const read = (node: Element): A11yRoleNodeFact => {
    const html = node as HTMLElement;
    const tagName = node.tagName.toLowerCase();
    const tabIndex = node.getAttribute('tabindex');
    const focusable = tabIndex === '-1' ? null : readFocus(node);
    const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const visibleText = readVisibleText(node);
    const ariaLabel = node.getAttribute('aria-label');
    const labelledbyText = (() => {
      const ids = (node.getAttribute('aria-labelledby') ?? '')
        .split(/\s+/)
        .filter((id) => id.length > 0);
      return ids
        .map((id) => {
          const target = root.querySelector(`#${CSS.escape(id)}`);
          return (target?.textContent ?? '').replace(/\s+/g, ' ').trim();
        })
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    })();
    const accessibleName =
      ariaLabel?.trim() || labelledbyText || visibleText;

    return {
      tagName,
      role: node.getAttribute('role'),
      part: node.getAttribute('part'),
      text,
      visibleText,
      accessibleName,
      focusable,
      tabIndex,
      ariaLabel,
      labelledbyText,
      ariaExpanded: node.getAttribute('aria-expanded'),
      ariaHaspopup: node.getAttribute('aria-haspopup'),
      ariaMultiselectable: node.getAttribute('aria-multiselectable'),
      ariaValuenow: node.getAttribute('aria-valuenow'),
      ariaValuemin: node.getAttribute('aria-valuemin'),
      ariaValuemax: node.getAttribute('aria-valuemax'),
      ariaRequired: node.getAttribute('aria-required'),
      hidden: html.closest('[hidden]') !== null,
      disabled: html.hasAttribute('disabled') || html.getAttribute('aria-disabled') === 'true',
    };
  };

  const seen = new Set<Element>();
  const nodes: A11yRoleNodeFact[] = [];
  const collect = (node: Element): void => {
    if (seen.has(node)) return;
    seen.add(node);
    nodes.push(read(node));
  };

  if (host.hasAttribute('role') || host.hasAttribute('part')) collect(host);
  for (const node of Array.from(root.querySelectorAll('[role], [part]'))) {
    if (node === host) continue;
    collect(node);
  }

  return {
    hostTag: host.tagName.toLowerCase(),
    hasShadow: shadow !== null,
    hostFocusable: readFocus(host),
    hostTabIndex: host.getAttribute('tabindex'),
    hostAriaLabel: host.getAttribute('aria-label'),
    nodes,
  };
}

/** 把通用角色快照变成可读的断言结果（纯函数，Node 里跑）。 */
export function evaluateRoleA11y(
  snapshot: A11yRoleSnapshot,
  expectation: A11yRoleExpectation,
): A11yCheck[] {
  const checks: A11yCheck[] = [];
  const withRole = (role: string): A11yRoleNodeFact[] =>
    snapshot.nodes.filter((node) => node.role === role);
  const describe = (node: A11yRoleNodeFact | undefined): string =>
    node === undefined
      ? 'missing'
      : `${node.tagName} part=${node.part ?? 'missing'} role=${node.role ?? 'missing'}`;

  const push = (id: string, name: string, ok: boolean, detail: string): void => {
    checks.push({ id, name, ok, detail });
  };

  const checkOneRole = (role: string, label: string): A11yRoleNodeFact | undefined => {
    const found = withRole(role);
    push(
      `${role}-count`,
      `${label}：恰好一个 role="${role}"`,
      found.length === 1,
      `count=${found.length} -> ${found.map(describe).join(' | ') || 'missing'}`,
    );
    return found[0];
  };

  switch (expectation.profile) {
    case 'select': {
      const combobox = checkOneRole('combobox', '触发器');
      push(
        'combobox-trigger-part',
        'combobox 触发器带 part="trigger"',
        combobox?.part === 'trigger',
        describe(combobox),
      );
      push(
        'combobox-focusable',
        '启用状态下触发器可聚焦',
        combobox?.focusable === true,
        `focusable=${String(combobox?.focusable)} tabindex=${combobox?.tabIndex ?? 'missing'}`,
      );
      push(
        'combobox-haspopup',
        'combobox 声明 aria-haspopup="listbox"',
        combobox?.ariaHaspopup === 'listbox',
        `aria-haspopup=${combobox?.ariaHaspopup ?? 'missing'}`,
      );
      push(
        'combobox-expanded',
        'aria-expanded 与面板开合一致',
        combobox?.ariaExpanded === String(expectation.open === true),
        `aria-expanded=${combobox?.ariaExpanded ?? 'missing'} open=${String(expectation.open === true)}`,
      );

      const listbox = checkOneRole('listbox', '选项面板');
      push(
        'listbox-part',
        'listbox 带 part="listbox"',
        listbox?.part === 'listbox',
        describe(listbox),
      );
      push(
        'listbox-hidden-state',
        '面板 hidden 与 open 状态一致',
        listbox !== undefined && listbox.hidden === (expectation.open !== true),
        `hidden=${String(listbox?.hidden)} open=${String(expectation.open === true)}`,
      );
      if (expectation.multiple) {
        push(
          'listbox-multiselectable',
          '多选面板声明 aria-multiselectable="true"',
          listbox?.ariaMultiselectable === 'true',
          `aria-multiselectable=${listbox?.ariaMultiselectable ?? 'missing'}`,
        );
      }
      if (expectation.open === true) {
        const options = withRole('option');
        const visibleOptions = options.filter((node) => !node.hidden);
        push(
          'option-count',
          '展开时至少一个可见 option',
          visibleOptions.length > 0,
          `options=${options.length} visible=${visibleOptions.length}`,
        );
        push(
          'option-accessible-name',
          '可见 option 都有可访问名',
          visibleOptions.length > 0 &&
            visibleOptions.every((node) => node.accessibleName.trim().length > 0),
          `empty=${visibleOptions.filter((node) => node.accessibleName.trim().length === 0).length}`,
        );
      }
      break;
    }

    case 'date': {
      const panel = checkOneRole('dialog', '日期面板');
      push(
        'date-panel-part',
        '日期面板带 part="panel"',
        panel?.part === 'panel',
        describe(panel),
      );
      push(
        'date-panel-hidden-state',
        '面板 hidden 与 open 状态一致',
        panel !== undefined && panel.hidden === (expectation.open !== true),
        `hidden=${String(panel?.hidden)} open=${String(expectation.open === true)}`,
      );
      if (expectation.inline !== true) {
        const combobox = checkOneRole('combobox', '日期输入框');
        push(
          'date-combobox-part',
          '日期输入框带 part="input"',
          combobox?.part === 'input',
          describe(combobox),
        );
        push(
          'date-combobox-focusable',
          '日期输入框可聚焦',
          combobox?.focusable === true,
          `focusable=${String(combobox?.focusable)}`,
        );
        push(
          'date-combobox-haspopup',
          '日期输入框声明 aria-haspopup="dialog"',
          combobox?.ariaHaspopup === 'dialog',
          `aria-haspopup=${combobox?.ariaHaspopup ?? 'missing'}`,
        );
      }
      if (expectation.open === true) {
        const grid = checkOneRole('grid', '日历');
        push(
          'date-grid-part',
          'grid 带 part="grid"',
          grid?.part === 'grid',
          describe(grid),
        );
        push(
          'date-grid-accessible-name',
          'grid 有可访问名',
          grid !== undefined && grid.accessibleName.trim().length > 0,
          `accessibleName=${JSON.stringify(grid?.accessibleName)}`,
        );
        const cells = withRole('gridcell');
        push(
          'date-grid-cells',
          'grid 含至少 28 个 gridcell',
          cells.length >= 28,
          `gridcell=${cells.length}`,
        );
        push(
          'date-grid-cell-name',
          'gridcell 有可访问名',
          cells.length > 0 &&
            cells.every((node) => (node.ariaLabel ?? node.text).length > 0),
          `empty=${cells.filter((node) => (node.ariaLabel ?? node.text).length === 0).length}`,
        );
        const day = snapshot.nodes.find((node) => node.part === 'day');
        push(
          'date-day-roving-tabindex',
          '日期按钮使用 roving tabindex（0 / -1）',
          day !== undefined && (day.tabIndex === '0' || day.tabIndex === '-1'),
          `part=day tabindex=${day?.tabIndex ?? 'missing'}`,
        );
      }
      break;
    }

    case 'upload': {
      const dropzone = checkOneRole('button', '上传触发区');
      push(
        'upload-dropzone-part',
        '触发区带 part="dropzone"',
        dropzone?.part === 'dropzone',
        describe(dropzone),
      );
      push(
        'upload-dropzone-focusable',
        '启用状态下触发区可聚焦',
        dropzone?.focusable === true,
        `focusable=${String(dropzone?.focusable)} tabindex=${dropzone?.tabIndex ?? 'missing'}`,
      );
      const visibleTriggerText = dropzone?.visibleText ?? '';
      push(
        'upload-dropzone-name',
        '触发区有包含可见文案的可访问名',
        visibleTriggerText.length > 0 &&
          dropzone !== undefined &&
          dropzone.accessibleName.trim().length > 0 &&
          dropzone.accessibleName.includes(visibleTriggerText),
        `visibleText=${JSON.stringify(visibleTriggerText)} accessibleName=${JSON.stringify(
          dropzone?.accessibleName,
        )}`,
      );
      break;
    }

    case 'number': {
      const spin = checkOneRole('spinbutton', '数字输入框');
      push(
        'number-input-part',
        'spinbutton 带 part="input"',
        spin?.part === 'input',
        describe(spin),
      );
      push(
        'number-input-focusable',
        '启用状态下 spinbutton 可聚焦',
        spin?.focusable === true,
        `focusable=${String(spin?.focusable)}`,
      );
      if (expectation.value !== undefined) {
        push(
          'number-aria-valuenow',
          'aria-valuenow 与当前值一致',
          spin?.ariaValuenow === expectation.value,
          `aria-valuenow=${spin?.ariaValuenow ?? 'missing'} expected=${expectation.value}`,
        );
      }
      if (expectation.min !== undefined) {
        push(
          'number-aria-valuemin',
          'aria-valuemin 与 min 一致',
          spin?.ariaValuemin === expectation.min,
          `aria-valuemin=${spin?.ariaValuemin ?? 'missing'} expected=${expectation.min}`,
        );
      }
      if (expectation.max !== undefined) {
        push(
          'number-aria-valuemax',
          'aria-valuemax 与 max 一致',
          spin?.ariaValuemax === expectation.max,
          `aria-valuemax=${spin?.ariaValuemax ?? 'missing'} expected=${expectation.max}`,
        );
      }
      if (expectation.stepper === true) {
        push(
          'number-stepper-buttons',
          '步进按钮带 aria-label 且可聚焦',
          snapshot.nodes.filter(
            (node) => (node.part === 'spin-up' || node.part === 'spin-down') && node.ariaLabel !== null,
          ).length === 2,
          `stepper=${snapshot.nodes.filter((node) => node.part === 'spin-up' || node.part === 'spin-down').length}`,
        );
      }
      break;
    }

    case 'checkbox-group': {
      const group = checkOneRole('group', '选项组');
      push(
        'group-part',
        'group 带 part="group"',
        group?.part === 'group',
        describe(group),
      );
      push(
        'group-accessible-name',
        '选项组有可访问名',
        group !== undefined && group.accessibleName.trim().length > 0,
        `accessibleName=${JSON.stringify(group?.accessibleName.slice(0, 40))}`,
      );
      push(
        'group-required',
        'aria-required 与 required 一致',
        group?.ariaRequired === String(expectation.required === true),
        `aria-required=${group?.ariaRequired ?? 'missing'} required=${String(expectation.required === true)}`,
      );
      break;
    }
  }

  return checks;
}

/** 通用角色断言的一步到位入口。 */
export async function runRoleA11yChecks(
  locator: A11yRoleLocatorLike,
  expectation: A11yRoleExpectation,
): Promise<A11yRoleReport> {
  const snapshot = await locator.evaluate(snapshotA11yRoles);
  const checks = evaluateRoleA11y(snapshot, expectation);
  return { ok: checks.every((check) => check.ok), checks, snapshot };
}

/** 通用角色的断言报告。 */
export interface A11yRoleReport {
  ok: boolean;
  checks: A11yCheck[];
  snapshot: A11yRoleSnapshot;
}
