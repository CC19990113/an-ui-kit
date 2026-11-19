# an-checkbox

> 由 `packages/mcp/manifest.json`（仓库根 `custom-elements-manifest.json` 的拷贝）派生，表里的类型原文、事件名、CSS 变量、part 与 CEM 一致。
> 改组件 JSDoc 后重新生成：仓库根 `pnpm cem`，再 `pnpm --filter @an-ui-kit/mcp build`。

`<an-checkbox>`：一个布尔勾选框。内部是 Shadow DOM 里的**真原生 `<input type="checkbox">`**，焦点、Space 切换、`:checked` 和可访问的 checked 状态都来自平台；默认 slot 的文本渲染在包裹内部 input 的 `<label part="base">` 里，所以点文字也能切换。

宿主是 form-associated 自定义元素：`FormData`、`required` 约束校验、`form.reset()`、`<fieldset disabled>` 全部经 `ElementInternals` 走平台语义。`checked` 是**公开状态**，属于 attribute-backed property：用户切换会把 `checked` attribute 写回，markup、property 与提交值永远不会互相矛盾。

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
| `checked` | `boolean` | `false` | 勾选状态；用户点击会把 attribute 写回，`form.reset()` 回到挂载时的值 |
| `disabled` | `boolean` | `false` | 禁用交互；不进 `FormData`、不参与约束校验（祖先 `<fieldset disabled>` 同样生效） |
| `required` | `boolean` | `false` | 未勾选时 `valueMissing`，`form.requestSubmit()` 会被拦下 |
| `indeterminate` | `boolean` | `false` | 只影响视觉与 `aria-checked="mixed"`，**不参与提交**；用户点击后会被自动清除（与原生 checkbox 一致） |
| `name` | `string` | `""` | `FormData` 里的字段名；空字符串表示不提交 |
| `value` | `string` | `"on"` | **勾选时**提交的值 |

布尔 attribute 只认「存在/不存在」：`checked` 与 `checked="false"` 都是勾选；要取消就 `removeAttribute('checked')`。

## 事件

| 名称 | detail | 触发条件 |
| --- | --- | --- |
| `an-checkbox-change` | `CustomEvent<{ checked: boolean, value: string, originalEvent: Event }>` | 用户交互导致勾选状态变化之后；`disabled` 时不派发 |

- 事件 `bubbles: true`、`composed: true`：跨 Shadow DOM 边界冒泡，监听时 `event.target` 是 `<an-checkbox>` 本身。
- 只由**用户交互**触发；代码里 `el.checked = true` 只更新状态，不派发事件。
- 原生：`el.addEventListener('an-checkbox-change', (event) => event.detail.checked)`。
- Vue：`@an-checkbox-change="handler"`。React 19：`onan-checkbox-change={handler}`。

## CSS 自定义属性

| 名称 | 说明 |
| --- | --- |
| `--an-checkbox-size` | 勾选框边长；默认 `1rem` |
| `--an-checkbox-radius` | 圆角；默认 `--an-radius-sm` |
| `--an-checkbox-accent` | 勾选态边框与对勾颜色；默认 `--an-color-accent-9` |
| `--an-checkbox-border-color` | 未勾选边框颜色；默认 `--an-color-border-1` |

## CSS Parts

| part | 说明 |
| --- | --- |
| `base` | 外层 `<label>` 包裹 |
| `control` | 画出来的勾选框（原生 input 的装饰性兄弟节点） |
| `label` | 默认 slot 的包裹层 |

## 主题

- 显式：`<html data-theme="dark">`（或祖先元素），也可以在 `<an-checkbox data-theme="dark">` 上局部设置；组件会同步 `color-scheme`。
- 系统：`prefers-color-scheme` 自动跟随；显式 `data-theme="light"` 能击败系统暗色。
- 颜色只来自 `--an-color-*` token，组件 CSS 内的 fallback 只用于没加载 tokens 的场景。

## 示例

### 原生 HTML

```html
<form id="prefs">
  <an-checkbox name="newsletter" value="yes">订阅产品更新</an-checkbox>
  <an-checkbox name="terms" value="accepted" required>我已阅读并同意条款</an-checkbox>
  <an-button type="submit" variant="primary">保存</an-button>
</form>

<script type="module">
  import '@an-ui-kit/elements';

  const form = document.querySelector('#prefs');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    console.log(new FormData(form).get('newsletter')); // "yes" 或 null
  });

  form.addEventListener('an-checkbox-change', (event) => {
    console.log(event.target.name, event.detail.checked);
  });
</script>
```

### React 19

```tsx
import '@an-ui-kit/elements';
import '@an-ui-kit/tokens/tokens.css';
import type {} from '@an-ui-kit/elements/react';

import { useState } from 'react';

export function Terms() {
  // checked 是可写状态；这里只回显，不把它当受控属性绑回去。
  const [accepted, setAccepted] = useState(false);

  return (
    <>
      <an-checkbox
        name="terms"
        value="accepted"
        onan-checkbox-change={(event) => setAccepted(event.detail.checked)}
      >
        我已阅读并同意条款
      </an-checkbox>
      <p>当前：{accepted ? '已同意' : '未同意'}</p>
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

const accepted = ref(false);

function onChange(event: CustomEvent<{ checked: boolean }>) {
  accepted.value = event.detail.checked;
}
</script>

<template>
  <an-checkbox
    name="terms"
    value="accepted"
    :checked="accepted"
    @an-checkbox-change="onChange"
  >
    我已阅读并同意条款
  </an-checkbox>
</template>
```

### 表单语义

`<an-checkbox>` 是 form-associated 自定义元素（`static formAssociated = true` + `ElementInternals`）。内部原生 input 在 Shadow DOM 里，不参与外层 `<form>`，所以提交值由宿主自己登记：

- 勾选：`setFormValue(value)` —— 提交 `name=value`（默认 `on`）。
- 未勾选：`setFormValue(null)` —— 与原生 checkbox 一样不出现在 `FormData` 里（不会提交 `"false"`）。
- `required` + 未勾选：`setValidity({ valueMissing: true }, …)`，`form.requestSubmit()` 被拦下。
- `disabled`（自身或祖先 `<fieldset disabled>`）：`setFormValue(null)` + `setValidity({})` —— 不进 `FormData`、不参与校验。
- `form.reset()`：`checked` 回到挂载时的初始值；`indeterminate` 不在提交/重置契约里。
- `<an-field>` 会捕获宿主的 `invalid` 事件并显示平台 `validationMessage`；这个组件没有 `invalid` attribute。

## a11y 注意事项

- 默认 slot 文本就是可访问名称（渲染在 `<label>` 内，点击文字切换）；**不要**写 `label` attribute，它不存在。
- 没有可见文本时，把文本放进 slot 并做视觉隐藏（`.sr-only` 之类）；宿主上的 `aria-label` **不会**转发给内部 input（CEM 也没有 `label` attribute）。
- 键盘：Tab 聚焦，Space 切换，焦点环由 `::part(control)` 暴露。
- `indeterminate` 渲染为 `aria-checked="mixed"`；它只是视觉状态，用户一点击就变回 `false`。
- 用 `<an-field>` 包裹时，label/hint/error 由 field 负责；不要在 checkbox 上重复写一份。

## 反例

```html
<!-- ❌ 没有 label attribute：文本必须走默认 slot -->
<an-checkbox label="同意条款"></an-checkbox>

<!-- ❌ 布尔 attribute 不看值："false" 仍然算勾选 -->
<an-checkbox checked="false">同意条款</an-checkbox>

<!-- ❌ 想提交 false：未勾选时组件提交 null，不是布尔值 -->
<an-checkbox name="terms" value="false">同意条款</an-checkbox>

<!-- ❌ 往组件里塞原生 input：part / 表单语义全丢 -->
<an-checkbox><input type="checkbox" />同意条款</an-checkbox>
```

```ts
// ❌ 把 indeterminate 当提交值；它只影响视觉，且用户点击后会被清除
checkbox.indeterminate = true;
formData.get('state'); // null

// ✅ 用 checked + 业务枚举表达三态
checkbox.indeterminate = someRowsSelected;
```

```css
/* ❌ Shadow DOM 内部选不到，静默失效 */
an-checkbox input { accent-color: rebeccapurple; }

/* ✅ 公开 part / 变量 */
an-checkbox::part(control) { border-radius: 4px; }
an-checkbox { --an-checkbox-accent: rebeccapurple; }
```
