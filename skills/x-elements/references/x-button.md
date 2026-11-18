# x-button

> 由 `packages/mcp/manifest.json`（仓库根 `custom-elements-manifest.json` 的拷贝）派生，表里的类型原文、事件名、CSS 变量、part 与 CEM 一致。
> 改组件 JSDoc 后重新生成：仓库根 `pnpm cem`，再 `pnpm --filter @x/mcp build`。

`<x-button>`：一个动作元素。内部是 Shadow DOM 里的**真原生 `<button>`**，焦点、键盘激活、禁用语义来自平台；默认槽放 label。`disabled` 和 `loading` 都会禁用内部按钮并拦截 `x-button-click`；`loading` 时内部按钮带 `aria-busy="true"`。

## 导入与注册

```js
import '@x/elements';            // 注册 x-button
import '@x/tokens/tokens.css';   // 主题/配色（颜色全部来自 --x-color-*）
```

React 还要 `import type {} from '@x/elements/react';`；Vue 3 还要配 `isCustomElement`（见 [../SKILL.md](../SKILL.md) 规则 9）。

## Attributes

| 名称 | 类型（CEM 原文） | 默认值 | 说明 |
| --- | --- | --- | --- |
| `variant` | `('default'\|'primary'\|'danger'\|'ghost')` | `"default"` | 视觉意图 |
| `size` | `('sm'\|'md'\|'lg')` | `"md"` | 尺寸 |
| `disabled` | `boolean` | 不设置 = `false` | 禁用内部按钮，不触发 `x-button-click` |
| `loading` | `boolean` | 不设置 = `false` | 忙碌态：带上 `aria-busy="true"`，拦截点击 |
| `type` | `('button'\|'submit'\|'reset')` | `"button"` | 只传给内部原生 button，具备原生 `button/submit/reset` 语义；**不提交外层表单**（Shadow DOM 限制，见下） |

布尔 attribute 只认“存在/不存在”：`disabled` 与 `disabled="false"` 都是禁用。

## 事件

| 名称 | detail | 触发条件 |
| --- | --- | --- |
| `x-button-click` | `CustomEvent<{ originalEvent: MouseEvent }>` | 用户激活按钮且未 disabled/loading |

- 事件 `bubbles: true`、`composed: true`：跨 Shadow DOM 边界冒泡，宿主监听时 `event.target` 是 `<x-button>` 本身。
- 原生：`el.addEventListener('x-button-click', handler)`。
- Vue：`@x-button-click="handler"`。
- React 19：`onx-button-click={handler}`（**不是** `onXButtonClick`）。

## Slots

| 名称 | 说明 |
| --- | --- |
| 默认（`name=""`） | 按钮 label：文本、图标或两者 |

## CSS 自定义属性

| 名称 | 说明 | 默认 |
| --- | --- | --- |
| `--x-button-height` | 控件高度 | `2.25rem`（`sm` 2rem，`lg` 2.75rem） |
| `--x-button-radius` | 圆角 | `0.5rem`（`sm` 0.375rem，`lg` 0.625rem） |
| `--x-button-font-size` | label 字号 | `0.875rem`（`sm` 0.8125rem，`lg` 1rem） |

变量一旦设置就优先于 `size` 的默认值。颜色没有组件私有变量，统一用 `--x-color-*` token。

## CSS Parts

| 名称 | 说明 |
| --- | --- |
| `base` | 内部的原生 `<button>` 元素 |

## 主题

- 显式：`<html data-theme="dark">`（或祖先元素），也可以在 `<x-button data-theme="dark">` 上局部设置；组件会同步 `color-scheme`。
- 系统：`prefers-color-scheme` 自动跟随；显式 `data-theme="light"` 能击败系统暗色。
- 颜色只来自 `--x-color-*` token，组件 CSS 内的 fallback 只用于没加载 tokens 的场景。

## 示例

### 原生 HTML

```html
<script type="module">
  import '@x/elements';
  import '@x/tokens/tokens.css';

  document.querySelector('#save').addEventListener('x-button-click', (event) => {
    console.log(event.detail.originalEvent); // 原生 MouseEvent
  });
</script>

<x-button id="save" variant="primary" size="lg">保存</x-button>
<x-button variant="danger" disabled>删除</x-button>
```

### React 19

```tsx
import '@x/elements';
import '@x/tokens/tokens.css';
import type {} from '@x/elements/react';

export function SaveButton() {
  return (
    <x-button
      variant="primary"
      onx-button-click={(event) => {
        console.log(event.detail.originalEvent);
      }}
    >
      保存
    </x-button>
  );
}
```

### Vue 3

```vue
<script setup lang="ts">
import '@x/elements';
import '@x/tokens/tokens.css';

function onClick(event: CustomEvent<{ originalEvent: MouseEvent }>) {
  console.log(event.detail.originalEvent);
}
</script>

<template>
  <x-button variant="primary" @x-button-click="onClick">保存</x-button>
</template>
```

### 表单提交（需要手动）

`<x-button type="submit">` 的 button 在 Shadow DOM 内，不属于外层 `<form>`，不会自动提交。
当前实现没有 `ElementInternals` / `static formAssociated = true`，这是已知缺口（下一阶段基类统一支持），所以 `type` 只有原生语义，不构成 form 关联：

```js
const form = document.querySelector('#my-form');
document.querySelector('#my-submit')
  .addEventListener('x-button-click', () => form.requestSubmit());
```

```html
<form id="my-form">…</form>
<x-button id="my-submit" type="submit">提交</x-button>
```

## 反例

```html
<!-- ❌ 未知元素，不会注册 -->
<xbutton variant="primary">保存</xbutton>

<!-- ❌ React 事件 prop 大小写错：监听的是 XButtonClick -->
<x-button onXButtonClick={save}>保存</x-button>

<!-- ❌ 契约里没有这个 attribute -->
<x-button color="red" label="保存">保存</x-button>

<!-- ❌ 字符串 "false" 仍然表示存在 → 禁用 -->
<x-button disabled="false">保存</x-button>

<!-- ❌ 嵌套按钮 -->
<x-button><button>保存</button></x-button>
```

```css
/* ❌ Shadow DOM 内部选不到，静默失效 */
x-button button { border-radius: 999px; }

/* ✅ 公开 part */
x-button::part(base) { border-radius: 999px; }
```
