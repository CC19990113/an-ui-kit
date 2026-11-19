# an-textarea

> 由 `packages/mcp/manifest.json`（仓库根 `custom-elements-manifest.json` 的拷贝）派生，表里的类型原文、事件名、CSS 变量、part 与 CEM 一致。
> 改组件 JSDoc 后重新生成：仓库根 `pnpm cem`，再 `pnpm --filter @an-ui-kit/mcp build`。

`<an-textarea>`：多行文本输入。内部是 Shadow DOM 里的**真原生 `<textarea>`**，焦点、选区、换行、IME、自动填充、`maxlength` 计数和软键盘都来自平台；`label` 非空时渲染在同一个 Shadow DOM 的 `<label>` 里（隐式关联）。

宿主是 form-associated 自定义元素：`FormData`、`required` 约束校验、`form.reset()`、`<fieldset disabled>` 全部经 `ElementInternals` 走平台语义。`value` 只作**初始值**：attribute 不随键入回写；`required` 按 **trim 后为空**判定。

## 导入与注册

```js
import '@an-ui-kit/elements';            // 注册全部 9 个组件
import '@an-ui-kit/tokens/tokens.css';   // 主题/配色（颜色全部来自 --an-color-*）
```

`@an-ui-kit/elements` 注册全部组件（根入口）。

React 还要 `import type {} from '@an-ui-kit/elements/react';`；Vue 3 还要配 `isCustomElement`（见 [../SKILL.md](../SKILL.md) 规则 9）。

## Attributes

| 名称 | 类型（CEM 原文） | 默认值 | 说明 |
| --- | --- | --- | --- |
| `value` | `string` | `""` | 初始文本。attribute 只在挂载时 seed，键入**不回写** attribute |
| `placeholder` | `string` | `""` | 空值时显示的提示 |
| `label` | `string` | `""` | 可见 `<label>` 文本；空字符串时不渲染标签 |
| `rows` | `number` | `3` | 内部 textarea 的可见行数 |
| `maxlength` | `number` | `-1` | 最大字符数，转发给内部 textarea；`-1` 表示不限 |
| `resize` | `('none'\|'vertical'\|'both')` | `"vertical"` | 缩放把手：`none` 不可缩放、`vertical` 仅纵向、`both` 双向 |
| `disabled` | `boolean` | `false` | 禁止交互，并从 `FormData` 中移除、跳过约束校验 |
| `readonly` | `boolean` | `false` | 只读：值仍提交，但免除校验、不派发事件 |
| `required` | `boolean` | `false` | 参与约束校验；**trim 后为空**才算空 |
| `invalid` | `boolean` | `false` | 视觉无效态：加 `aria-invalid="true"` 与错误样式；不改变校验结果 |
| `name` | `string` | `""` | `FormData` 字段名；空字符串表示不提交 |

布尔 attribute 只认「存在/不存在」：`disabled` 与 `disabled="false"` 都是禁用；要恢复就 `removeAttribute`。

## 事件

| 名称 | detail | 触发条件 |
| --- | --- | --- |
| `an-textarea-input` | `CustomEvent<{ value: string, originalEvent: InputEvent }>` | 每次原生 `input`（键入、粘贴、清除、IME 提交）；`disabled`/`readonly` 时不派发 |
| `an-textarea-change` | `CustomEvent<{ value: string, originalEvent: Event }>` | 原生 `change`（失焦或修改确认后）；`disabled`/`readonly` 时不派发 |

- 事件 `bubbles: true`、`composed: true`：跨 Shadow DOM 边界冒泡，监听时 `event.target` 是 `<an-textarea>` 本身。
- 原生：`el.addEventListener('an-textarea-input', (event) => event.detail.value)`。
- Vue：`@an-textarea-input="handler"`。React 19：`onan-textarea-input={handler}`。

## CSS 自定义属性

| 名称 | 说明 |
| --- | --- |
| `--an-textarea-min-height` | 控件最小高度；默认约两行（`--an-space-9` × 2） |
| `--an-textarea-bg` | 背景色；默认 `--an-color-bg-1` |
| `--an-textarea-fg` | 文本色；默认 `--an-color-fg-1` |
| `--an-textarea-border-color` | 边框色；默认 `--an-color-border-1` |
| `--an-textarea-radius` | 圆角；默认 `--an-radius-md` |
| `--an-textarea-font-size` | 字号；默认 `--an-font-size-sm` |
| `--an-textarea-padding` | 内边距（shorthand）；默认 `--an-space-2 --an-space-3` |
| `--an-textarea-focus-ring` | 聚焦描边与边框色；默认 `--an-color-accent-9` |

## CSS Parts

| part | 说明 |
| --- | --- |
| `base` | 外层容器 |
| `label` | 可见 `<label>`（`label` 非空时才渲染） |
| `textarea` | 内部的原生 `<textarea>` 元素 |

## 主题

- 显式：`<html data-theme="dark">`（或祖先元素），也可以在 `<an-textarea data-theme="dark">` 上局部设置；组件会同步 `color-scheme`。
- 系统：`prefers-color-scheme` 自动跟随；显式 `data-theme="light"` 能击败系统暗色。
- 颜色只来自 `--an-color-*` token，组件 CSS 内的 fallback 只用于没加载 tokens 的场景。

## 示例

### 原生 HTML

```html
<form id="feedback">
  <an-textarea
    name="comment"
    label="反馈内容"
    placeholder="写点什么…"
    rows="5"
    maxlength="500"
    required
  ></an-textarea>
  <an-button type="submit" variant="primary">提交</an-button>
</form>

<script type="module">
  import '@an-ui-kit/elements';

  const form = document.querySelector('#feedback');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    console.log(new FormData(form).get('comment'));
  });

  form.addEventListener('an-textarea-input', (event) => {
    console.log(event.detail.value.length);
  });
</script>
```

### React 19

```tsx
import '@an-ui-kit/elements';
import '@an-ui-kit/tokens/tokens.css';
import type {} from '@an-ui-kit/elements/react';

import { useState } from 'react';

export function Feedback() {
  // value 只做初始值：state 只存回显，不要把 value 当受控属性绑回去。
  const [echo, setEcho] = useState('');

  return (
    <>
      <an-textarea
        name="comment"
        label="反馈内容"
        placeholder="写点什么…"
        rows={5}
        maxlength={500}
        required
        onan-textarea-input={(event) => setEcho(event.detail.value)}
      />
      <p>{echo.length} / 500</p>
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
  <an-textarea
    name="comment"
    label="反馈内容"
    placeholder="写点什么…"
    :rows="5"
    :maxlength="500"
    required
    @an-textarea-input="onInput"
  />
  <p>{{ echo.length }} / 500</p>
</template>
```

### 表单语义

`<an-textarea>` 是 form-associated 自定义元素（`static formAssociated = true` + `ElementInternals`）。内部原生 textarea 在 Shadow DOM 里，不参与外层 `<form>`，所以提交值由宿主自己登记：

- 每次键入 `setFormValue(value)`：`new FormData(form).get(name)` 实时拿到值。
- `required` + **trim 后为空**：`setValidity({ valueMissing: true }, …)`，`form.requestSubmit()` 被拦下（只输入空格也算空）。
- `readonly`：值**仍然提交**，但跳过 `required` 校验，也不派发 `input` / `change` 事件（与原生 `<textarea readonly>` 一致）。
- `disabled`（自身或祖先 `<fieldset disabled>`）：`setFormValue(null)` + `setValidity({})`，不进 `FormData`、不参与校验。
- `form.reset()`：值回到挂载时的初始值（`value` attribute / property 传入的那个）。
- `invalid` 只负责视觉，不改变 `validity`；`<an-field>` 捕获 `invalid` 后显示平台 `validationMessage`。

## a11y 注意事项

- `label` 非空时用同 Shadow DOM 的 `<label>` 包裹内部 textarea（隐式关联）；没有可见 label 时，宿主 `aria-label` / `aria-labelledby` 会转发给内部 textarea。
- 用 `<an-field>` 包裹时，field 会补 `aria-describedby` / `aria-invalid`；不要在 textarea 上重复写一份。
- `required` 会渲染 `aria-required`；`invalid` 会渲染 `aria-invalid`；`readonly` 会渲染 `aria-readonly`。
- 缩放由 `resize` 控制；`resize="none"` 时不要用 CSS 强行 `resize: both`，那会绕开公开契约。
- 字符上限用 `maxlength`（原生计数），不要自己在 `input` 里截断后 `set value`，那会丢 caret。

## 反例

```html
<!-- ❌ 指望 attribute 跟着输入更新：value 不回写 -->
<an-textarea name="comment" value="初始"></an-textarea>
<!-- 用户输入后用 getAttribute('value') 读到的仍是 "初始" -->

<!-- ❌ 布尔 attribute 不看值："false" 仍然算禁用 -->
<an-textarea disabled="false"></an-textarea>

<!-- ❌ 往组件里塞原生 textarea：label / part / 表单语义全丢 -->
<an-textarea label="反馈"><textarea></textarea></an-textarea>
```

```ts
// ❌ required 用 "非空字符串" 判断；组件按 trim 后为空判定
if (!textarea.value) form.requestSubmit(); // "   " 会绕过你的判断

// ✅ 交给平台约束校验
form.requestSubmit();
```

```css
/* ❌ Shadow DOM 内部选不到，静默失效 */
an-textarea textarea { border: 2px solid red; }

/* ✅ 公开 part / 变量 */
an-textarea::part(textarea) { border-width: 2px; }
an-textarea { --an-textarea-border-color: red; }
```
