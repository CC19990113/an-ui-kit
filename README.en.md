# AN UI Kit

[中文](README.md) · [English](README.en.md)

**AI Native UI Kit** — A framework-agnostic Custom Elements UI library with **zero runtime dependencies, contract-first design, and AI-native discoverability & validation**.

A single build works directly in **Native HTML**, **React 19**, and **Vue 3** (**Angular and jQuery are planned only and not verified in this repository**). The component packages contain zero third-party runtime libraries; TypeScript types, documentation, and AI metadata are all derived from the [Custom Elements Manifest (CEM)](custom-elements-manifest.json) as the single source of truth.

## Contents

- [Key Features](#key-features)
- [Packages & Versions](#packages--versions)
- [Framework Support & Verification Scope](#framework-support--verification-scope)
- [Quick Start](#quick-start)
- [Current Components](#current-components)
- [AI Integration (CEM / Registry / MCP / Skill)](#ai-integration-cem--registry--mcp--skill)
- [Repository Structure](#repository-structure)
- [Development & CI](#development--ci)
- [Component Contract](#component-contract)
- [License](#license)

## Key Features

- **Zero Runtime Dependencies**: `packages/*/dependencies` is always `{}` and enforced in CI (`assert-empty-deps.mjs`). Build outputs never import third-party runtime libraries, and `@an-ui-kit/elements` (`dist/index.js`) is checked against a `gzip ≤ 4096B base + 2560B × 17 components = 47616B` budget. Run `node scripts/ci/assert-bundle-size.mjs` for the current build’s measured size and headroom.
- **Native Custom Elements + Shadow DOM**: Interactive controls use native semantic HTML inside open Shadow DOM and expose attributes, properties, bubbling/composed events, CSS custom properties, and `::part()`. `<an-form>` aggregates its light-DOM descendants directly.
- **OKLCH Design Tokens & Theming**: `@an-ui-kit/tokens` compiles design tokens into CSS variables supporting explicit `data-theme="dark"` / `data-theme="light"` and `prefers-color-scheme`, verified with a built-in WCAG 2.x contrast check.
- **AI-Native Tooling**: Driven by [`custom-elements-manifest.json`](custom-elements-manifest.json) (CEM 2.1.0), projecting into a shadcn-compatible [`registry/`](registry), a read-only MCP server ([`@an-ui-kit/mcp`](packages/mcp)), and an Agent Skill ([`skills/an-ui-kit/`](skills/an-ui-kit)).
- **Contract-First**: Every component adheres to 9 enforceable rules defined in [CONTRACT.md](CONTRACT.md).

## Packages & Versions

| Package | Version | Description | Docs |
|---------|---------|-------------|------|
| `@an-ui-kit/tokens` | `0.1.1` (Published) | OKLCH design tokens (CSS variables, JS/TS, and JSON outputs) | [packages/tokens/README.md](packages/tokens/README.md) |
| `@an-ui-kit/elements` | `0.2.0` (Pending release) | Native Custom Elements and zero-runtime framework types (`./react`, `./vue`) | [packages/elements/README.md](packages/elements/README.md) |
| `@an-ui-kit/mcp` | `0.2.0` (Pending release) | Read-only stdio MCP server exposing component contracts from CEM | [packages/mcp/README.md](packages/mcp/README.md) |
| `@an-ui-kit/cli` | `0.1.0` (First release pending) | Bundles selected components into a single ESM file based on configuration | [packages/cli/README.md](packages/cli/README.md) |

## Framework Support & Verification Scope

> **Verification Scope**: Only **Native HTML**, **React 19**, and **Vue 3** are verified in this repository via Playwright E2E tests in [`apps/demo`](apps/demo) (including a Tailwind v4 preflight coexistence page) and CI. **Angular and jQuery are planned only and have NOT been verified in this repository's demo or CI**; the snippets below are directional only and do not imply support.

| Target | Status | Notes |
|--------|--------|-------|
| Native HTML | **Verified** (Playwright E2E) | Import registration module and listen with standard `addEventListener` (see [`apps/demo/native.html`](apps/demo/native.html)) |
| React 19 | **Verified** (Playwright E2E) | Native Custom Elements support with `on<event>` listeners; JSX types via `@an-ui-kit/elements/react` (see [`apps/demo/react.tsx`](apps/demo/react.tsx)) |
| Vue 3 | **Verified** (Playwright E2E) | Configure `isCustomElement: (tag) => tag.startsWith('an-')`; types via `@an-ui-kit/elements/vue` (see [`apps/demo/vue.ts`](apps/demo/vue.ts)) |
| Angular | **Planned (Unverified)** | Not tested in `apps/demo` or CI |
| jQuery | **Planned (Unverified)** | Not tested in `apps/demo` or CI |

## Quick Start

### 1. Install via npm

```bash
npm install @an-ui-kit/elements @an-ui-kit/tokens
```

Alternatively, copy the zero-dependency component source directly into your project using the [shadcn CLI](#option-1-install-source-via-shadcn-cli) without installing `@an-ui-kit/elements`.

### 2. Import Tokens and Elements

Import `@an-ui-kit/tokens/tokens.css` for full `--an-color-*` design tokens and light/dark theme variables (components also include CSS fallbacks if tokens are omitted):

```ts
import '@an-ui-kit/tokens/tokens.css';
import '@an-ui-kit/elements';
```

> **Need a smaller bundle?** When you only use a few elements, trim by config with
> `npx @an-ui-kit/cli generate`: run `npx @an-ui-kit/cli init` to create `an-ui-kit.config.json`,
> set `components` to an array such as `["an-button"]`, then run `generate` for a single-file ESM
> containing only the selected elements (CSS inlined, zero runtime dependencies).
> See [`packages/cli/README.md`](packages/cli/README.md).

### Native HTML

In an ES module environment (or using a bundler like Vite; see [`apps/demo/native.html`](apps/demo/native.html)):

```html
<an-button variant="primary">Save</an-button>

<script type="module">
  import '@an-ui-kit/tokens/tokens.css';
  import '@an-ui-kit/elements';

  const button = document.querySelector('an-button');

  // `an-button-click` has `bubbles: true` and `composed: true`
  button?.addEventListener('an-button-click', (event) => {
    console.log('clicked', event.detail.originalEvent);
  });
</script>
```

### React 19

```tsx
// App.tsx
import '@an-ui-kit/tokens/tokens.css';
import '@an-ui-kit/elements';
import type {} from '@an-ui-kit/elements/react';

export function SaveButton() {
  return (
    <an-button
      variant="primary"
      // React 19 attaches `on` + exact event name (no camelCase conversion)
      // `an-button-click` is lowercase, so use `onan-button-click`
      onan-button-click={(event) => {
        console.log('clicked', event.detail.originalEvent);
      }}
    >
      Save
    </an-button>
  );
}
```

- **Event naming**: `onan-button-click` listens for `an-button-click`. Writing `onAnButtonClick` listens for `AnButtonClick` and fails typechecking.
- **Types**: `import type {} from '@an-ui-kit/elements/react'` loads the type-only `react.d.ts` (`JSX.IntrinsicElements` augmentation) with zero runtime code.

### Vue 3

```vue
<!-- App.vue -->
<script setup lang="ts">
import '@an-ui-kit/tokens/tokens.css';
import '@an-ui-kit/elements';
import type {} from '@an-ui-kit/elements/vue';

function onClick(event: CustomEvent<{ originalEvent: MouseEvent }>) {
  console.log('clicked', event.detail.originalEvent);
}
</script>

<template>
  <an-button variant="primary" @an-button-click="onClick">Save</an-button>
</template>
```

For SFCs, configure `isCustomElement` in `vite.config.ts` so Vue treats `an-*` tags as native custom elements:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith('an-'),
        },
      },
    }),
  ],
});
```

For runtime templates (`createApp({ template })`), set it on `app.config` as in [`apps/demo/vue.ts`](apps/demo/vue.ts):

```ts
app.config.compilerOptions.isCustomElement = (tag) => tag.startsWith('an-');
```

### Form Input (`<an-input>`)

`<an-input>` wraps a real native `<input>` inside Shadow DOM. The `value` attribute is only the **initial value** (typing never writes it back); value changes are delivered by the contract events `an-input` / `an-change` (`detail.value`). `FormData`, `required` validation, `form.reset()`, and `<fieldset disabled>` all follow native platform semantics.

```html
<an-input name="email" type="email" label="Email" placeholder="you@example.com" required></an-input>

<script type="module">
  import '@an-ui-kit/elements';

  document.querySelector('an-input')?.addEventListener('an-input', (event) => {
    console.log('value', event.detail.value);
  });
</script>
```

- **React 19**: `onan-input={(event) => setValue(event.detail.value)}` (event names bind verbatim, no camel-casing).
- **Vue 3**: `@an-input="onInput"`.
- **Forms**: when `disabled` (on the element or via an ancestor `<fieldset disabled>`) it is excluded from `FormData` and from constraint validation; with an empty `required` value, `form.requestSubmit()` is blocked.

### Forms: native `<form>` + `<an-field>` (optional `<an-form>`)

Value controls are form-associated custom elements that integrate with native forms and constraint validation through `ElementInternals`. Place them directly in a `<form>` to use `form.requestSubmit()`, `new FormData(form)`, and `form.reset()`. `<an-button>` also associates with the form and triggers submit or reset actions. It contributes no field value.

Prefer a native `<form>` for submission, resetting, and constraint validation, with `<an-field>` for labels, hints, and feedback. Use `<an-form>` when a standalone container needs to validate controls or collect `FormData` together. It works with its own light-DOM descendants through `checkValidity()`, `reportValidity()`, `reset()`, and `getFormData()`. The `an-form-submit` event hands the payload to the application for submission. Form ownership stays with the native `<form>`.

Set `<an-form>`’s `.rules` property by field `name`. Explicit calls to `validate()` and `submit()` check only platform constraints and built-in rules. Use `validateAsync()`, `submitAsync()`, or `validateField(name)` to run `validator` callbacks, including callbacks that return synchronously. For example, give `<an-button>` `type="button"` and call `await form.submitAsync()` on `an-button-click`. Field state and actions include `isDirty`, `dirtyFields`, `resetField(name)`, and `getFieldValue(name)`. Enable `show-error-summary` for a clickable list of errors. See the [an-form reference](skills/an-ui-kit/references/an-form.md).

```html
<form id="profile">
  <an-field label="Name" required>
    <an-input name="name" required></an-input>
  </an-field>
  <an-field label="City">
    <an-select name="city" placeholder="Pick one">
      <option value="bj">Beijing</option>
      <option value="sh">Shanghai</option>
    </an-select>
  </an-field>
  <an-button type="submit" variant="primary">Submit</an-button>
  <an-button type="reset">Reset</an-button>
</form>

<script type="module">
  import '@an-ui-kit/elements';

  const form = document.getElementById('profile');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    console.log(Object.fromEntries(new FormData(form).entries()));
  });
</script>
```

`<an-button type="submit">` calls `form.requestSubmit()` (constraint validation runs first; `submit` never fires while the form is invalid). `type="reset"` calls `form.reset()`, and each control's `formResetCallback` restores the value it was mounted with. `<an-select multiple>` and `<an-checkbox-group>` submit one entry per selected value under the same name. Use `formData.getAll(name)` with either a native `<form>` or `<an-form>`.

**`required` / `disabled` / `readonly` across controls**

| Control | `required` | `disabled` (own attribute or an ancestor `<fieldset disabled>`) | `readonly` |
|---------|------------|-----------------------------------------------------------------|------------|
| `<an-input>` | Empty after trim → `valueMissing`, blocks submit and fires `invalid` | Disabled; excluded from `FormData` and constraint validation | Supported: still submits its value but, like the native element, **skips constraint validation** |
| `<an-textarea>` | Same (empty after trim → `valueMissing`) | Same | Supported: value still submitted, validation skipped |
| `<an-select>` | Nothing selected (`value=""`) → `valueMissing` | Same | **Not supported** (the component has no `readonly`; use `disabled` for a read-only look) |
| `<an-checkbox>` | Unchecked → `valueMissing` | Same | **Not supported** (native checkbox has no `readonly`; use `disabled`) |
| `<an-switch>` | Off → `valueMissing` | Same | **Not supported** (same) |
| `<an-radio-group>` | No option selected → `valueMissing` | Whole group disabled; excluded from `FormData` | **Not supported** (native radio has no `readonly`) |
| `<an-number>` | Empty → `valueMissing` | Same | Supported: value still submitted; validation and stepping skipped |
| `<an-date>` | No day selected → `valueMissing` | Same | Supported: value still submitted, validation skipped; picking and typing are blocked |
| `<an-date-range>` | Either end missing → `valueMissing` | Same | **Not supported** (use `disabled`) |
| `<an-checkbox-group>` | Nothing selected → `valueMissing` | Whole group disabled, including every child | **Not supported** (use `disabled`) |
| `<an-upload>` | Empty queue → `valueMissing` | Picking / dropping / uploading disabled | **Not supported** (use `disabled`) |
| `<an-form>` | — (`novalidate` makes `submit()` and `submitAsync()` skip validation) | **Does not cascade**: disable the control itself or an ancestor `<fieldset disabled>` | — |
| `<an-button>` | — | Disabled; blocks clicks and form submission | — |

**How validation errors are shown**

`<an-field>` listens for `invalid` in the **capture phase** (`invalid` does not bubble, so capture is the only way an ancestor can hear it), reads the offending control's own `validationMessage`, renders it in `part="error"` (`role="alert"`), and writes `aria-label` (label text), `aria-description` (hint/error text), and `aria-invalid="true"` onto that control; the field manages `aria-required` and `aria-invalid`. It does not generate `aria-labelledby` / `aria-describedby` IDREFs into its own Shadow DOM; author-provided IDREFs are retained and not overwritten. The error clears as soon as the control dispatches an `input` / `change` / `an-*` change event again.

- The message is resolved in order: the `<an-field error="...">` override → the control's `validationMessage` → the fallback `请输入有效值` (the component's localized default).
- With several controls inside one `<an-field>`, `aria-invalid` lands on whichever control fired `invalid` last.
- A control's own `invalid` attribute is a visual state only; it never takes part in constraint validation. The real gate is `setValidity()`.

### Theming

Set `data-theme="dark"` or `data-theme="light"` on `<html>` (or on an element itself) to override the theme explicitly; otherwise it follows `prefers-color-scheme`.

```html
<html data-theme="dark">
  <!-- All an-* components switch to dark theme -->
</html>
```

### Angular / jQuery (Planned, Unverified)

> Directional snippets only — **not tested or verified in this repository's demo or CI**.

```ts
// Angular: declare CUSTOM_ELEMENTS_SCHEMA in your module/component
@NgModule({ schemas: [CUSTOM_ELEMENTS_SCHEMA] })
export class AppModule {}
```

```html
<an-button (an-button-click)="onClick($event)">Save</an-button>
```

```js
// jQuery: listen with the exact native event name
$('an-button').on('an-button-click', (event) => console.log(event.detail));
```

## Current Components

The repository currently registers 17 custom elements. They include 11 form-associated value controls, the action button `<an-button>`, four structural or presentation elements (`<an-option>`, `<an-option-group>`, `<an-radio>`, `<an-field>`), and the validation and submission controller `<an-form>`. CEM also records the internal base class `AnElement`.

### Component Overview

| Element | Positioning | Main attributes / events |
|---------|-------------|--------------------------|
| `<an-button>` | Action button (a real native `<button>` inside Shadow DOM, with submit and reset actions) | `variant` (`default` \| `primary` \| `danger` \| `ghost`), `size`, `disabled`, `loading`, `type` (`button` \| `submit` \| `reset`); event `an-button-click` |
| `<an-input>` | Single-line input (form-associated, native `<input>`) | `type`, `placeholder`, `label`, `size`, `value` (initial only), `disabled`, `readonly`, `required`, `invalid`, `name`, `maxlength`, `clearable`, `show-count`, `prefix` / `suffix`, `autocomplete`, `spellcheck`, `inputmode`. Events `an-input` / `an-change` / `an-input-clear` |
| `<an-textarea>` | Multi-line text (form-associated, native `<textarea>`) | `rows`, `auto-size`, `min-rows` / `max-rows`, `show-count`, `maxlength`, `resize` (`none` \| `vertical` \| `both`), `placeholder`, `label`, `disabled`, `readonly`, `required`, `invalid`, `name`, `autocomplete`. Events `an-textarea-input` / `an-textarea-change` |
| `<an-number>` | Numeric input (form-associated; internal `<input type="text" inputmode="decimal" role="spinbutton">`, not native `type=number`) | `value` (initial text only), `min`, `max`, `step`, `precision`, `stepper`, `group-separator` (digit grouping, display only), `unit` (unit text, display only), `placeholder`, `size`, `disabled`, `readonly`, `required`, `name`. Event `an-number-change` |
| `<an-select>` | Dropdown (form-associated, with `<an-option>`, native `<option>`, and `<an-option-group>` in light DOM) | `multiple`, `value` / `values` (`string[]` for multi-select), `searchable`, `virtual`, `max-tags`, `open`, `placeholder`, `size`, `label`, `disabled`, `required`, `invalid`, `name`, `loading`, `load-more-threshold`. Events `an-select-change` / `an-select-open` / `an-select-close` / `an-search` / `an-load-more` |
| `<an-option>` | Option of `<an-select>` (light DOM, submits no value itself) | `value` (defaults to text content), `label`, `disabled`; no events |
| `<an-option-group>` | Light-DOM option group for `<an-select>` | `label`, `disabled` (disables options in the group). No events |
| `<an-checkbox>` | Checkbox (form-associated, native `<input type="checkbox">`) | `checked`, `indeterminate`, `disabled`, `required`, `name`, `value`; event `an-checkbox-change` |
| `<an-checkbox-group>` | Checkbox group (form-associated, one entry per selected value under the same name) | `name`, `value` (comma-separated attribute / `string[]` property), `label`, `orientation`, `min`, `max`, `disabled`, `required`, `select-all` (select-all and mixed states). Event `an-checkbox-group-change` |
| `<an-radio>` | One radio option (no form value of its own; the group submits it) | `value`, `checked` (driven by the group), `disabled`; events `an-radio-select` / `an-radio-connect` |
| `<an-radio-group>` | Radio group (form-associated, roving keyboard navigation inside) | `value` (initial), `label`, `disabled`, `required`, `name`; event `an-radio-change` |
| `<an-switch>` | Switch (form-associated; contributes to `FormData` only while on) | `checked`, `disabled`, `required`, `name`, `value`; event `an-switch-change` |
| `<an-date>` | Single-date picker (form-associated, `YYYY-MM-DD`) | `value`, `min`, `max`, `format`, `first-day`, `inline`, `open`, `placeholder`, `size`, `disabled`, `readonly`, `required`, `name`; events `an-date-change` / `an-date-open` / `an-date-close` |
| `<an-date-range>` | Date range (form-associated; submits the `name` and `end-name` fields) | `start`, `end`, `end-name`, `min`, `max`, `first-day`, `inline`, `open`, `placeholder`, `size`, `disabled`, `required`, `name`, `presets` (range shortcuts). Events `an-date-range-change` / `an-date-range-open` / `an-date-range-close` |
| `<an-upload>` | File picker, drop target, paste support and upload queue (form-associated) | `accept`, `multiple`, `max-files`, `max-size`, `action`, `method`, `field-name`, `auto-upload`, `name`, `size`, `disabled`, `required`, `list-type` (`text` \| `picture`), `sortable`. Events `an-upload-change` / `an-upload-reject` / `an-upload-progress` / `an-upload-success` / `an-upload-error` / `an-upload-abort` |
| `<an-field>` | Label / hint / error wrapper (no value, not form-associated) | `label`, `hint`, `error` (forced message), `required` (star + `aria-required` only) |
| `<an-form>` | Validation / submit controller (not a form owner, no value, does not cascade `disabled`) | `novalidate`, `loading`, `show-error-summary`, `.rules` (property). Events `an-form-submit` / `an-form-invalid` / `an-form-reset` |

### `<an-button>`

| Category | Details |
|----------|---------|
| **Attributes** | `variant` (`default` \| `primary` \| `danger` \| `ghost`), `size` (`sm` \| `md` \| `lg`), `disabled` (`boolean`), `loading` (`boolean`), `type` (`button` \| `submit` \| `reset`) |
| **Events** | `an-button-click` (`CustomEvent<{ originalEvent: MouseEvent }>`, `bubbles: true`, `composed: true`) |
| **Slots** | Default slot (`""`) for button label/content |
| **CSS Properties** | `--an-button-height`, `--an-button-radius`, `--an-button-font-size` |
| **CSS Parts** | `base` (the internal native `<button>` element) |

### `<an-input>`

| Category | Details |
|----------|---------|
| **Attributes** | `value` (`string`, initial value only), `type` (`text` \| `email` \| `password` \| `search` \| `tel` \| `url` \| `number`), `placeholder` (`string`), `label` (`string`), `size` (`sm` \| `md` \| `lg`), `disabled` (`boolean`), `readonly` (`boolean`), `required` (`boolean`), `invalid` (`boolean`), `name` (`string`), `maxlength` (`number`), `clearable` / `show-count` / `spellcheck` (`boolean`), `prefix` / `suffix` / `autocomplete` / `inputmode` (`string`) |
| **Events** | `an-input` / `an-change` (`detail = { value, originalEvent }`) and `an-input-clear` (`detail = { value: '' }`). All use `bubbles: true` and `composed: true` |
| **Slots** | `prefix` / `suffix`, which take precedence over text from the corresponding attributes |
| **CSS Properties** | `--an-input-height`, `--an-input-bg`, `--an-input-fg`, `--an-input-border-color`, `--an-input-radius`, `--an-input-font-size`, `--an-input-padding-x`, `--an-input-focus-ring` |
| **CSS Parts** | `base`, `label`, `input` (the internal native `<input>`), `prefix`, `suffix`, `clear`, `count` |

See [`packages/elements/README.md`](packages/elements/README.md) and [`custom-elements-manifest.json`](custom-elements-manifest.json) for full API details.

## AI Integration (CEM / Registry / MCP / Skill)

[`custom-elements-manifest.json`](custom-elements-manifest.json) (CEM `2.1.0`, generated via `pnpm cem`) is the **single source of truth** for component contracts. All AI-layer artifacts are derived from it:

| Artifact | Consumer | Description |
|----------|----------|-------------|
| [`registry/`](registry) | shadcn CLI / JSON-reading agents | Self-contained, zero-npm-dependency registry items (one per component, each with its full source file tree) with CEM `meta` (`attributes`, `events`, `slots`, `cssProperties`, `cssParts`). Cataloged in [`registry/index.json`](registry/index.json). |
| [`packages/mcp/`](packages/mcp) | MCP-compatible agents / IDEs | `@an-ui-kit/mcp` (`an-ui-kit-mcp` CLI): read-only stdio MCP server with 3 tools (`list_components`, `get_component`, `search_components`) backed by a byte-for-byte copy of root CEM ([`manifest.json`](packages/mcp/manifest.json)). Requires Node.js `>=20`. |
| [`skills/an-ui-kit/`](skills/an-ui-kit) | Agent skill hosts (e.g. Claude Code) | Usage rules, contract lookup workflow, anti-patterns, and self-checklists in [`SKILL.md`](skills/an-ui-kit/SKILL.md) and [`references/`](skills/an-ui-kit/references) (one page per component, 17 in total). |

### Option 1: Install Source via shadcn CLI

Install directly by URL:

```bash
npx shadcn@latest add https://raw.githubusercontent.com/CC19990113/an-ui-kit/main/registry/an-button.json
npx shadcn@latest add https://raw.githubusercontent.com/CC19990113/an-ui-kit/main/registry/an-input.json
```

Or configure `@an-ui-kit` in `components.json`:

```json
{
  "registries": {
    "@an-ui-kit": "https://raw.githubusercontent.com/CC19990113/an-ui-kit/main/registry/{name}.json"
  }
}
```

```bash
npx shadcn@latest add @an-ui-kit/an-button
npx shadcn@latest add @an-ui-kit/an-input
```

Both methods install a self-contained file tree with zero npm dependencies (no `@an-ui-kit/elements` required):

```text
src/an-ui-kit/
├─ css.d.ts              # *.css / *.css?inline module declarations
├─ internal/base.ts      # AnElement base class
├─ internal/reset.css    # :host reset
├─ button/
│  ├─ an-button.ts
│  └─ an-button.css
└─ input/
   ├─ an-input.ts
   └─ an-input.css
```

### Option 2: Connect the MCP Server

```json
{
  "mcpServers": {
    "an-ui-kit": {
      "command": "npx",
      "args": ["-y", "@an-ui-kit/mcp"]
    }
  }
}
```

### Regenerating AI Artifacts

Whenever component source or JSDoc changes, regenerate and verify the entire chain together:

```bash
pnpm cem                            # Source -> custom-elements-manifest.json
pnpm registry                       # CEM -> registry/*.json + registry/files/*
pnpm --filter @an-ui-kit/mcp build  # Copy root CEM -> packages/mcp/manifest.json & bundle dist/server.js
pnpm registry:check                 # Verify schema, CEM alignment, and byte-for-byte file sync
```

## Repository Structure

```text
an-ui-kit/
├─ packages/
│  ├─ tokens/            # OKLCH design tokens -> CSS / JS / TS / JSON
│  ├─ elements/          # Native Custom Elements & zero-runtime framework .d.ts
│  └─ mcp/               # @an-ui-kit/mcp stdio MCP server (3 tools)
├─ apps/
│  └─ demo/              # Browser verification: Native HTML / React 19 / Vue 3 / Tailwind v4
├─ registry/             # CEM-derived shadcn registry (index.json, item JSONs, files/)
├─ skills/an-ui-kit/     # Agent skill (SKILL.md + references/*.md, one for each of the 17 components)
├─ scripts/              # Zero-dependency scripts: a11y, CI assertions, registry generator
├─ custom-elements-manifest.json  # CEM 2.1.0 (single source of truth)
├─ CONTRACT.md           # 9 hard component contract rules
├─ tsconfig.base.json    # Shared TypeScript baseline
├─ pnpm-workspace.yaml   # Workspace configuration
└─ .github/workflows/    # CI workflow (ci.yml)
```

## Development & CI

Requires **Node.js 26** (per CI) and **pnpm 10.33.0**.

**Build order matters**: build `@an-ui-kit/tokens` before `@an-ui-kit/elements`.

```bash
pnpm install
pnpm --filter @an-ui-kit/tokens build
pnpm --filter @an-ui-kit/elements typecheck
pnpm --filter @an-ui-kit/elements build
pnpm --filter @an-ui-kit/elements test:coverage
pnpm --filter @an-ui-kit/mcp build
pnpm --filter @an-ui-kit/mcp test
```

Run the demo app and Playwright E2E suite:

```bash
pnpm --filter demo dev        # http://localhost:5173
pnpm --filter demo build      # Production Vite build
pnpm --filter demo typecheck  # Includes React event-name & Vue augmentation checks
pnpm --filter demo exec playwright install chromium webkit firefox
pnpm --filter demo e2e        # Run the same suite in all three browsers
```

On pushes to `main` and pull requests, CI runs the `verify` and `e2e` jobs in parallel. [CI workflow](.github/workflows/ci.yml)

- `verify` builds tokens and elements, runs the type check and the Vitest V8 coverage gate, and checks the coverage summary, CEM freshness, registry and skill synchronization, zero runtime dependencies, commit authors, the gzip budget, and trimmed builds. It then builds and tests MCP and CLI. [Coverage thresholds](packages/elements/test/vitest.config.ts)
- `e2e` runs the same Playwright suite in Chromium, WebKit, and Firefox. It covers Native HTML, React 19, Vue 3, Tailwind v4 preflight, dark mode, and axe accessibility scans. [Playwright configuration](apps/demo/playwright.config.ts)

## Component Contract

All components must satisfy the 9 hard rules in [CONTRACT.md](CONTRACT.md):

1. **Tag name**: `an-{component}` (must include a hyphen).
2. **Attributes / Properties**: kebab-case attributes, camelCase properties.
3. **Events**: `an-{component}-{action}` with `bubbles: true, composed: true`.
4. **CSS custom properties**: `--an-{component}-{prop}` with fallbacks; no hardcoded colors.
5. **CSS parts**: expose semantic part names only.
6. **Theming**: support both `:host([data-theme="dark"])` and `prefers-color-scheme`.
7. **Single source of truth**: CEM (`custom-elements-manifest.json`) only, no separate specs.
8. **Host reset**: `:host` explicitly resets `box-sizing`, `border`, `margin`, and `line-height`.
9. **Zero runtime dependencies**: `packages/*/dependencies` must remain empty `{}`.

## License

[MIT](LICENSE) © 2026 CC19990113
