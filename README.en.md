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

- **Zero Runtime Dependencies**: `packages/*/dependencies` is always `{}` and enforced in CI (`assert-empty-deps.mjs`). Build outputs never import third-party runtime libraries, and `@an-ui-kit/elements` (`dist/index.js`) is checked against a `gzip ≤ 3072B` budget.
- **Native Custom Elements + Shadow DOM**: Built on native semantic HTML elements inside `attachShadow({ mode: 'open' })`, exposing attributes, properties, bubbling/composed events, CSS custom properties, and `::part()`.
- **OKLCH Design Tokens & Theming**: `@an-ui-kit/tokens` compiles design tokens into CSS variables supporting explicit `data-theme="dark"` / `data-theme="light"` and `prefers-color-scheme`, verified with a built-in WCAG 2.x contrast check.
- **AI-Native Tooling**: Driven by [`custom-elements-manifest.json`](custom-elements-manifest.json) (CEM 2.1.0), projecting into a shadcn-compatible [`registry/`](registry), a read-only MCP server ([`@an-ui-kit/mcp`](packages/mcp)), and an Agent Skill ([`skills/an-ui-kit/`](skills/an-ui-kit)).
- **Contract-First**: Every component adheres to 9 enforceable rules defined in [CONTRACT.md](CONTRACT.md).

## Packages & Versions

| Package | Version | Description | Docs |
|---------|---------|-------------|------|
| `@an-ui-kit/tokens` | `0.1.1` | OKLCH design tokens (CSS variables, JS/TS, and JSON outputs) | [packages/tokens/README.md](packages/tokens/README.md) |
| `@an-ui-kit/elements` | `0.1.0` | Native Custom Elements and zero-runtime framework types (`./react`, `./vue`) | [packages/elements/README.md](packages/elements/README.md) |
| `@an-ui-kit/mcp` | `0.1.0` | Read-only stdio MCP server exposing component contracts from CEM | [packages/mcp/README.md](packages/mcp/README.md) |

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

The repository currently ships two custom elements: **`<an-button>`** (`AnButton`, backed by a native `<button>` inside Shadow DOM) and **`<an-input>`** (`AnInput`, backed by a native `<input>` inside Shadow DOM, form-associated; CEM also exports the internal base class `AnElement`).

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
| **Attributes** | `value` (`string`, initial value only), `type` (`text` \| `email` \| `password` \| `search` \| `tel` \| `url` \| `number`), `placeholder` (`string`), `label` (`string`), `size` (`sm` \| `md` \| `lg`), `disabled` (`boolean`), `readonly` (`boolean`), `required` (`boolean`), `invalid` (`boolean`), `name` (`string`) |
| **Events** | `an-input` / `an-change` (`CustomEvent<{ value: string, originalEvent }>`, `bubbles: true`, `composed: true`) |
| **Slots** | None (the visible label is rendered from the `label` attribute) |
| **CSS Properties** | `--an-input-height`, `--an-input-bg`, `--an-input-fg`, `--an-input-border-color`, `--an-input-radius`, `--an-input-font-size`, `--an-input-padding-x`, `--an-input-focus-ring` |
| **CSS Parts** | `base`, `label`, `input` (the internal native `<input>` element) |

See [`packages/elements/README.md`](packages/elements/README.md) and [`custom-elements-manifest.json`](custom-elements-manifest.json) for full API details.

## AI Integration (CEM / Registry / MCP / Skill)

[`custom-elements-manifest.json`](custom-elements-manifest.json) (CEM `2.1.0`, generated via `pnpm cem`) is the **single source of truth** for component contracts. All AI-layer artifacts are derived from it:

| Artifact | Consumer | Description |
|----------|----------|-------------|
| [`registry/`](registry) | shadcn CLI / JSON-reading agents | Self-contained, zero-npm-dependency registry items (`an-button` / `an-input`, each with its full source file tree) with CEM `meta` (`attributes`, `events`, `slots`, `cssProperties`, `cssParts`). Cataloged in [`registry/index.json`](registry/index.json). |
| [`packages/mcp/`](packages/mcp) | MCP-compatible agents / IDEs | `@an-ui-kit/mcp` (`an-ui-kit-mcp` CLI): read-only stdio MCP server with 3 tools (`list_components`, `get_component`, `search_components`) backed by a byte-for-byte copy of root CEM ([`manifest.json`](packages/mcp/manifest.json)). Requires Node.js `>=20`. |
| [`skills/an-ui-kit/`](skills/an-ui-kit) | Agent skill hosts (e.g. Claude Code) | Usage rules, contract lookup workflow, anti-patterns, and self-checklists in [`SKILL.md`](skills/an-ui-kit/SKILL.md), [`references/an-button.md`](skills/an-ui-kit/references/an-button.md), and [`references/an-input.md`](skills/an-ui-kit/references/an-input.md). |

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
├─ skills/an-ui-kit/     # Agent skill (SKILL.md + references/an-button.md, an-input.md)
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
pnpm --filter @an-ui-kit/elements test
pnpm --filter @an-ui-kit/mcp build
pnpm --filter @an-ui-kit/mcp test
```

Run the demo app and Playwright E2E suite:

```bash
pnpm --filter demo dev        # http://localhost:5173
pnpm --filter demo build      # Production Vite build
pnpm --filter demo typecheck  # Includes React event-name & Vue augmentation checks
pnpm --filter demo e2e        # Playwright: native / react / vue + Tailwind preflight
```

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push to `main` and pull request: `tokens build` → `elements typecheck / build / test` → CEM freshness, registry sync, skill sync, empty `dependencies`, git author, and `dist/index.js` gzip (`≤ 3072B`) assertions → `mcp build / test` → Playwright Chromium E2E across Native HTML, React 19, Vue 3, and Tailwind preflight.

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
