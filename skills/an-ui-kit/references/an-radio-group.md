# an-radio-group

> 由 `packages/mcp/manifest.json`（仓库根 `custom-elements-manifest.json` 的拷贝）派生，表里的类型原文、事件名、CSS 变量、part 与 CEM 一致。
> 改组件 JSDoc 后重新生成：仓库根 `pnpm cem`，再 `pnpm --filter @an-ui-kit/mcp build`。

`<an-radio-group>`：一组单选选项的**表单关联半边**。它自己渲染 `role="radiogroup"` 容器并直接托管 `<an-radio>` 子项；表单值、`required` 校验、`disabled` 下推、方向键与 roving tabindex 都由它实现。

为什么方向键要自己实现：原生 radio 的分组按**树根**算，而每个 `<an-radio>` 的原生 input 都在各自独立的 Shadow DOM 里，平台不会把它们串成一组。所以 `keydown` 由 group 委托接收，自己移动并选中下一个启用项（`ArrowRight`/`ArrowDown` 下一个、`ArrowLeft`/`ArrowUp` 上一个、循环；`Home`/`End` 首尾）。

`value` 是**手动接管的受控状态**，不在 `static defaults` 里：property 改动**不回写** attribute（所以 markup 不会跟着变），attribute 只作初始 seed / 显式设置入口。

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
| `name` | `string` | `""` | 提交到 `FormData` 的字段名；空字符串表示不提交 |
| `value` | `string` | `""` | 选中的值。attribute 只作初始 seed（以及显式 re-seed）；property 改动**不回写** attribute |
| `label` | `string` | `""` | 可见组标签；非空时同时作为 `radiogroup` 的可访问名称 |
| `disabled` | `boolean` | `false` | 禁用整个组：下推给每个选项，清空表单条目与校验状态 |
| `required` | `boolean` | `false` | 参与约束校验：没有有效选中值时 `valueMissing` |

补充（源码行为，不在上面这张表里）：

- 没有 `value` attribute 时，子项里带 `checked` 的那个 `<an-radio>` 会作为初始值 seed；两者冲突时 `value` 优先。
- `value` 指向一个不存在的选项时不构成选中：不进 `FormData`，`required` 下仍算空。
- 布尔 attribute 只认「存在/不存在」。

## 事件

| 名称 | detail | 触发条件 |
| --- | --- | --- |
| `an-radio-change` | `CustomEvent<{ value: string, originalEvent: Event }>` | 用户点击或方向键导致选中值变化；`disabled` 时不派发 |

- 事件 `bubbles: true`、`composed: true`：跨 Shadow DOM 边界冒泡，监听时 `event.target` 是 `<an-radio-group>` 本身。
- 只在值**真的变化**时派发；重复点同一个选项不派发。
- 子项 `<an-radio>` 的 `an-radio-select` 是内部协议，业务代码不要监听。
- 原生：`group.addEventListener('an-radio-change', (event) => event.detail.value)`。
- Vue：`@an-radio-change="handler"`。React 19：`onan-radio-change={handler}`。

## CSS 自定义属性

| 名称 | 说明 |
| --- | --- |
| `--an-radio-group-gap` | 选项之间的间距；默认 `--an-space-3`（0.75rem） |

## CSS Parts

| part | 说明 |
| --- | --- |
| `base` | 包住 label 与选项的外层容器 |
| `label` | 可见组标签；`label` 非空时才渲染 |
| `group` | `role="radiogroup"` 的容器，直接持有选项 slot |

## 主题

- 显式：`<html data-theme="dark">`（或祖先元素），也可以在 `<an-radio-group data-theme="dark">` 上局部设置；组件会同步 `color-scheme`。
- 系统：`prefers-color-scheme` 自动跟随；显式 `data-theme="light"` 能击败系统暗色。
- 颜色只来自 `--an-color-*` token，组件 CSS 内的 fallback 只用于没加载 tokens 的场景。

## 示例

### 原生 HTML

```html
<form id="signup">
  <an-field label="套餐" hint="可随时变更">
    <an-radio-group name="plan" value="pro" required>
      <an-radio value="free">免费版</an-radio>
      <an-radio value="pro">专业版</an-radio>
      <an-radio value="team">团队版</an-radio>
    </an-radio-group>
  </an-field>
  <an-button type="submit" variant="primary">继续</an-button>
</form>

<script type="module">
  import '@an-ui-kit/elements';

  const form = document.querySelector('#signup');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    console.log(new FormData(form).get('plan')); // "pro"
  });
</script>
```

### React 19

```tsx
import '@an-ui-kit/elements';
import '@an-ui-kit/tokens/tokens.css';
import type {} from '@an-ui-kit/elements/react';

import { useState } from 'react';

export function PlanPicker() {
  const [plan, setPlan] = useState('pro');

  return (
    <>
      {/* value 只做初始 seed：选中状态之后由 group 自己维护 */}
      <an-radio-group
        name="plan"
        label="套餐"
        value="pro"
        required
        onan-radio-change={(event) => setPlan(event.detail.value)}
      >
        <an-radio value="free">免费版</an-radio>
        <an-radio value="pro">专业版</an-radio>
        <an-radio value="team">团队版</an-radio>
      </an-radio-group>
      <p>已选：{plan}</p>
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

const plan = ref('pro');

function onChange(event: CustomEvent<{ value: string }>) {
  plan.value = event.detail.value;
}
</script>

<template>
  <an-radio-group name="plan" label="套餐" value="pro" required @an-radio-change="onChange">
    <an-radio value="free">免费版</an-radio>
    <an-radio value="pro">专业版</an-radio>
    <an-radio value="team">团队版</an-radio>
  </an-radio-group>
  <p>已选：{{ plan }}</p>
</template>
```

### 表单语义

`<an-radio-group>` 是 form-associated 自定义元素（`static formAssociated = true` + `ElementInternals`）；组内的 `<an-radio>` **不参与表单**，只负责渲染与上报点击。

- 选中值有效：`setFormValue(value)` —— 提交 `name=value`。
- 没有选中 / `value` 匹配不到任何选项：`setFormValue(null)`，不产生条目。
- `required` + 无有效选中：`setValidity({ valueMissing: true }, …)`，`form.requestSubmit()` 被拦下。
- `disabled`（自身或祖先 `<fieldset disabled>`）：`setFormValue(null)` + `setValidity({})`，并下推给每个选项。
- `form.reset()`：回到挂载时捕获的初始值（`value` attribute，或初始 `checked` 子项的值）。
- 校验消息挂在 group 上，`<an-field>` 通过捕获子控件的 `invalid` 事件显示 `validationMessage`。

## a11y 注意事项

- 容器带 `role="radiogroup"`；`label` 非空时用内部 `aria-labelledby` 命名，否则转发宿主的 `aria-label` / `aria-labelledby`。
- 组内只有一个选项是 Tab 停靠点（roving tabindex）：Tab 进组一次，方向键在组内移动并立即选中；Home/End 跳首尾。
- 无障碍名称优先级：可见 `label` > 宿主 `aria-label` / `aria-labelledby`；两者都别写重复。
- 每个 `<an-radio>` 的默认 slot 文本是选项名称；选项没有可见文本时补 slot 文本（不要把 `aria-label` 放在 `<an-radio>` 上，它不会转发给内部 input）。
- `radiogroup` 容器渲染 `aria-required`；`aria-disabled` / `aria-required` 同时同步到宿主 internals。`aria-label` / `aria-labelledby` 在没有可见 `label` 时转发给容器。

## 反例

```html
<!-- ❌ 找 an-form：没有这个组件，用原生 <form> -->
<an-form>
  <an-radio-group name="plan">...</an-radio-group>
</an-form>

<!-- ❌ 中间包一层 div：group 只认直接子元素 <an-radio> -->
<an-radio-group name="plan">
  <div class="row"><an-radio value="pro">专业版</an-radio></div>
</an-radio-group>

<!-- ❌ 让子项承担表单字段：name 在 radio 上无效 -->
<an-radio-group>
  <an-radio name="plan" value="pro">专业版</an-radio>
</an-radio-group>

<!-- ❌ 自己监听内部协议，绕过 group 的状态同步 -->
<an-radio value="pro" onclick="...">专业版</an-radio>
```

```ts
// ❌ 把 value attribute 当受控状态回写：property 不会回写 attribute，
//    这里读到的还是初始 seed，不是用户当前选择
form.addEventListener('an-radio-change', () => {
  group.setAttribute('value', group.value + ''); // 无意义的自说自话
});

// ✅ 直接读 property 或 FormData
group.addEventListener('an-radio-change', (event) => {
  console.log(group.value, event.detail.value);
});
```

```css
/* ❌ 给每个 radio 加 margin：gap 契约失效 */
an-radio-group an-radio { margin: 0 8px 0 0; }

/* ✅ 用 group 的变量 */
an-radio-group { --an-radio-group-gap: 8px; }
```
