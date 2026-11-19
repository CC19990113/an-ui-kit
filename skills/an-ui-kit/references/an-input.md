# an-input

> 由 `packages/mcp/manifest.json`（仓库根 `custom-elements-manifest.json` 的拷贝）派生，表里的类型原文、事件名、CSS 变量、part 与 CEM 一致。
> 改组件 JSDoc 后重新生成：仓库根 `pnpm cem`，再 `pnpm --filter @an-ui-kit/mcp build`。

`<an-input>`：一个单行输入框。内部是 Shadow DOM 里的**真原生 `<input>`**，焦点、选区、IME、自动填充、`type` 语义与软键盘都来自平台；可见 `label` 渲染在同一 Shadow DOM 里并把内部 input 包住（隐式关联）。宿主是 form-associated 自定义元素：`FormData`、`required` 约束校验、`form.reset()`、`<fieldset disabled>` 全部经 `ElementInternals` 走平台语义。

`value` 是唯一「读 attribute 但不回写」的状态：attribute 只作为**初始值**，键入只更新 property 与 `FormData`，不会修改 DOM 上的 attribute。

## 导入与注册

```js
import '@an-ui-kit/elements';            // 注册 an-button + an-input
import '@an-ui-kit/tokens/tokens.css';   // 主题/配色（颜色全部来自 --an-color-*）
```

`@an-ui-kit/elements` 注册全部组件（根入口）。

React 还要 `import type {} from '@an-ui-kit/elements/react';`；Vue 3 还要配 `isCustomElement`（见 [../SKILL.md](../SKILL.md) 规则 9）。

## Attributes

| 名称 | 类型（CEM 原文） | 默认值 | 说明 |
| --- | --- | --- | --- |
| `value` | `string` | `""` | 初始值。attribute 只在挂载时读一次，键入**不回写** attribute |
| `type` | `('text'\|'email'\|'password'\|'search'\|'tel'\|'url'\|'number')` | `"text"` | 原样传给内部原生 `<input>`；未知值回退 `text` |
| `placeholder` | `string` | `""` | 占位文本，转给内部原生 input |
| `label` | `string` | `""` | 可见 label。为空时**不渲染** `<label>`，改从宿主转发 `aria-label` / `aria-labelledby` |
| `size` | `('sm'\|'md'\|'lg')` | `"md"` | 尺寸 |
| `disabled` | `boolean` | 不设置 = `false` | 禁用内部 input，拦截 `an-input`/`an-change`，不进 `FormData`、不参与约束校验 |
| `readonly` | `boolean` | 不设置 = `false` | 内部 input 只读，拦截 `an-input`/`an-change`（值仍随 `FormData` 提交） |
| `required` | `boolean` | 不设置 = `false` | 通过 `setValidity({ valueMissing })` 参与外层 form 的约束校验（空值时拦住提交） |
| `invalid` | `boolean` | 不设置 = `false` | 外部错误态：映射成 `aria-invalid="true"` + 错误边框（不自己算校验结果） |
| `name` | `string` | `""` | 表单字段名，即 `FormData` 的 key |
| `maxlength` | `number` | `-1` | 最大字符数，转发给内部 input；`-1` 表示不限 |
| `clearable` | `boolean` | 不设置 = `false` | 有值时显示清除按钮 |
| `show-count` | `boolean` | 不设置 = `false` | 显示 `value.length/maxlength`（无 `maxlength` 时只显示长度） |
| `prefix` | `string` | `""` | 输入框前缀文本；`slot="prefix"` 优先于它 |
| `suffix` | `string` | `""` | 输入框后缀文本；`slot="suffix"` 优先于它 |
| `autocomplete` | `string` | `""` | autocomplete 提示，转发给内部 input |
| `spellcheck` | `boolean` | `true` | 是否启用平台拼写检查（默认 `true`，写 `spellcheck="false"` 关闭） |
| `inputmode` | `string` | `""` | 虚拟键盘提示，转发给内部 input |

布尔 attribute 只认「存在/不存在」：`disabled` 与 `disabled="false"` 都是禁用；要恢复就 `removeAttribute`。

## 事件

| 名称 | detail | 触发条件 |
| --- | --- | --- |
| `an-input` | `CustomEvent<{ value: string, originalEvent: InputEvent }>` | 每次原生 `input`（键入、粘贴、清除、IME 提交）；`disabled`/`readonly` 时不派发 |
| `an-change` | `CustomEvent<{ value: string, originalEvent: Event }>` | 原生 `change`（失焦或回车确认后）；`disabled`/`readonly` 时不派发 |

- 事件 `bubbles: true`、`composed: true`：跨 Shadow DOM 边界冒泡，监听时 `event.target` 是 `<an-input>` 本身。
- 原生：`el.addEventListener('an-input', (event) => event.detail.value)`。
- Vue：`@an-input="handler"`（Vue 对自定义元素直接 `addEventListener`）。
- React 19：`onan-input={handler}` / `onan-change={handler}`（**不是** `onAnInput`；React 对自定义元素的事件名不做 camelCase 转换）。

原生 `input` 事件是 composed 的，会穿出 Shadow DOM 并重定向到宿主；原生 `change` 不是 composed，出不来。两者都没有 `detail.value` —— 契约事件是 `an-input` / `an-change`，不要靠原生事件猜值。

## CSS 自定义属性

| 名称 | 说明 | 默认 |
| --- | --- | --- |
| `--an-input-height` | 控件高度 | `2.25rem`（`sm` 2rem，`lg` 2.75rem） |
| `--an-input-bg` | 控件背景 | `--an-color-bg-1` |
| `--an-input-fg` | 文本颜色 | `--an-color-fg-1` |
| `--an-input-border-color` | 边框颜色 | `--an-color-border-1` |
| `--an-input-radius` | 圆角 | `--an-radius-md`（`sm` 0.375rem，`lg` 0.625rem） |
| `--an-input-font-size` | 字号 | `--an-font-size-sm`（`sm` 0.8125rem，`lg` 1rem） |
| `--an-input-padding-x` | 水平内边距 | `--an-space-3`（`sm` 0.5rem，`lg` 1rem） |
| `--an-input-focus-ring` | 焦点轮廓/聚焦边框颜色 | `--an-color-accent-9` |

变量一旦设置就优先于 `size` 的默认值。错误边框固定用 `--an-color-danger-9`。

## CSS Parts

| 名称 | 说明 |
| --- | --- |
| `base` | 包裹 label 与控件的外层容器 |
| `label` | 可见 `<label>`（`label` 非空时才渲染） |
| `input` | 内部的原生 `<input>` 元素 |

## 主题

- 显式：`<html data-theme="dark">`（或祖先元素），也可以在 `<an-input data-theme="dark">` 上局部设置；组件会同步 `color-scheme`。
- 系统：`prefers-color-scheme` 自动跟随；显式 `data-theme="light"` 能击败系统暗色。
- 颜色只来自 `--an-color-*` token，组件 CSS 内的 fallback 只用于没加载 tokens 的场景。

## 示例

### 原生 HTML

```html
<script type="module">
  import '@an-ui-kit/elements';
  import '@an-ui-kit/tokens/tokens.css';

  document.querySelector('#email').addEventListener('an-input', (event) => {
    console.log(event.detail.value); // 当前值（每次键入）
  });
</script>

<an-input id="email" name="email" type="email" label="邮箱" placeholder="you@example.com"></an-input>
<an-input size="lg" aria-label="搜索" placeholder="搜索…"></an-input>
```

### React 19

```tsx
import '@an-ui-kit/elements';
import '@an-ui-kit/tokens/tokens.css';
import type {} from '@an-ui-kit/elements/react';

import { useState } from 'react';

export function EmailField() {
  // value 只做初始值：state 只存「回显」，不要把 value 绑回去。
  const [echo, setEcho] = useState('');

  return (
    <>
      <an-input
        name="email"
        type="email"
        label="邮箱"
        placeholder="you@example.com"
        onan-input={(event) => setEcho(event.detail.value)}
      />
      <p>{echo}</p>
    </>
  );
}
```

### Vue 3

```vue
<script setup lang="ts">
import '@an-ui-kit/elements';
import '@an-ui-kit/tokens/tokens.css';

import { ref } from 'vue';

const echo = ref('');

function onInput(event: CustomEvent<{ value: string }>) {
  echo.value = event.detail.value;
}
</script>

<template>
  <an-input name="email" type="email" label="邮箱" @an-input="onInput" />
  <p>{{ echo }}</p>
</template>
```

### 表单语义

`<an-input>` 是 form-associated 自定义元素（`static formAssociated = true` + `ElementInternals`）。内部的原生 `<input>` 在 Shadow DOM 里，不参与外层 `<form>`，所以提交值由宿主自己登记：

- 每次键入 `setFormValue(value)`：`new FormData(form).get(name)` 实时拿到值。
- `required` + 空值：`setValidity({ valueMissing: true }, …)`，`form.requestSubmit()` 会被拦下（`submit` 事件不触发，`invalid` 事件触发）。
- `disabled`（自身或祖先 `<fieldset disabled>`）：`setFormValue(null)` + `setValidity({})` —— 与原生 `<input disabled>` 一样**不进 FormData、不参与校验**。
- `form.reset()`：值回到挂载时的初始值（`value` attribute / property 传入的那个）。
- `invalid` 只负责视觉与 `aria-invalid`，不会自己给 `setValidity` 塞错误；业务错误请配合 `invalid` 展示。

```html
<form id="profile">
  <an-input name="nickname" label="昵称" required></an-input>
  <an-input name="bio" label="简介" placeholder="选填"></an-input>
  <an-button type="submit">提交</an-button>
</form>
```

```js
document.querySelector('#profile').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  console.log(data.get('nickname')); // ElementInternals 登记的字符串值
});
```

## a11y 注意事项

- **必须给名字**：写 `label`，或（不给可见 label 时）写 `aria-label` / `aria-labelledby`。组件不会替你造名，两者都空就是无名控件（e2e 会把这种 `<an-input>` 判成 label 缺失）。
- 可见 `label` 是把内部 `<input>` 包在同一个 `<label>` 里建立关联的，不要另外给内部 input 塞 `for`/`id`（你也选不到它）。
- 状态经 `ElementInternals` 暴露：`aria-disabled`、`aria-readonly`、`aria-required`、`aria-invalid` 跟随 `disabled` / `readonly` / `required` / `invalid` 同步。
- 焦点在内部原生 `<input>` 上；宿主本身不接收焦点。不要给宿主加 `tabindex="-1"`，也别指望 `an-input:focus`。
- `name` 缺失时值仍会提交，但 `FormData` 的 key 是空字符串；表单场景请显式写 `name`。

## 反例

```html
<!-- ❌ 没有 label、也没有 aria-label：无名控件 -->
<an-input placeholder="请输入"></an-input>

<!-- ❌ 事件名猜错：这样监听不到契约事件 -->
<an-input onInput="..." onchange="..."></an-input>

<!-- ❌ 把 value 当受控属性反复写回：会打断 IME / 光标跳动 -->
<an-input id="controlled"></an-input>
<script>
  const el = document.querySelector('#controlled');
  el.addEventListener('an-input', () => { el.value = el.value.toUpperCase(); });
</script>

<!-- ❌ 契约里没有这个 attribute（不是原生 input） -->
<an-input maxlength="10" autocomplete="off"></an-input>

<!-- ❌ 字符串 "false" 仍然表示存在 → 禁用 -->
<an-input disabled="false"></an-input>

<!-- ❌ 往组件里塞原生 input：label / part / 表单语义全丢 -->
<an-input label="邮箱"><input type="email" /></an-input>
```

```css
/* ❌ Shadow DOM 内部选不到，静默失效 */
an-input input { border-radius: 999px; }

/* ✅ 公开 part */
an-input::part(input) { border-radius: 999px; }
```
