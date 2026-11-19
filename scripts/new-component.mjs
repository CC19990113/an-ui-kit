#!/usr/bin/env node
/**
 * Scaffold a new AN UI Kit component.
 *
 *   pnpm new:component <name>
 *   pnpm new:component <name> --form   # also leaves a form-associated placeholder
 *
 * Generates, idempotently:
 *   packages/elements/src/<name>/an-<name>.ts    component skeleton + full JSDoc
 *   packages/elements/src/<name>/an-<name>.css   :host reset + one CSS hook
 *   packages/elements/test/<name>.test.ts       vitest contract test
 * and registers the component in packages/elements/src/index.ts.
 *
 * Zero third-party dependencies: Node built-ins only.
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ELEMENTS = path.join(ROOT, 'packages', 'elements');
const SRC = path.join(ELEMENTS, 'src');
const TEST = path.join(ELEMENTS, 'test');
const INDEX = path.join(SRC, 'index.ts');
const HARNESS = path.join(TEST, 'helpers', 'harness.ts');

/** kebab-case, must start with a letter: `select`, `data-grid`, `x2-widget`. */
const NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

const USAGE = `用法:
  pnpm new:component <name> [--form]

参数:
  <name>    组件名，kebab-case，不带 an- 前缀（例: select、data-grid）
  --form    表单类组件：额外生成 formAssociated 预留注释位
  -h, --help  显示本帮助

生成:
  packages/elements/src/<name>/an-<name>.ts
  packages/elements/src/<name>/an-<name>.css
  packages/elements/test/<name>.test.ts
  并自动在 packages/elements/src/index.ts 追加 import`;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = { form: false, name: '' };

  for (const arg of argv) {
    if (arg === '--form') {
      options.form = true;
    } else if (arg === '-h' || arg === '--help') {
      console.log(USAGE);
      process.exit(0);
    } else if (arg.startsWith('-')) {
      fail(`未知选项 "${arg}"\n\n${USAGE}`);
    } else if (options.name) {
      fail(`只接受一个组件名（多余参数: "${arg}"）\n\n${USAGE}`);
    } else {
      options.name = arg;
    }
  }

  return options;
}

/** `demo-widget` -> `DemoWidget` */
function toPascalCase(name) {
  return name.replace(/(^|-)([a-z0-9])/g, (_match, _dash, char) => char.toUpperCase());
}

/** `DemoWidget` -> `Demo widget` (used as the default label). */
function humanize(pascal) {
  return pascal.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

function renderComponent({ name, className, form }) {
  const defaultLabel = humanize(toPascalCase(name));
  const formPlaceholder = form
    ? `
  // Form-associated placeholder: base.ts gains \`formAssociated\`, \`internals\`
  // and \`onConnect()\` in a follow-up. Keep these lines commented until that
  // lands, so the scaffold typechecks against today's stable API.
  //
  // static override formAssociated = true;
  // readonly #internals = this.attachInternals();
`
    : '';

  return `import { AnElement } from '../internal/base';
import componentStyles from './an-${name}.css?inline';

/**
 * \`<an-${name}>\` — one-line summary of what this element is for.
 *
 * Replace this paragraph with the behaviour contract: what the element
 * renders, which user action maps to \`an-${name}-change\`, and any caveat a
 * consumer must know. CEM and the derived framework types are generated from
 * the tags below, so keep them in sync with the implementation.
 *
 * @attr {string} label - Visible label rendered before the default slot. Default: "${defaultLabel}".
 * @attr {boolean} disabled - Blocks interaction and mirrors \`aria-disabled="true"\` on the host.
 * @slot - Default slot: extra content rendered after the label.
 * @cssprop --an-${name}-gap - Gap between the label and the slotted content; defaults to 0.5rem.
 * @csspart base - The outer wrapper element.
 * @csspart label - The label \`<span>\`.
 * @fires an-${name}-change - Fired when the user activates the component; \`detail.value\` is the current label.
 */
export class ${className} extends AnElement {
  static override styles: string = componentStyles;

  static override defaults = {
    label: '${defaultLabel}',
    disabled: false,
  };

  declare label: string;
  declare disabled: boolean;
${formPlaceholder}
  constructor() {
    super();
    // Listeners live on the shadow root: render() replaces the markup on every
    // update, so per-node listeners would be lost.
    this.shadowRoot?.addEventListener('click', this.#onClick);
  }

  protected override render(): string {
    const blocked = this.disabled ? ' aria-disabled="true"' : '';
    return \`<div class="base" part="base"\${blocked}><span class="label" part="label">\${escapeHtml(this.label)}</span><slot></slot></div>\`;
  }

  protected override afterRender(): void {
    // Keep host-level hooks in sync after every render.
    this.toggleAttribute('data-disabled', this.disabled);
  }

  #onClick = (): void => {
    if (this.disabled) return;
    this.emit('an-${name}-change', { value: this.label });
  };
}

/** Minimal HTML escaping for the string defaults interpolated into markup. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => \`&#\${char.charCodeAt(0)};\`);
}

declare global {
  interface HTMLElementTagNameMap {
    'an-${name}': ${className};
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('an-${name}')) {
  customElements.define('an-${name}', ${className});
}
`;
}

function renderCss({ name }) {
  return `/* Hooks: --an-${name}-gap.
   This file owns layout only; colours, when needed, come from @an-ui-kit/tokens'
   --an-color-* variables with a fallback, never from a hex literal. */

:host {
  box-sizing: border-box;
  border: 0 solid transparent;
  margin: 0;
  line-height: 1.5;

  display: inline-block;
  font: inherit;
  color: inherit;
}

.base {
  display: inline-flex;
  align-items: center;
  gap: var(--an-${name}-gap, 0.5rem);
}

.label {
  font-weight: 500;
}

:host([data-disabled]) .base {
  opacity: 0.5;
  pointer-events: none;
}
`;
}

function renderHarnessTest({ name, className }) {
  return `/** @vitest-environment happy-dom */
import { componentSuite } from './helpers/harness';

import '../src/index';
import { ${className} } from '../src/${name}/an-${name}';

componentSuite({
  tag: 'an-${name}',
  ctor: ${className},
  defaults: ${className}.defaults,
  events: ['an-${name}-change'],
  cssVars: ['--an-${name}-gap'],
  parts: ['base', 'label'],
});
`;
}

function renderDirectTest({ name, className }) {
  return `/** @vitest-environment happy-dom */
// TODO: 等 test/helpers/harness.ts 的 componentSuite 落地后切换，减少重复样板。
import { afterEach, describe, expect, it } from 'vitest';

import '../src/index';
import { ${className} } from '../src/${name}/an-${name}';

function mount(): ${className} {
  const element = document.createElement('an-${name}') as ${className};
  document.body.append(element);
  return element;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('an-${name}', () => {
  it('renders the default label into the base part', () => {
    const element = mount();
    expect(element.shadowRoot?.querySelector('[part="base"]')).not.toBeNull();
    expect(element.shadowRoot?.querySelector('[part="label"]')?.textContent).toBe(${className}.defaults.label);
  });

  it('emits an-${name}-change when clicked', () => {
    const element = mount();
    const seen: CustomEvent[] = [];
    element.addEventListener('an-${name}-change', (event) => seen.push(event as CustomEvent));
    element.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!.click();
    expect(seen).toHaveLength(1);
    expect(seen[0].detail).toEqual({ value: ${className}.defaults.label });
  });
});
`;
}

/**
 * Add `import './<name>/an-<name>.js';` after the last import line.
 * Returns the new source and whether a line was actually added.
 */
function registerInIndex(source, name) {
  const line = `import './${name}/an-${name}.js';`;
  const lines = source.split('\n');

  if (lines.some((existing) => existing.trim() === line)) {
    return { source, added: false };
  }

  let lastImport = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^import\s/.test(lines[i])) lastImport = i;
  }

  lines.splice(lastImport === -1 ? 0 : lastImport + 1, 0, line);
  return { source: lines.join('\n'), added: true };
}

async function main() {
  const { form, name } = parseArgs(process.argv.slice(2));

  if (!name) fail(`缺少组件名\n\n${USAGE}`);
  if (!NAME_PATTERN.test(name)) {
    fail(`非法组件名 "${name}"：必须匹配 ${NAME_PATTERN}（例: select、data-grid）`);
  }

  for (const required of [INDEX, path.join(ELEMENTS, 'package.json')]) {
    if (!existsSync(required)) fail(`仓库结构不符合预期，缺少 ${path.relative(ROOT, required)}`);
  }

  const directory = path.join(SRC, name);
  const componentPath = path.join(directory, `an-${name}.ts`);
  const cssPath = path.join(directory, `an-${name}.css`);
  const testPath = path.join(TEST, `${name}.test.ts`);

  for (const target of [directory, testPath]) {
    if (existsSync(target)) {
      fail(`已存在 ${path.relative(ROOT, target)}，拒绝覆盖（换个名字或先删除旧组件）`);
    }
  }

  const className = `An${toPascalCase(name)}`;
  const useHarness = existsSync(HARNESS);

  try {
    await mkdir(directory, { recursive: true });
    await writeFile(componentPath, renderComponent({ name, className, form }), 'utf8');
    await writeFile(cssPath, renderCss({ name }), 'utf8');
    await writeFile(
      testPath,
      useHarness ? renderHarnessTest({ name, className }) : renderDirectTest({ name, className }),
      'utf8',
    );

    const indexSource = await readFile(INDEX, 'utf8');
    const { source, added } = registerInIndex(indexSource, name);
    if (added) await writeFile(INDEX, source, 'utf8');
  } catch (error) {
    fail(`写入失败：${error instanceof Error ? error.message : String(error)}`);
  }

  console.log(`✓ 生成 an-${name}`);
  console.log('next:');
  console.log('  pnpm cem && pnpm registry && pnpm --filter @an-ui-kit/mcp build');
  console.log('  pnpm --filter @an-ui-kit/elements test');
}

await main();
