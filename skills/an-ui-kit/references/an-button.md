# an-button

> 由 `packages/mcp/manifest.json`（仓库根 `custom-elements-manifest.json` 的拷贝）派生，表里的类型原文、事件名、CSS 变量、part 与 CEM 一致。
> 改组件 JSDoc 后重新生成：仓库根 `pnpm cem`，再 `pnpm --filter @an-ui-kit/mcp build`。

`<an-button>`：一个动作元素。内部是 Shadow DOM 里的**真原生 `<button>`**，焦点、键盘激活、禁用语义来自平台；默认槽放 label。`disabled` 和 `loading` 都会禁用内部按钮并拦截 `an-button-click`；`loading` 时内部按钮带 `aria-busy="true"`。

## 导入与注册

```js
import '@an-ui-kit/elements';            // 注册 an-button
import '@an-ui-kit/tokens/tokens.css';   // 主题/配色（颜色全部来自 --an-color-*）
```

React 还要 `import type {} from '@an-ui-kit/elements/react';`；Vue 3 还要配 `isCustomElement`（见 [../SKILL.md](../SKILL.md) 规则 9）。

## Attributes

| 名称 | 类型（CEM 原文） | 默认值 | 说明 |
| --- | --- | --- | --- |
| `variant` | `('default'\|'primary'\|'danger'\|'ghost')` | `"default"` | 视觉意图 |
| `size` | `('sm'\|'md'\|'lg')` | `"md"` | 尺寸 |
| `disabled` | `boolean` | 不设置 = `false` | 禁用内部按钮，不触发 `an-button-click` |
| `loading` | `boolean` | 不设置 = `false` | 忙碌态：带上 `aria-busy="true"`，拦截点击 |
| `type` | `('button'\|'submit'\|'reset')` | `"button"` | 只传给内部原生 button，具备原生 `button/submit/reset` 语义；`submit` 通过外层 form 的 `requestSubmit()` 提交（保留约束校验），`reset` 调 `form.reset()`（见下） |

布尔 attribute 只认“存在/不存在”：`disabled` 与 `disabled="false"` 都是禁用。

## 事件

| 名称 | detail | 触发条件 |
| --- | --- | --- |
| `an-button-click` | `CustomEvent<{ originalEvent: MouseEvent }>` | 用户激活按钮且未 disabled/loading |

- 事件 `bubbles: true`、`composed: true`：跨 Shadow DOM 边界冒泡，宿主监听时 `event.target` 是 `<an-button>` 本身。
- 原生：`el.addEventListener('an-button-click', handler)`。
- Vue：`@an-button-click="handler"`。
- React 19：`onan-button-click={handler}`（**不是** `onAnButtonClick`）。

## Slots

| 名称 | 说明 |
| --- | --- |
| 默认（`name=""`） | 按钮 label：文本、图标或两者 |

## CSS 自定义属性

| 名称 | 说明 | 默认 |
| --- | --- | --- |
| `--an-button-height` | 控件高度 | `2.25rem`（`sm` 2rem，`lg` 2.75rem） |
| `--an-button-radius` | 圆角 | `0.5rem`（`sm` 0.375rem，`lg` 0.625rem） |
| `--an-button-font-size` | label 字号 | `0.875rem`（`sm` 0.8125rem，`lg` 1rem） |

变量一旦设置就优先于 `size` 的默认值。颜色没有组件私有变量，统一用 `--an-color-*` token。

## CSS Parts

| 名称 | 说明 |
| --- | --- |
| `base` | 内部的原生 `<button>` 元素 |

## 主题

- 显式：`<html data-theme="dark">`（或祖先元素），也可以在 `<an-button data-theme="dark">` 上局部设置；组件会同步 `color-scheme`。
- 系统：`prefers-color-scheme` 自动跟随；显式 `data-theme="light"` 能击败系统暗色。
- 颜色只来自 `--an-color-*` token，组件 CSS 内的 fallback 只用于没加载 tokens 的场景。

## 示例

### 原生 HTML

```html
<script type="module">
  import '@an-ui-kit/elements';
  import '@an-ui-kit/tokens/tokens.css';

  document.querySelector('#save').addEventListener('an-button-click', (event) => {
    console.log(event.detail.originalEvent); // 原生 MouseEvent
  });
</script>

<an-button id="save" variant="primary" size="lg">保存</an-button>
<an-button variant="danger" disabled>删除</an-button>
```

### React 19

```tsx
import '@an-ui-kit/elements';
import '@an-ui-kit/tokens/tokens.css';
import type {} from '@an-ui-kit/elements/react';

export function SaveButton() {
  return (
    <an-button
      variant="primary"
      onan-button-click={(event) => {
        console.log(event.detail.originalEvent);
      }}
    >
      保存
    </an-button>
  );
}
```

### Vue 3

```vue
<script setup lang="ts">
import '@an-ui-kit/elements';
import '@an-ui-kit/tokens/tokens.css';

function onClick(event: CustomEvent<{ originalEvent: MouseEvent }>) {
  console.log(event.detail.originalEvent);
}
</script>

<template>
  <an-button variant="primary" @an-button-click="onClick">保存</an-button>
</template>
```

### 表单提交

`<an-button>` 是 form-associated 自定义元素（基类 `AnElement` 的 opt-in `static formAssociated` + `ElementInternals`），`type` 直接作用于外层 `<form>`，无需手动接线：

- `type="submit"`：点击时调用表单的 `requestSubmit()` —— 保留 HTML 约束校验（必填、`pattern`、`min` 等不通过就不提交）。刻意不用 `form.submit()`（会绕过校验）；单测断言 `form.submit()` 从不被调用。
- `type="reset"`：调用表单的 `reset()`。
- 祖先 `<fieldset disabled>`：平台禁用态经 `formDisabledCallback` 透传给内部 button，同时拦截 `an-button-click`。

```html
<form id="my-form" action="/save" method="post">
  <input name="email" type="email" required />
  <an-button type="submit">提交</an-button>
  <an-button type="reset">重置</an-button>
</form>
```

不要在 `an-button-click` 里再手动 `form.requestSubmit()`：按钮在派发事件后已经提交，会重复提交。

## 反例

```html
<!-- ❌ 未知元素，不会注册 -->
<anbutton variant="primary">保存</anbutton>

<!-- ❌ React 事件 prop 大小写错：监听的是 AnButtonClick -->
<an-button onAnButtonClick={save}>保存</an-button>

<!-- ❌ 契约里没有这个 attribute -->
<an-button color="red" label="保存">保存</an-button>

<!-- ❌ 字符串 "false" 仍然表示存在 → 禁用 -->
<an-button disabled="false">保存</an-button>

<!-- ❌ 嵌套按钮 -->
<an-button><button>保存</button></an-button>
```

```css
/* ❌ Shadow DOM 内部选不到，静默失效 */
an-button button { border-radius: 999px; }

/* ✅ 公开 part */
an-button::part(base) { border-radius: 999px; }
```
