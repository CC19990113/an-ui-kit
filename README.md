# AN UI Kit

[中文](README.md) · [English](README.en.md)

**AI Native UI Kit** — 一套基于原生 Custom Elements 的跨框架组件库：**零运行时依赖、契约先行、AI 原生可发现与可校验**。

同一份构建产物可直接运行在 **原生 HTML**、**React 19** 与 **Vue 3** 中（**Angular 与 jQuery 仅在规划中，未在本仓库验证**）。组件源码不含任何第三方运行时依赖；类型定义、组件文档与 AI 元数据全部由 [Custom Elements Manifest（CEM）](custom-elements-manifest.json) 单一真相源派生。

## 目录

- [核心特性](#核心特性)
- [包与版本](#包与版本)
- [框架支持与验证范围](#框架支持与验证范围)
- [快速开始](#快速开始)
- [当前组件](#当前组件)
- [AI 集成（CEM / Registry / MCP / Skill）](#ai-集成cem--registry--mcp--skill)
- [目录结构](#目录结构)
- [开发与 CI](#开发与-ci)
- [组件契约](#组件契约)
- [License](#license)

## 核心特性

- **零运行时依赖**：`packages/*/dependencies` 恒为空对象 `{}`，由 CI 脚本（`assert-empty-deps.mjs`）强制断言；构建产出不 `import` 任何第三方运行时库，`@an-ui-kit/elements` 的 `dist/index.js` 受 `gzip ≤ 4096B 基线 + 2560B × 17 个组件 = 47616B` 预算约束。运行 `node scripts/ci/assert-bundle-size.mjs` 查看当前构建的实测体积与余量。
- **原生 Custom Elements + Shadow DOM**：交互控件在开放的 Shadow DOM 中使用原生语义元素，通过 attribute、property、冒泡事件、CSS 变量与 `::part()` 暴露状态与样式。`<an-form>` 直接聚合 light DOM 后代。
- **OKLCH Design Tokens 与双主题**：`@an-ui-kit/tokens` 在构建期生成 CSS 变量，支持显式 `data-theme="dark"` / `data-theme="light"` 与系统 `prefers-color-scheme`，并内建 WCAG 2.x 对比度校验。
- **AI 原生三件套**：以根 [`custom-elements-manifest.json`](custom-elements-manifest.json)（CEM 2.1.0）为唯一真相源，派生 shadcn 兼容 [`registry/`](registry)、只读 MCP Server [`@an-ui-kit/mcp`](packages/mcp) 与 Agent Skill [`skills/an-ui-kit/`](skills/an-ui-kit)。
- **契约先行**：所有组件严格遵守 [CONTRACT.md](CONTRACT.md) 中的 9 条硬规则。

## 包与版本

| 包名 | 版本 | 说明 | 文档 |
|------|------|------|------|
| `@an-ui-kit/tokens` | `0.1.1` | OKLCH design tokens（CSS 变量、JS/TS 与 JSON 产物） | [packages/tokens/README.md](packages/tokens/README.md) |
| `@an-ui-kit/elements` | `0.1.0` | 原生 Custom Elements 组件与零运行时框架类型（`./react`、`./vue`） | [packages/elements/README.md](packages/elements/README.md) |
| `@an-ui-kit/mcp` | `0.1.0` | stdio 只读 MCP Server，向 AI agent 暴露 CEM 组件契约 | [packages/mcp/README.md](packages/mcp/README.md) |

## 框架支持与验证范围

> **验证范围声明**：只有 **原生 HTML**、**React 19** 与 **Vue 3** 已通过 [`apps/demo`](apps/demo) 中的 Playwright E2E（含 Tailwind v4 preflight 共存页面）及 CI 验证；**Angular 与 jQuery 目前仅处于 planned 阶段，未在本仓库的 demo 或 CI 中验证**，下方对应示例仅为方向性参考，不构成已支持承诺。

| 目标环境 | 状态 | 说明 |
|----------|------|------|
| 原生 HTML | **已验证**（Playwright E2E） | 直接引入注册脚本，使用标准 `addEventListener` 监听事件（见 [`apps/demo/native.html`](apps/demo/native.html)） |
| React 19 | **已验证**（Playwright E2E） | 原生支持 Custom Elements 属性与 `on<event>`；通过 `@an-ui-kit/elements/react` 提供 JSX 类型（见 [`apps/demo/react.tsx`](apps/demo/react.tsx)） |
| Vue 3 | **已验证**（Playwright E2E） | 配置 `isCustomElement: (tag) => tag.startsWith('an-')`；通过 `@an-ui-kit/elements/vue` 提供类型（见 [`apps/demo/vue.ts`](apps/demo/vue.ts)） |
| Angular | **Planned（未验证）** | 尚未在本仓库 demo 或 CI 中测试 |
| jQuery | **Planned（未验证）** | 尚未在本仓库 demo 或 CI 中测试 |

## 快速开始

### 1. 通过 npm 安装

```bash
npm install @an-ui-kit/elements @an-ui-kit/tokens
```

也可以通过 [shadcn CLI 方式](#方式一使用-shadcn-cli-安装源码) 将零依赖源码直接复制到项目中，无需安装 `@an-ui-kit/elements`。

### 2. 引入样式与组件

建议同时引入 `@an-ui-kit/tokens/tokens.css` 以提供完整的 `--an-color-*` 设计变量与明暗主题支持（未引入时组件内部也有 fallback）：

```ts
import '@an-ui-kit/tokens/tokens.css';
import '@an-ui-kit/elements';
```

> **需要更小的产物？** 只用少数几个组件时，用 `npx @an-ui-kit/cli generate` 按配置裁剪：
> 先 `npx @an-ui-kit/cli init` 生成 `an-ui-kit.config.json`，把 `components` 改成 `["an-button"]` 这样的数组，
> 再跑 `generate` 就得到只含选中组件的单文件 ESM（CSS 已内联、无运行时依赖）。
> 详见 [`packages/cli/README.md`](packages/cli/README.md)。

### 原生 HTML

在支持 ES 模块的环境（或使用 Vite 等打包器，参考 [`apps/demo/native.html`](apps/demo/native.html)）中导入后即可直接使用标签：

```html
<an-button variant="primary">保存</an-button>

<script type="module">
  import '@an-ui-kit/tokens/tokens.css';
  import '@an-ui-kit/elements';

  const button = document.querySelector('an-button');

  // an-button-click 设置了 bubbles: true 与 composed: true，可在宿主或祖先节点监听
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
      // React 19 按 `on` + 事件名原样绑定（不转 camelCase）
      // `an-button-click` 全小写，因此写为 `onan-button-click`
      onan-button-click={(event) => {
        console.log('clicked', event.detail.originalEvent);
      }}
    >
      保存
    </an-button>
  );
}
```

- **事件命名**：`onan-button-click` 监听的是 `an-button-click`；若误写为 `onAnButtonClick`，React 19 会监听 `AnButtonClick` 且 TypeScript 类型检查会报错。
- **类型支持**：`import type {} from '@an-ui-kit/elements/react'` 引入纯类型文件 `react.d.ts`（扩展 `JSX.IntrinsicElements`），不产生任何运行时代码。

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
  <an-button variant="primary" @an-button-click="onClick">保存</an-button>
</template>
```

使用单文件组件（SFC）时，需在 `vite.config.ts` 中告知编译器将 `an-*` 视为自定义元素：

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

若使用运行时模板（`createApp({ template })`），则按 [`apps/demo/vue.ts`](apps/demo/vue.ts) 的做法将配置挂在 `app.config` 上：

```ts
app.config.compilerOptions.isCustomElement = (tag) => tag.startsWith('an-');
```

### 表单输入（`<an-input>`）

`<an-input>` 在 Shadow DOM 里包装真正的原生 `<input>`，`value` attribute 只作为**初始值**（键入不回写），值变化走契约事件 `an-input` / `an-change`（`detail.value`）；`FormData`、`required` 校验、`form.reset()`、`<fieldset disabled>` 由平台按原生语义处理。

```html
<an-input name="email" type="email" label="邮箱" placeholder="you@example.com" required></an-input>

<script type="module">
  import '@an-ui-kit/elements';

  document.querySelector('an-input')?.addEventListener('an-input', (event) => {
    console.log('value', event.detail.value);
  });
</script>
```

- **React 19**：`onan-input={(event) => setValue(event.detail.value)}`（事件名原样绑定，不转 camelCase）。
- **Vue 3**：`@an-input="onInput"`。
- **表单**：`disabled`（自身或祖先 `<fieldset disabled>`）时既不进 `FormData` 也不参与约束校验；`required` 空值时 `form.requestSubmit()` 会被拦下。

### 表单：原生 `<form>` + `<an-field>`（可选 `<an-form>`）

值控件是 form-associated custom elements，经 `ElementInternals` 接入原生表单与约束校验。直接放在 `<form>` 内，即可使用 `form.requestSubmit()`、`new FormData(form)` 与 `form.reset()`。`<an-button>` 也关联表单，负责触发提交或重置，本身无字段值。

首选原生 `<form>` 管理提交、重置与校验，由 `<an-field>` 提供标签、提示与错误反馈。需要在独立容器内统一校验或聚合 `FormData` 时，可用 `<an-form>`。它通过 `checkValidity()`、`reportValidity()`、`reset()`、`getFormData()` 与自己的 light DOM 后代协作，并通过 `an-form-submit` 把数据交给应用提交。原生 `<form>` 保留 form owner 职责。

`<an-form>` 的 `.rules` 按字段 `name` 定义规则。显式 `validate()` / `submit()` 只检查平台约束和内置规则。要执行 `validator` 回调（包括同步返回的回调），使用 `validateAsync()`、`submitAsync()` 或 `validateField(name)`。例如用 `type="button"` 的 `<an-button>` 监听 `an-button-click`，再调用 `await form.submitAsync()`。字段状态与操作包括 `isDirty`、`dirtyFields`、`resetField(name)` 和 `getFieldValue(name)`，`show-error-summary` 可显示可点击的错误列表。详见 [an-form 参考](skills/an-ui-kit/references/an-form.md)。

```html
<form id="profile">
  <an-field label="姓名" required>
    <an-input name="name" required></an-input>
  </an-field>
  <an-field label="城市">
    <an-select name="city" placeholder="请选择">
      <option value="bj">北京</option>
      <option value="sh">上海</option>
    </an-select>
  </an-field>
  <an-button type="submit" variant="primary">提交</an-button>
  <an-button type="reset">重置</an-button>
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

`<an-button type="submit">` 走 `form.requestSubmit()`（先跑约束校验，不合法时 `submit` 不触发）；`type="reset"` 走 `form.reset()`，各控件的 `formResetCallback` 恢复挂载时的初始值。`<an-select multiple>` 和 `<an-checkbox-group>` 每个选中值提交一条同名记录；在原生 `<form>` 和 `<an-form>` 中都可以用 `formData.getAll(name)` 读取。

**`required` / `disabled` / `readonly` 在各控件上的差异**

| 控件 | `required` | `disabled`（自身或祖先 `<fieldset disabled>`） | `readonly` |
|------|------------|-----------------------------------------------|------------|
| `<an-input>` | trim 后为空 → `valueMissing`，阻止提交并派发 `invalid` | 禁用；不进 `FormData`、不参与校验 | 支持：值照常提交，但像原生一样**跳过约束校验** |
| `<an-textarea>` | 同上（trim 后为空 → `valueMissing`） | 同上 | 支持：值照常提交，跳过约束校验 |
| `<an-select>` | 未选择（`value=""`）→ `valueMissing` | 同上 | **不支持**（组件没有 `readonly`；需要只读语义用 `disabled`） |
| `<an-checkbox>` | 未勾选 → `valueMissing` | 同上 | **不支持**（原生 checkbox 无 `readonly`，用 `disabled`） |
| `<an-switch>` | 未开启 → `valueMissing` | 同上 | **不支持**（同上） |
| `<an-radio-group>` | 没有选中项 → `valueMissing` | 整组禁用；不进 `FormData` | **不支持**（原生 radio 无 `readonly`） |
| `<an-number>` | 空值 → `valueMissing` | 同上 | 支持：值照常提交，跳过约束校验与步进 |
| `<an-date>` | 未选日期 → `valueMissing` | 同上 | 支持：值照常提交、跳过约束校验；禁止选择与键入 |
| `<an-date-range>` | 未选全两端 → `valueMissing` | 同上 | **不支持**（需要只读语义用 `disabled`） |
| `<an-checkbox-group>` | 一个都没选 → `valueMissing` | 整组禁用，所有子项一起禁用 | **不支持**（用 `disabled`） |
| `<an-upload>` | 队列为空 → `valueMissing` | 禁用选择 / 拖放 / 上传 | **不支持**（用 `disabled`） |
| `<an-form>` | —（`novalidate` 可跳过 `submit()` / `submitAsync()` 的校验） | **不级联**：禁用控件自身或祖先 `<fieldset disabled>` | — |
| `<an-button>` | — | 禁用，阻断点击与表单提交 | — |

**校验错误怎么显示**

`<an-field>` 在**捕获阶段**监听 `invalid`（`invalid` 不冒泡，捕获是唯一能在祖先收听到的方式），读出错控件自己的 `validationMessage` 作为错误文本，渲染 `part="error"`（`role="alert"`），并给该控件写 `aria-label`（label 文本）、`aria-description`（hint/error 文本）及 `aria-invalid="true"`；`aria-required` / `aria-invalid` 由 field 管理。field 不生成指向自身 Shadow DOM 的 `aria-labelledby` / `aria-describedby`，作者已有的 IDREF 保留且不覆盖。控件再次派发 `input` / `change` / `an-*` 变化事件时，错误自动清除。

- 错误文本按顺序取：`<an-field error="...">` 强制值 → 控件的 `validationMessage` → 兜底文案 `请输入有效值`。
- 一个 `<an-field>` 里放多个控件时，`aria-invalid` 只落在最后派发 `invalid` 的那个控件上。
- 控件自己的 `invalid` attribute 只是视觉状态，不参与约束校验；真正的拦截来自 `setValidity()`。

### 主题切换

在根节点（如 `<html>`）或组件自身设置 `data-theme="dark"` / `data-theme="light"` 即可显式切换主题；未设置时自动跟随系统 `prefers-color-scheme`。

```html
<html data-theme="dark">
  <!-- 所有 an-* 组件自动切换为暗色主题 -->
</html>
```

### Angular / jQuery（Planned，未验证）

> 以下仅展示 Custom Elements 在对应框架中的标准用法方向，**尚未在本仓库的 demo 或 CI 中验证**。

```ts
// Angular：在模块或独立组件中声明 CUSTOM_ELEMENTS_SCHEMA
@NgModule({ schemas: [CUSTOM_ELEMENTS_SCHEMA] })
export class AppModule {}
```

```html
<an-button (an-button-click)="onClick($event)">保存</an-button>
```

```js
// jQuery：直接按原生事件名监听
$('an-button').on('an-button-click', (event) => console.log(event.detail));
```

## 当前组件

仓库当前注册 17 个 Custom Elements，包括 11 个 form-associated 值控件、动作按钮 `<an-button>`、4 个结构或展示元素（`<an-option>`、`<an-option-group>`、`<an-radio>`、`<an-field>`），以及校验与提交控制器 `<an-form>`。CEM 还记录内部基类 `AnElement`。

### 组件一览

| 元素 | 定位 | 主要 attributes / 事件 |
|------|------|------------------------|
| `<an-button>` | 按钮（Shadow DOM 内部是真实原生 `<button>`，支持提交与重置动作） | `variant`（`default` \| `primary` \| `danger` \| `ghost`）、`size`、`disabled`、`loading`、`type`（`button` \| `submit` \| `reset`）；事件 `an-button-click` |
| `<an-input>` | 单行输入（form-associated，原生 `<input>`） | `type`、`placeholder`、`label`、`size`、`value`（仅初始值）、`disabled`、`readonly`、`required`、`invalid`、`name`、`maxlength`、`clearable`、`show-count`、`prefix` / `suffix`、`autocomplete`、`spellcheck`、`inputmode`；事件 `an-input` / `an-change` / `an-input-clear` |
| `<an-textarea>` | 多行文本（form-associated，原生 `<textarea>`） | `rows`、`auto-size`、`min-rows` / `max-rows`、`show-count`、`maxlength`、`resize`（`none` \| `vertical` \| `both`）、`placeholder`、`label`、`disabled`、`readonly`、`required`、`invalid`、`name`、`autocomplete`；事件 `an-textarea-input` / `an-textarea-change` |
| `<an-number>` | 数字输入（form-associated；内部 `<input type="text" inputmode="decimal" role="spinbutton">`，非原生 `type=number`） | `value`（仅初始文本）、`min`、`max`、`step`、`precision`、`stepper`、`group-separator`（千分位，仅显示）、`unit`（单位文字，仅显示）、`placeholder`、`size`、`disabled`、`readonly`、`required`、`name`；事件 `an-number-change` |
| `<an-select>` | 下拉选择（form-associated，light DOM 支持 `<an-option>`、原生 `<option>` 与 `<an-option-group>`） | `multiple`、`value` / `values`（多选为 `string[]`）、`searchable`、`virtual`、`max-tags`、`open`、`placeholder`、`size`、`label`、`disabled`、`required`、`invalid`、`name`、`loading`、`load-more-threshold`；事件 `an-select-change` / `an-select-open` / `an-select-close` / `an-search` / `an-load-more` |
| `<an-option>` | `<an-select>` 的选项（light DOM，不自带表单值） | `value`（缺省取文本内容）、`label`、`disabled`；无事件 |
| `<an-option-group>` | `<an-select>` 的选项分组（light DOM 结构件） | `label`、`disabled`（禁用组内选项）；无事件 |
| `<an-checkbox>` | 复选框（form-associated，原生 `<input type="checkbox">`） | `checked`、`indeterminate`、`disabled`、`required`、`name`、`value`；事件 `an-checkbox-change` |
| `<an-checkbox-group>` | 复选组（form-associated，每个选中值提交一条同名记录） | `name`、`value`（attribute 逗号分隔 / property `string[]`）、`label`、`orientation`、`min`、`max`、`disabled`、`required`、`select-all`（全选与半选）；事件 `an-checkbox-group-change` |
| `<an-radio>` | 单选项（不自带表单值，由 `<an-radio-group>` 统一提交） | `value`、`checked`（由 group 驱动）、`disabled`；事件 `an-radio-select` / `an-radio-connect` |
| `<an-radio-group>` | 单选组（form-associated，键盘导航在组内） | `value`（初始值）、`label`、`disabled`、`required`、`name`；事件 `an-radio-change` |
| `<an-switch>` | 开关（form-associated，开启时才进 `FormData`） | `checked`、`disabled`、`required`、`name`、`value`；事件 `an-switch-change` |
| `<an-date>` | 单日期选择（form-associated，`YYYY-MM-DD`） | `value`、`min`、`max`、`format`、`first-day`、`inline`、`open`、`placeholder`、`size`、`disabled`、`readonly`、`required`、`name`；事件 `an-date-change` / `an-date-open` / `an-date-close` |
| `<an-date-range>` | 日期范围（form-associated，提交 `name` 与 `end-name` 两个字段） | `start`、`end`、`end-name`、`min`、`max`、`first-day`、`inline`、`open`、`placeholder`、`size`、`disabled`、`required`、`name`、`presets`（快捷范围）；事件 `an-date-range-change` / `an-date-range-open` / `an-date-range-close` |
| `<an-upload>` | 文件选择、拖放、粘贴与上传队列（form-associated） | `accept`、`multiple`、`max-files`、`max-size`、`action`、`method`、`field-name`、`auto-upload`、`name`、`size`、`disabled`、`required`、`list-type`（`text` \| `picture`）、`sortable`；事件 `an-upload-change` / `an-upload-reject` / `an-upload-progress` / `an-upload-success` / `an-upload-error` / `an-upload-abort` |
| `<an-field>` | 标签 / 提示 / 错误的包装器（无值、不参与表单） | `label`、`hint`、`error`（强制错误文案）、`required`（展示星号与 `aria-required`） |
| `<an-form>` | 校验 / 提交控制器（不拥有 `<form>`、无值、不级联 `disabled`） | `novalidate`、`loading`、`show-error-summary`、`.rules`（property）；事件 `an-form-submit` / `an-form-invalid` / `an-form-reset` |

### `<an-button>`

| 类别 | 说明 |
|------|------|
| **Attributes** | `variant`（`default` \| `primary` \| `danger` \| `ghost`）、`size`（`sm` \| `md` \| `lg`）、`disabled`（`boolean`）、`loading`（`boolean`）、`type`（`button` \| `submit` \| `reset`） |
| **Events** | `an-button-click`（`CustomEvent<{ originalEvent: MouseEvent }>`，`bubbles: true`、`composed: true`） |
| **Slots** | 默认插槽（`""`）：按钮文案或内容 |
| **CSS 变量** | `--an-button-height`、`--an-button-radius`、`--an-button-font-size` |
| **CSS Parts** | `base`（内部的原生 `<button>` 元素） |

### `<an-input>`

| 类别 | 说明 |
|------|------|
| **Attributes** | `value`（`string`，只作初始值）、`type`（`text` \| `email` \| `password` \| `search` \| `tel` \| `url` \| `number`）、`placeholder`（`string`）、`label`（`string`）、`size`（`sm` \| `md` \| `lg`）、`disabled`（`boolean`）、`readonly`（`boolean`）、`required`（`boolean`）、`invalid`（`boolean`）、`name`（`string`）、`maxlength`（`number`）、`clearable` / `show-count` / `spellcheck`（`boolean`）、`prefix` / `suffix` / `autocomplete` / `inputmode`（`string`） |
| **Events** | `an-input` / `an-change`（`detail = { value, originalEvent }`）、`an-input-clear`（`detail = { value: '' }`），均为 `bubbles: true`、`composed: true` |
| **Slots** | `prefix` / `suffix`，优先于同名 attribute 的文本 |
| **CSS 变量** | `--an-input-height`、`--an-input-bg`、`--an-input-fg`、`--an-input-border-color`、`--an-input-radius`、`--an-input-font-size`、`--an-input-padding-x`、`--an-input-focus-ring` |
| **CSS Parts** | `base`、`label`、`input`（内部原生 `<input>`）、`prefix`、`suffix`、`clear`、`count` |

完整 API 详见 [`packages/elements/README.md`](packages/elements/README.md) 与 [`custom-elements-manifest.json`](custom-elements-manifest.json)。

## AI 集成（CEM / Registry / MCP / Skill）

[`custom-elements-manifest.json`](custom-elements-manifest.json)（CEM `2.1.0`，由 `pnpm cem` 生成）是组件契约的**唯一真相源**，AI 层三件套均由它派生：

| 产物 | 消费方 | 说明 |
|------|--------|------|
| [`registry/`](registry) | shadcn CLI / 直接读 JSON 的 agent | 每组件一份**自包含、零 npm 依赖**的 registry item（各含完整源文件树）；`meta` 原样携带 CEM 的 `attributes` / `events` / `slots` / `cssProperties` / `cssParts`，总目录见 [`registry/index.json`](registry/index.json) |
| [`packages/mcp/`](packages/mcp) | 支持 MCP 的 agent / IDE | `@an-ui-kit/mcp`（命令行入口 `an-ui-kit-mcp`）：stdio 只读 MCP Server，提供 `list_components`、`get_component`、`search_components` 3 个工具，数据源为根 CEM 逐字节拷贝的 [`manifest.json`](packages/mcp/manifest.json)，要求 Node.js `>=20` |
| [`skills/an-ui-kit/`](skills/an-ui-kit) | Agent Skill 宿主（如 Claude Code） | 包含使用时机、契约查询流程、反例对照与自查清单，见 [`SKILL.md`](skills/an-ui-kit/SKILL.md) 与 [`references/`](skills/an-ui-kit/references)（17 个组件各一篇） |

### 方式一：使用 shadcn CLI 安装源码

直接通过 URL 安装：

```bash
npx shadcn@latest add https://raw.githubusercontent.com/CC19990113/an-ui-kit/main/registry/an-button.json
npx shadcn@latest add https://raw.githubusercontent.com/CC19990113/an-ui-kit/main/registry/an-input.json
```

或在 `components.json` 中配置 `@an-ui-kit` 命名 registry：

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

两种方式都会安装一套零 npm 依赖、可独立编译的文件树（无需安装 `@an-ui-kit/elements`）：

```text
src/an-ui-kit/
├─ css.d.ts              # *.css / *.css?inline 模块声明
├─ internal/base.ts      # AnElement 基类
├─ internal/reset.css    # :host reset
├─ button/
│  ├─ an-button.ts
│  └─ an-button.css
└─ input/
   ├─ an-input.ts
   └─ an-input.css
```

### 方式二：接入 MCP Server

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

### 重新生成 AI 产物

修改组件源码或 JSDoc 后，需同步重新生成并校验整条链路：

```bash
pnpm cem                            # 源码 -> custom-elements-manifest.json
pnpm registry                       # CEM -> registry/*.json + registry/files/*
pnpm --filter @an-ui-kit/mcp build  # 拷贝根 CEM -> packages/mcp/manifest.json 并打包 dist/server.js
pnpm registry:check                 # 校验 schema、meta 与 CEM 一致、content 与源码逐字节一致
```

## 目录结构

```text
an-ui-kit/
├─ packages/
│  ├─ tokens/            # OKLCH design tokens -> CSS / JS / TS / JSON
│  ├─ elements/          # 原生 Custom Elements 与零运行时框架 .d.ts
│  └─ mcp/               # @an-ui-kit/mcp stdio MCP server（3 个工具）
├─ apps/
│  └─ demo/              # 浏览器验证面：原生 HTML / React 19 / Vue 3 / Tailwind v4
├─ registry/             # CEM 派生的 shadcn registry（index.json、组件 JSON 与 files/）
├─ skills/an-ui-kit/     # Agent Skill（SKILL.md + references/*.md，17 个组件各一篇）
├─ scripts/              # 零依赖脚本：a11y、CI 断言、registry 生成
├─ custom-elements-manifest.json  # CEM 2.1.0（唯一真相源）
├─ CONTRACT.md           # 9 条组件硬契约
├─ tsconfig.base.json    # TypeScript 公共基线
├─ pnpm-workspace.yaml   # pnpm workspace 配置
└─ .github/workflows/    # CI 工作流（ci.yml）
```

## 开发与 CI

环境要求：**Node.js 26**（与 CI 一致）与 **pnpm 10.33.0**。

**构建顺序很重要**：必须先构建 `@an-ui-kit/tokens`，再构建 `@an-ui-kit/elements`。

```bash
pnpm install
pnpm --filter @an-ui-kit/tokens build
pnpm --filter @an-ui-kit/elements typecheck
pnpm --filter @an-ui-kit/elements build
pnpm --filter @an-ui-kit/elements test:coverage
pnpm --filter @an-ui-kit/mcp build
pnpm --filter @an-ui-kit/mcp test
```

运行 demo 与 Playwright E2E 测试：

```bash
pnpm --filter demo dev        # http://localhost:5173
pnpm --filter demo build      # Vite 生产构建
pnpm --filter demo typecheck  # 含 React 事件名与 Vue augmentation 检查
pnpm --filter demo exec playwright install chromium webkit firefox
pnpm --filter demo e2e        # 三个浏览器执行同一套用例
```

推送到 `main` 或发起 PR 时，CI 并行运行 `verify` 和 `e2e` 两个任务。[CI 工作流](.github/workflows/ci.yml)

- `verify` 构建 tokens 和 elements，运行类型检查与 Vitest V8 单测覆盖率门禁，并检查覆盖率汇总、CEM 时效性、registry 与 skill 同步、零运行时依赖、提交作者、gzip 体积预算和裁剪构建。随后构建并测试 MCP 与 CLI。[覆盖率阈值](packages/elements/test/vitest.config.ts)
- `e2e` 在 Chromium、WebKit 和 Firefox 上运行同一套 Playwright 用例，覆盖原生 HTML、React 19、Vue 3、Tailwind v4 preflight、深色主题和 axe 无障碍扫描。[Playwright 配置](apps/demo/playwright.config.ts)

## 组件契约

所有组件必须遵守 [CONTRACT.md](CONTRACT.md) 中的 9 条硬规则：

1. **标签名**：`an-{component}`，必须带连字符。
2. **attribute / property**：attribute 全 kebab-case，property 全 camelCase。
3. **事件**：`an-{component}-{action}`，配置 `bubbles: true, composed: true`。
4. **CSS 变量**：`--an-{component}-{prop}`，带 fallback，不硬编码颜色。
5. **CSS parts**：只暴露语义名称。
6. **主题**：同时支持 `:host([data-theme="dark"])` 与 `prefers-color-scheme`。
7. **单一真相源**：以 CEM（`custom-elements-manifest.json`）为准，不另写规格。
8. **宿主 reset**：`:host` 显式 reset `box-sizing`、`border`、`margin`、`line-height` 四项。
9. **零运行时依赖**：`packages/*/dependencies` 恒为空对象 `{}`。

## License

[MIT](LICENSE) © 2026 CC19990113
