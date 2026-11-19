# an-radio

> 由 `packages/mcp/manifest.json`（仓库根 `custom-elements-manifest.json` 的拷贝）派生，表里的类型原文、事件名、CSS 变量、part 与 CEM 一致。
> 改组件 JSDoc 后重新生成：仓库根 `pnpm cem`，再 `pnpm --filter @an-ui-kit/mcp build`。

`<an-radio>`：单选组里的**一个选项**。内部是 Shadow DOM 里的真原生 `<input type="radio">`，焦点、Space 选中和可访问 checked 状态来自平台；默认 slot 文本渲染在 `<label part="base">` 里。

它不是 form-associated 元素，**不参与表单**：表单值、`required` 校验、`disabled` 下推、方向键和 roving tabindex 全由父级 `<an-radio-group>` 负责。请始终把它作为 `<an-radio-group>` 的直接子元素使用，不要单独放进 `<form>` 期待它提交值。

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
| `value` | `string` | `""` | 选项的提交值；由 group 读取，选中后写进 group 的 `FormData` 条目 |
| `checked` | `boolean` | 未选中 | 选中状态；由 group 驱动，用户选择后 group 会把其他选项置为未选中 |
| `disabled` | `boolean` | `false` | 禁用该选项并阻止选择；group 的 `disabled` 也会下推到每个选项 |

布尔 attribute 只认「存在/不存在」：`checked` 与 `checked="false"` 都是选中。

默认 slot 是可见标签文本（CEM 已声明 `slot: ""`）；也没有 `name` attribute —— 字段名属于 `<an-radio-group>`。

## 事件

| 名称 | detail | 触发条件 |
| --- | --- | --- |
| `an-radio-select` | `CustomEvent<{ value: string, originalEvent: Event }>` | 该选项变为选中时；已经选中的选项再点不派发 |
| `an-radio-connect` | `CustomEvent<{ value: string }>` | 元素连接（升级）时派发；group 用它补做注册同步 |

- 这两个事件是 `<an-radio-group>` 的内部协议：`an-radio-select` 让 group 更新选中值并派发 `an-radio-change`，`an-radio-connect` 让晚升级的选项补注册。
- 业务代码监听 **`an-radio-change`（在 group 上）**，不要监听 `an-radio-select`。
- 事件 `bubbles: true`、`composed: true`；`disabled` 时不派发。

## CSS 自定义属性

| 名称 | 说明 |
| --- | --- |
| `--an-radio-size` | 画出来的控件边长；默认 `--an-space-4`（1rem） |
| `--an-radio-accent` | 选中态填充与边框颜色；默认 `--an-color-accent-9` |
| `--an-radio-border-color` | 未选中边框颜色；默认 `--an-color-border-1` |

间距用 group 的 `--an-radio-group-gap`，不要给每个 radio 写 margin。

## CSS Parts

| part | 说明 |
| --- | --- |
| `base` | 外层 `<label>` 包裹 |
| `control` | 画出来的单选圆点（原生 input 的装饰性兄弟节点） |
| `label` | 默认 slot 的包裹层 |

## 主题

- 显式：`<html data-theme="dark">`（或祖先元素），也可以在 `<an-radio data-theme="dark">` 上局部设置；组件会同步 `color-scheme`。
- 系统：`prefers-color-scheme` 自动跟随；显式 `data-theme="light"` 能击败系统暗色。
- 颜色只来自 `--an-color-*` token，组件 CSS 内的 fallback 只用于没加载 tokens 的场景。

## 示例

### 原生 HTML

```html
<an-radio-group name="plan" label="套餐" required>
  <an-radio value="free">免费版</an-radio>
  <an-radio value="pro" checked>专业版</an-radio>
  <an-radio value="team" disabled>团队版（暂不可选）</an-radio>
</an-radio-group>

<script type="module">
  import '@an-ui-kit/elements';

  const group = document.querySelector('an-radio-group');
  group.addEventListener('an-radio-change', (event) => {
    console.log(event.detail.value); // "free" | "pro" | ...
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
      {/* value 只作 group 的初始选中；之后由 group 自己维护 */}
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
  <an-radio-group name="plan" label="套餐" required @an-radio-change="onChange">
    <an-radio value="free">免费版</an-radio>
    <an-radio value="pro" :checked="plan === 'pro'">专业版</an-radio>
    <an-radio value="team" :checked="plan === 'team'">团队版</an-radio>
  </an-radio-group>
</template>
```

### 表单语义

`<an-radio>` **不是** form-associated 元素：它没有 `ElementInternals`、不进 `FormData`、不参与约束校验。

- 表单条目由父级 `<an-radio-group>` 用 `setFormValue(...)` 登记，字段名取 group 的 `name`。
- group 统一管理选中状态：它会把自己的 `value` 推给子项（置 `checked`），用户选择时反向接收 `an-radio-select`。
- `form.reset()`、`disabled`、`required`、`<fieldset disabled>` 都作用在 group 上；radio 只接收 group 下推的 `checked` / `disabled` / `tabbable`。
- 没被 group 管理的独立 `<an-radio>` 只会显示为选中，不会提交任何值。

## a11y 注意事项

- 默认 slot 文本就是可访问名称（包在 `<label>` 里，点文字可选）；**不要**写 `label` attribute，它不存在。
- 键盘语义由 group 负责：Tab 进组一次，方向键在选项间移动并选中，Home/End 跳到首尾。独立 radio 没有这层协调，不要单独用。
- group 给容器加 `role="radiogroup"`，并用 `aria-label` / `aria-labelledby` 命名；radio 自己渲染 `aria-checked` / `aria-disabled`。
- 用 `<an-field>` 包裹 group 时，label/hint/error 由 field 负责；group 自己的 `label` 与 field 的 `label` 不要重复写。
- 禁用项仍留在 DOM 与方向键遍历之外（group 会跳过它）。

## 反例

```html
<!-- ❌ 独立 radio：不参与表单，不会提交值 -->
<form>
  <an-radio name="plan" value="pro" checked>专业版</an-radio>
</form>

<!-- ❌ radio 上没有 name：字段名属于 group -->
<an-radio-group>
  <an-radio name="plan" value="pro">专业版</an-radio>
</an-radio-group>

<!-- ❌ 中间隔了一层容器：group 只认直接子元素 -->
<an-radio-group label="套餐">
  <div><an-radio value="pro">专业版</an-radio></div>
</an-radio-group>

<!-- ❌ 往组件里塞原生 input：part 与 group 协议全丢 -->
<an-radio value="pro"><input type="radio" name="plan" /></an-radio>
```

```ts
// ❌ 在 radio 上监听业务事件
radio.addEventListener('an-radio-select', handler);

// ✅ 在 group 上监听
group.addEventListener('an-radio-change', handler);
```

```css
/* ❌ 用 margin 手动排列选项，破坏 group 的 gap 契约 */
an-radio { margin-right: 8px; }

/* ✅ 调 group 的变量 */
an-radio-group { --an-radio-group-gap: 8px; }
```
