# x-elements

**一套组件，五个框架通用，零运行时依赖。**

组件用原生 Custom Elements 实现，同一份构建产物可以直接在原生 HTML、React 19、Vue 3、Angular、jQuery 中使用。
产物里不含任何第三方运行时库；类型、文档与 AI 元数据全部由 Custom Elements Manifest（CEM）派生。
当前仓库包含第一个组件：`<x-button>`。

> **验证范围**：原生 HTML、React 19、Vue 3 已由 [`apps/demo`](apps/demo) 的 Playwright e2e 在本仓库验证；
> **Angular 与 jQuery 只是 planned，未在本仓库 demo 验证**，下方示例仅供参考，不能据此推断已支持。

- **零运行时依赖**：`packages/*/dependencies` 恒为空，由 CI 断言。
- **框架无关**：组件只暴露 attribute / property / 事件，框架只负责写参数、听事件。
- **契约先行**：标签名、属性、事件、CSS 变量、parts、主题、reset、CEM、零依赖共 9 条硬规则，见 [CONTRACT.md](CONTRACT.md)。
- **AI 元数据优先**：CEM 是唯一真相源，AI agent 与 IDE 直接读取，不需要另写一份规格。

## 快速开始

> 原生示例需要先构建组件包、再引用构建产物（`dist/index.js` 的实际路径以 `packages/elements` 的构建配置为准）；
> React / Vue 示例直接 `import '@x/elements'`，由各自的打包器处理包内 TS 源码。

### 原生 HTML

```html
<!-- index.html -->
<script type="module" src="./packages/elements/dist/index.js"></script>

<x-button variant="primary">保存</x-button>

<script type="module">
  const button = document.querySelector('x-button');

  // 语义事件：bubbles + composed，所以在宿主页面上直接监听即可
  button.addEventListener('x-button-click', (event) => {
    console.log('clicked', event.detail.originalEvent);
  });
</script>
```

### React 19

```tsx
// App.tsx
import '@x/elements';

export function SaveButton() {
  return (
    <x-button
      variant="primary"
      // React 19：事件 prop 是 `on` + 事件名原样（不转 camelCase）
      // `x-button-click` 本身全小写，所以写成 `onx-button-click`
      onx-button-click={(event) => {
        console.log('clicked', event.detail.originalEvent);
      }}
    >
      保存
    </x-button>
  );
}
```

React 19 会把带连字符的属性按 attribute 写入、把 `on*` 按**原样事件名**监听（`addEventListener(key.slice(2))`，不做大小写转换），因此不需要额外的 wrapper 组件。
`x-button-click` 全小写，正好就是 `onx-button-click`；写成 `onXButtonClick` 监听的是 `XButtonClick`，类型层也会报错。
TypeScript 类型由组件包提供的 `react.d.ts`（扩展 `JSX.IntrinsicElements`）给出。

### Vue 3

```vue
<!-- App.vue -->
<script setup lang="ts">
import '@x/elements';

function onClick(event: CustomEvent<{ originalEvent: MouseEvent }>) {
  console.log('clicked', event.detail.originalEvent);
}
</script>

<template>
  <x-button variant="primary" @x-button-click="onClick">保存</x-button>
</template>
```

Vue 3 需要告诉编译器 `x-*` 是自定义元素，否则会被当成未注册的 Vue 组件：

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith('x-'),
        },
      },
    }),
  ],
});
```

用运行时模板（`createApp({ template })`）时，同样的开关放在 app 上（`apps/demo/vue.ts` 就是这么做的）：

```ts
app.config.compilerOptions.isCustomElement = (tag) => tag.startsWith('x-');
```

### Angular / jQuery（planned，未在本仓库 demo 验证）

下面两段只是**方向性示例，没有任何 demo/CI 覆盖**，不构成"已支持"的承诺。

```ts
// Angular：模块里声明 CUSTOM_ELEMENTS_SCHEMA，模板中直接当原生元素用
@NgModule({ schemas: [CUSTOM_ELEMENTS_SCHEMA] })
export class AppModule {}
```

```html
<x-button (x-button-click)="onClick($event)">保存</x-button>
```

```js
// jQuery：事件名与原生完全一致
$('x-button').on('x-button-click', (event) => console.log(event.detail));
```

## 目录结构

```text
x-elements/
├─ packages/
│  ├─ tokens/            # OKLCH design tokens：构建期生成 CSS 变量（--x-color-*、--x-font-size-* 等）
│  └─ elements/          # Custom Elements 源码、框架类型、CEM（custom-elements.json）
├─ apps/
│  └─ demo/              # 原生 / React / Vue / Tailwind v4 验证页
├─ scripts/              # 零依赖校验脚本：a11y 断言（scripts/a11y）、CI 断言（scripts/ci）
├─ CONTRACT.md           # 组件契约（9 条硬规则 + 正反例）
├─ tsconfig.base.json    # 子包 extends 的 TypeScript 基线
├─ pnpm-workspace.yaml   # workspace 与 pnpm 构建放行配置
└─ .github/workflows/    # CI：tokens→elements 构建、typecheck、test、零依赖/gzip/author 断言
```

## 零第三方运行时库

- `packages/*/dependencies` 恒为空；CI 遍历 `packages/*/package.json` 断言，非空即失败。
- 构建期工具只出现在 `devDependencies`：TypeScript、Vite、Vitest、Playwright。
- 组件产物不 `import` 任何第三方模块；设计 token 以 CSS 变量注入，不引入运行时库。
- 框架适配层是零运行时的 `.d.ts`（React JSX、Vue `GlobalComponents` 等），不打包进组件产物。

## 开发

**顺序很重要：先构建 tokens，再构建 elements**（elements 的类型/产物依赖 tokens 的 `dist/`）。

```bash
pnpm install
pnpm --filter @x/tokens build        # 必须最先：产出 dist/tokens.css 等
pnpm --filter @x/elements build      # esbuild bundle + d.ts
pnpm --filter @x/elements typecheck
pnpm --filter @x/elements test
```

验证面（四个页面 + 三框架 e2e）：

```bash
pnpm --filter demo dev               # http://localhost:5173，四个页面手动看
pnpm --filter demo build             # vite 生产构建
pnpm --filter demo typecheck         # 含 React 事件名正反例、Vue augmentation 检查
pnpm --filter demo e2e               # Playwright：native / react / vue + Tailwind preflight
```

> CI 也按同样顺序跑（`.github/workflows/ci.yml`）：tokens build → elements typecheck → elements build → test → 零依赖断言 → git author 断言 → gzip 预算。

要求 Node.js ≥ 26、pnpm 10.33。
仓库级 registry 沿用全局 `~/.npmrc`（npmmirror 镜像），项目 `.npmrc` 不覆盖。

## 契约

组件对外行为以 [CONTRACT.md](CONTRACT.md) 为准，摘要：

1. 标签名 `x-{component}`，必须带连字符。
2. attribute 全 kebab-case，property camelCase。
3. 事件 `x-{component}-{action}`，`bubbles: true, composed: true`。
4. CSS 变量 `--x-{component}-{prop}`，带 fallback，不硬编码颜色。
5. CSS parts 只暴露语义名。
6. 主题同时支持 `:host([data-theme="dark"])` 与 `prefers-color-scheme`。
7. CEM 是唯一真相源，不另写规格。
8. 组件 `:host` 显式 reset 四项：box-sizing / border / margin / line-height。
9. `packages/*/dependencies` 必须为空（硬红线）。

## License

[MIT](LICENSE) © 2026 CC19990113
