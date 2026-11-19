# an-switch

> 由 `packages/mcp/manifest.json`（仓库根 `custom-elements-manifest.json` 的拷贝）派生，表里的类型原文、事件名、CSS 变量、part 与 CEM 一致。
> 改组件 JSDoc 后重新生成：仓库根 `pnpm cem`，再 `pnpm --filter @an-ui-kit/mcp build`。

`<an-switch>`：一个开关控件。内部是 Shadow DOM 里的**真原生 `<input type="checkbox">`**，额外带 `role="switch"`，所以焦点、Space 切换、checked 状态和读屏播报（on/off）都来自平台；默认 slot 的文本在包裹内部 input 的 `<label part="base">` 里，点文字或 track 都能切换，而且保证一次点击只切换一次。

宿主是 form-associated 自定义元素：`FormData`、`required` 约束校验、`form.reset()`、`<fieldset disabled>` 全部经 `ElementInternals` 走平台语义。`checked` 是公开状态（attribute-backed property），用户切换会把 attribute 写回。

## 导入与注册

```js
import '@an-ui-kit/elements';            // 注册全部 17 个组件
import '@an-ui-kit/tokens/tokens.css';   // 主题/配色（颜色全部来自 --an-color-*）
```

`@an-ui-kit/elements` 注册全部组件（根入口）。

React 还要 `import type {} from '@an-ui-kit/elements/react';`；Vue 3 还要配 `isCustomElement`（见 [../SKILL.md](../SKILL.md) 规则 9）。

## Attributes

| 名称 | 类型（CEM 原文） | 默认值 | 说明 |
| --- | --- | --- | --- |
| `checked` | `boolean` | `false` | 开关状态；用户切换会把 attribute 写回，`form.reset()` 回到挂载时的值 |
| `disabled` | `boolean` | `false` | 禁用交互；不进 `FormData`、不参与约束校验（祖先 `<fieldset disabled>` 同样生效） |
| `required` | `boolean` | `false` | off 时 `valueMissing`，`form.requestSubmit()` 会被拦下 |
| `name` | `string` | `""` | `FormData` 里的字段名；空字符串表示不提交 |
| `value` | `string` | `"on"` | **打开时**提交的值 |

布尔 attribute 只认「存在/不存在」：`checked` 与 `checked="false"` 都是打开；要关闭就 `removeAttribute('checked')`。

## 事件

| 名称 | detail | 触发条件 |
| --- | --- | --- |
| `an-switch-change` | `CustomEvent<{ checked: boolean, value: string, originalEvent: Event }>` | 用户交互导致开关状态变化之后；`disabled` 时不派发 |

- 事件 `bubbles: true`、`composed: true`：跨 Shadow DOM 边界冒泡，监听时 `event.target` 是 `<an-switch>` 本身。
- 只由**用户交互**触发；代码里 `el.checked = true` 只更新状态与提交值，不派发事件。
- 原生：`el.addEventListener('an-switch-change', (event) => event.detail.checked)`。
- Vue：`@an-switch-change="handler"`。React 19：`onan-switch-change={handler}`。

## CSS 自定义属性

| 名称 | 说明 |
| --- | --- |
| `--an-switch-width` | 轨道宽度；默认 `2.25rem` |
| `--an-switch-height` | 轨道高度；默认 `1.25rem` |
| `--an-switch-thumb-size` | 滑块直径；默认 `1rem` |
| `--an-switch-accent` | 打开态的轨道颜色；默认 `--an-color-accent-9` |

## CSS Parts

| part | 说明 |
| --- | --- |
| `base` | 外层 `<label>` 包裹 |
| `track` | 滑块后面的轨道 |
| `thumb` | 移动的滑块 |
| `label` | 默认 slot 的包裹层 |

## 主题

- 显式：`<html data-theme="dark">`（或祖先元素），也可以在 `<an-switch data-theme="dark">` 上局部设置；组件会同步 `color-scheme`。
- 系统：`prefers-color-scheme` 自动跟随；显式 `data-theme="light"` 能击败系统暗色。
- 颜色只来自 `--an-color-*` token，组件 CSS 内的 fallback 只用于没加载 tokens 的场景。

## 示例

### 原生 HTML

```html
<form id="settings">
  <an-switch name="wifi" value="on" checked>启用 Wi-Fi</an-switch>
  <an-switch name="airplane" value="on">飞行模式</an-switch>
  <an-button type="submit" variant="primary">保存</an-button>
</form>

<script type="module">
  import '@an-ui-kit/elements';

  const form = document.querySelector('#settings');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    console.log(new FormData(form).get('wifi')); // "on" 或 null
  });

  form.addEventListener('an-switch-change', (event) => {
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

export function WifiToggle() {
  const [on, setOn] = useState(true);

  return (
    <>
      <an-switch
        name="wifi"
        value="on"
        checked={on}
        onan-switch-change={(event) => setOn(event.detail.checked)}
      >
        启用 Wi-Fi
      </an-switch>
      <p>{on ? '已开启' : '已关闭'}</p>
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

const on = ref(true);

function onChange(event: CustomEvent<{ checked: boolean }>) {
  on.value = event.detail.checked;
}
</script>

<template>
  <an-switch
    name="wifi"
    value="on"
    :checked="on"
    @an-switch-change="onChange"
  >
    启用 Wi-Fi
  </an-switch>
</template>
```

### 表单语义

`<an-switch>` 是 form-associated 自定义元素（`static formAssociated = true` + `ElementInternals`）。内部原生 input 在 Shadow DOM 里，不参与外层 `<form>`，所以提交值由宿主自己登记：

- 打开：`setFormValue(value)` —— 提交 `name=value`（默认 `on`）。
- 关闭：`setFormValue(null)` —— 不提交 `"false"`，与原生 checkbox 语义一致。
- `required` + off：`setValidity({ valueMissing: true }, …)`，`form.requestSubmit()` 被拦下。
- `disabled`（自身或祖先 `<fieldset disabled>`）：`setFormValue(null)` + `setValidity({})` —— 不进 `FormData`、不参与校验。
- `form.reset()`：`checked` 回到挂载时的初始值。
- `<an-field>` 会捕获宿主的 `invalid` 事件并显示平台 `validationMessage`；这个组件没有 `invalid` attribute。

## a11y 注意事项

- 内部 input 是 `type="checkbox"` + `role="switch"`，读屏播报 on/off；Space 切换。
- 默认 slot 文本就是可访问名称（包在 `<label>` 里）；**不要**写 `label` attribute，它不存在。
- 没有可见文本时，把文本放进 slot 并做视觉隐藏（`.sr-only` 之类）；宿主上的 `aria-label` **不会**转发给内部 input。
- 开关语义是「立即生效」，表单里放它表示一项即时偏好；需要「保存后才生效」的三态/多态，用 `<an-checkbox>` 或 `<an-radio-group>`。
- 用 `<an-field>` 包裹时，label/hint/error 由 field 负责。

## 反例

```html
<!-- ❌ 没有 label attribute：文本必须走默认 slot -->
<an-switch label="Wi-Fi"></an-switch>

<!-- ❌ 布尔 attribute 不看值："false" 仍然算打开 -->
<an-switch checked="false">Wi-Fi</an-switch>

<!-- ❌ 用 an-switch 表示「未决定」：它只有 on/off，没有 indeterminate -->
<an-switch indeterminate>Wi-Fi</an-switch>

<!-- ❌ 往组件里塞原生 input：track/thumb part 与表单语义全丢 -->
<an-switch><input type="checkbox" />Wi-Fi</an-switch>
```

```ts
// ❌ 关闭时读 detail.value 当提交值：关闭态的 value 不会进 FormData
switchEl.addEventListener('an-switch-change', (event) => {
  formData.set('wifi', String(event.detail.value)); // 关闭时也写入了 "on"
});

// ✅ 用 checked 决定是否写入，或直接读 FormData
switchEl.addEventListener('an-switch-change', (event) => {
  if (event.detail.checked) formData.set('wifi', event.detail.value);
  else formData.delete('wifi');
});
```

```css
/* ❌ Shadow DOM 内部选不到，静默失效 */
an-switch input { display: none; }

/* ✅ 公开 part / 变量 */
an-switch::part(track) { border-radius: 999px; }
an-switch { --an-switch-accent: #10b981; }
```
