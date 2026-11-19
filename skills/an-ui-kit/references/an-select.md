# an-select

> 由 `packages/mcp/manifest.json`（仓库根 `custom-elements-manifest.json` 的拷贝）派生，表里的类型原文、事件名、CSS 变量、part 与 CEM 一致。
> 改组件 JSDoc 后重新生成：仓库根 `pnpm cem`，再 `pnpm --filter @an-ui-kit/mcp build`。

`<an-select>`：下拉选择。内部是 Shadow DOM 里的**真原生 `<select>`**，选项语义、键盘交互、移动端 picker 与读屏行为都来自平台；作者在 **light DOM** 里写 `<option>` 子元素，组件把它们镜像进 Shadow DOM 的 select（light DOM 的 option 用 `::slotted(option) { display: none }` 隐藏，`slotchange` 与 light DOM 变更都会重新同步）。

宿主是 form-associated 自定义元素：`FormData`、`required` 约束校验、`form.reset()`、`<fieldset disabled>` 全部经 `ElementInternals` 走平台语义。`value` 只作**初始选择**：attribute 不随用户选择回写；没有有效选中时 `setFormValue(null)`。

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
| `value` | `string` | `""` | 初始选择。attribute 只在挂载时 seed，用户选择**不回写** attribute |
| `label` | `string` | `""` | 可见 `<label>` 文本；同时给控件提供可访问名称 |
| `placeholder` | `string` | `""` | 非空时在最前面插入一个 `value=""` 的禁用占位项 |
| `size` | `('sm'\|'md'\|'lg')` | `"md"` | 控件尺寸 |
| `disabled` | `boolean` | `false` | 禁用内部 select；从 `FormData` 移除且不参与校验 |
| `required` | `boolean` | `false` | 参与约束校验：`value === ""` 时 `valueMissing` |
| `invalid` | `boolean` | `false` | 视觉无效态：加 `aria-invalid="true"` 与错误样式；不改变校验结果 |
| `name` | `string` | `""` | `FormData` 字段名；空字符串表示不提交 |

布尔 attribute 只认「存在/不存在」：`required` 与 `required="false"` 都是必填。

补充（源码行为，不在上面这张表里）：

- 没有 `value` attribute 时，按原生规则取「最后一个带 `selected` 的 option」，否则取第一项；有 `placeholder` 时占位项是首项且默认选中（`value=""`），但显式 `selected` 的 option 仍优先。
- `value` 匹配不到任何选项时，内部 select 的原生赋值会落到空值（`value === ""`）——不会自动回落到第一项。
- light DOM 里非 `<option>` 的子元素会被忽略；选项文本取 `option.textContent`，`disabled` 与 `selected` 会一起镜像。

## 事件

| 名称 | detail | 触发条件 |
| --- | --- | --- |
| `an-select-change` | `CustomEvent<{ value: string, originalEvent: Event }>` | 用户选了另一个选项；`disabled` 时不派发 |

- 事件 `bubbles: true`、`composed: true`：跨 Shadow DOM 边界冒泡，监听时 `event.target` 是 `<an-select>` 本身。
- 只在用户交互时派发；代码改 `value` 不发事件。
- 原生：`el.addEventListener('an-select-change', (event) => event.detail.value)`。
- Vue：`@an-select-change="handler"`。React 19：`onan-select-change={handler}`。

## CSS 自定义属性

| 名称 | 说明 |
| --- | --- |
| `--an-select-height` | 控件高度；默认 `2.25rem`（`sm` 2rem、`lg` 2.75rem） |
| `--an-select-bg` | 背景色；默认 `--an-color-bg-1` |
| `--an-select-fg` | 文本与箭头颜色；默认 `--an-color-fg-1` |
| `--an-select-border-color` | 边框色；默认 `--an-color-border-1` |
| `--an-select-radius` | 圆角；默认 `--an-radius-md` |
| `--an-select-font-size` | 字号；默认 `--an-font-size-sm` |
| `--an-select-padding-x` | 水平内边距；默认 `--an-space-3` |
| `--an-select-focus-ring` | 聚焦描边颜色；默认 `--an-color-accent-9` |

## CSS Parts

| part | 说明 |
| --- | --- |
| `base` | 外层容器 |
| `label` | 可见 `<label>`；`label` 非空时才渲染 |
| `select` | 内部的原生 `<select>` 元素 |
| `chevron` | 盖在 select 上的装饰箭头（`aria-hidden`） |

## 主题

- 显式：`<html data-theme="dark">`（或祖先元素），也可以在 `<an-select data-theme="dark">` 上局部设置；组件会同步 `color-scheme`。
- 系统：`prefers-color-scheme` 自动跟随；显式 `data-theme="light"` 能击败系统暗色。
- 颜色只来自 `--an-color-*` token，组件 CSS 内的 fallback 只用于没加载 tokens 的场景。

## 示例

### 原生 HTML

```html
<form id="address">
  <an-select name="city" label="城市" placeholder="请选择城市" required>
    <option value="bj">北京</option>
    <option value="sh">上海</option>
    <option value="gz" disabled>广州（暂不可选）</option>
  </an-select>
  <an-button type="submit" variant="primary">保存</an-button>
</form>

<script type="module">
  import '@an-ui-kit/elements';

  const form = document.querySelector('#address');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    console.log(new FormData(form).get('city')); // "bj" 或 null
  });

  form.addEventListener('an-select-change', (event) => {
    console.log(event.detail.value);
  });
</script>
```

### React 19

```tsx
import '@an-ui-kit/elements';
import '@an-ui-kit/tokens/tokens.css';
import type {} from '@an-ui-kit/elements/react';

import { useState } from 'react';

export function CityPicker() {
  // value 只做初始值：state 只存回显，不要把 value 当受控属性绑回去。
  const [city, setCity] = useState('bj');

  return (
    <>
      <an-select
        name="city"
        label="城市"
        placeholder="请选择城市"
        value="bj"
        required
        onan-select-change={(event) => setCity(event.detail.value)}
      >
        <option value="bj">北京</option>
        <option value="sh">上海</option>
      </an-select>
      <p>已选：{city}</p>
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

const city = ref('bj');

function onChange(event: CustomEvent<{ value: string }>) {
  city.value = event.detail.value;
}
</script>

<template>
  <an-select name="city" label="城市" placeholder="请选择城市" value="bj" required @an-select-change="onChange">
    <option value="bj">北京</option>
    <option value="sh">上海</option>
  </an-select>
  <p>已选：{{ city }}</p>
</template>
```

### 表单语义

`<an-select>` 是 form-associated 自定义元素（`static formAssociated = true` + `ElementInternals`）。内部原生 select 在 Shadow DOM 里，不参与外层 `<form>`，所以提交值由宿主自己登记：

- 选中非空值：`setFormValue(value)` —— 提交 `name=value`。
- 没有有效选中（`value === ""`，例如占位项被选中）：`setFormValue(null)`，不产生条目。
- `required` + `value === ""`：`setValidity({ valueMissing: true }, …)`，`form.requestSubmit()` 被拦下。
- `disabled`（自身或祖先 `<fieldset disabled>`）：`setFormValue(null)` + `setValidity({})`，不进 `FormData`、不参与校验。
- `form.reset()`：回到挂载时的初始选择（`value` attribute，或 markup 里 `selected` / 第一项）。
- `invalid` 只负责视觉，不改变 `validity`；`<an-field>` 捕获 `invalid` 后显示平台 `validationMessage`。
- 运行时增删 light DOM 的 `<option>` 会自动镜像到内部 select，并被 `MutationObserver` 捕获。

## a11y 注意事项

- `label` 非空时用同 Shadow DOM 的 `<label>` 包裹内部 select（隐式关联）；没有可见 label 时，宿主 `aria-label` / `aria-labelledby` 会转发给内部 select。
- 内部是真原生 `<select>`：方向键、Home/End、首字母跳转、移动端 picker 都是平台行为，不要用 `div role="listbox"` 重造。
- `required` / `disabled` / `invalid` 会同步为 `aria-required` / `aria-disabled` / `aria-invalid`。
- 用 `<an-field>` 包裹时，label/hint/error 由 field 负责；select 自己的 `label` 与 field 的 `label` 不要重复写。
- 占位项是 `disabled` + `value=""`：它不会作为有效值提交，但仍会被读屏读成「未选择」的提示。

## 反例

```html
<!-- ❌ 用 div/li 当选项：只有 light DOM 的 <option> 会被镜像 -->
<an-select name="city" label="城市">
  <div role="option" data-value="bj">北京</div>
</an-select>

<!-- ❌ 把 option 塞进组件内部的想象 slot：没有 slot，直接写子元素 -->
<an-select name="city" label="城市">
  <span slot="options"><option value="bj">北京</option></span>
</an-select>

<!-- ❌ 布尔 attribute 不看值："false" 仍然算禁用 -->
<an-select disabled="false">...</an-select>

<!-- ❌ 指望 value attribute 跟着用户选择更新 -->
<an-select value="bj">...</an-select>
<!-- 用户改选上海后 getAttribute('value') 仍是 "bj" -->
```

```ts
// ❌ 监听内部原生 select 的 change：它跨 shadow 边界不可达
select.addEventListener('change', handler);

// ✅ 监听组件自己的事件
selectEl.addEventListener('an-select-change', (event) => console.log(event.detail.value));
```

```css
/* ❌ Shadow DOM 内部选不到，静默失效 */
an-select select { border: 2px solid red; }

/* ✅ 公开 part / 变量 */
an-select::part(select) { border-width: 2px; }
an-select { --an-select-border-color: red; }
```
