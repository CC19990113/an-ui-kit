# an-field

> 由 `packages/mcp/manifest.json`（仓库根 `custom-elements-manifest.json` 的拷贝）派生，表里的类型原文、事件名、CSS 变量、part 与 CEM 一致。
> 改组件 JSDoc 后重新生成：仓库根 `pnpm cem`，再 `pnpm --filter @an-ui-kit/mcp build`。

`<an-field>`：一个表单控件的**布局与错误展示**外壳。它渲染 `label` / 必填星号 / `hint` / `error` 的固定版式，并把默认 slot 里的**直接子控件**用 `aria-labelledby` / `aria-describedby` / `aria-invalid` 关联起来。

它**不参与表单值**：没有 `formAssociated`、没有 `name` / `value`、不进 `FormData`、不做约束校验。它真正的价值是两件事：

1. 版式：label + 控件 + hint + error 的稳定结构与 spacing；
2. 自动错误显示：捕获内部控件（或直接放入的原生控件）的 `invalid` 事件，把该控件的平台 `validationMessage` 渲染成 `role="alert"` 的错误文本；`error` attribute 可以强制覆盖。

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
| `label` | `string` | `""` | 可见 label 文本；`required` 时在后面渲染星号 |
| `hint` | `string` | `""` | 控件下方的辅助说明 |
| `error` | `string` | `""` | 强制错误文本；优先级高于捕获到的平台消息 |
| `required` | `boolean` | `false` | **仅表现层**：渲染星号并给控件写 `aria-required`，不改变控件校验结果 |

布尔 attribute 只认「存在/不存在」。字段名与值属于被包裹的控件，`<an-field>` 没有 `name` / `value` / `invalid`。

## 事件

CEM 里没有声明事件 —— `<an-field>` **不派发自定义事件**。

它只做两件监听（内部实现，不是公开契约）：

- 捕获内部控件的 `invalid`（capture 阶段；`invalid` 不冒泡），读取 `validationMessage` 并显示。
- 监听控件的 `input` / `change` / `an-*-change` 等值变化事件，清除上一次捕获的自动错误。

## CSS 自定义属性

| 名称 | 说明 |
| --- | --- |
| `--an-field-gap` | label、控件、hint、error 之间的间距；默认 `--an-space-2`（0.5rem） |
| `--an-field-label-font-size` | label 字号；默认 `--an-font-size-sm`（0.875rem） |
| `--an-field-hint-color` | hint 颜色；默认 `--an-color-fg-1` 衰减到 62% |
| `--an-field-error-color` | 错误颜色；默认 `--an-color-danger-9` |

## CSS Parts

| part | 说明 |
| --- | --- |
| `base` | 外层容器 |
| `label` | 可见 `<label>`；`label` 为空时 `hidden` |
| `required` | label 后的 `*`；`required` 时才渲染，`aria-hidden` |
| `control` | 包住默认 slot 的容器；有错误时带 `data-invalid` |
| `hint` | `<p>` 辅助说明；`hint` 为空时 `hidden` |
| `error` | `<p role="alert">` 错误文本；没有错误时 `hidden` |

## 主题

- 显式：`<html data-theme="dark">`（或祖先元素），也可以在 `<an-field data-theme="dark">` 上局部设置；组件会同步 `color-scheme`。
- 系统：`prefers-color-scheme` 自动跟随；显式 `data-theme="light"` 能击败系统暗色。
- 颜色只来自 `--an-color-*` token，组件 CSS 内的 fallback 只用于没加载 tokens 的场景。

## 示例

### 原生 HTML

```html
<form id="profile">
  <an-field label="邮箱" hint="我们只会用它发送登录链接">
    <an-input name="email" type="email" required></an-input>
  </an-field>

  <an-field label="城市" required>
    <an-select name="city" placeholder="请选择城市" required>
      <option value="bj">北京</option>
      <option value="sh">上海</option>
    </an-select>
  </an-field>

  <an-button type="submit" variant="primary">保存</an-button>
</form>

<script type="module">
  import '@an-ui-kit/elements';

  const form = document.querySelector('#profile');
  // 原生表单提交时浏览器触发 invalid → an-field 自动显示控件的 validationMessage
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    console.log(Object.fromEntries(new FormData(form)));
  });
</script>
```

### React 19

```tsx
import '@an-ui-kit/elements';
import '@an-ui-kit/tokens/tokens.css';
import type {} from '@an-ui-kit/elements/react';

export function EmailField() {
  return (
    <an-field label="邮箱" hint="我们只会用它发送登录链接">
      <an-input name="email" type="email" required />
    </an-field>
  );
}
```

### Vue 3

```vue
<script setup lang="ts">
import '@an-ui-kit/elements';
import '@an-ui-kit/tokens/tokens.css';
</script>

<template>
  <an-field label="邮箱" hint="我们只会用它发送登录链接">
    <an-input name="email" type="email" required />
  </an-field>
</template>
```

### 表单语义

`<an-field>` **不是** form-associated 元素：它没有 `ElementInternals`、没有表单条目、不参与约束校验。

- 提交什么由内部控件决定；`<an-field>` 不会把 label/hint/error 写进 `FormData`。
- `required` 只是表现层：渲染星号 + 给控件写 `aria-required`。真正拦截提交的是控件的 `required`（各控件通过 `setValidity({ valueMissing })` 参与原生校验）。
- 控件（含直接放入的原生 `<input required>`）在 `form.requestSubmit()` / 提交时触发 `invalid`，`<an-field>` 捕获后显示该控件的 `validationMessage`；控件没有平台消息时回退为「请输入有效值」。
- `error` attribute 优先于捕获到的消息；清掉 `error` 后回到自动消息（若仍无效）或隐藏。
- 控件值一变化（`input` / `change` / `an-*-change`），自动错误会被清除；平台约束仍由控件自己决定。
- `aria-labelledby` / `aria-describedby` 只写给**直接子控件**；`invalid` 捕获接受本 field 拥有的后代控件（嵌套 `<an-field>` 的事件不会泄漏到外层）。

## a11y 注意事项

- `label` 通过 `aria-labelledby` 指向内部 label，同时用 `aria-label` 兜底（跨 Shadow DOM 的 IDREF 不总是被解析）；hint/error 用 `aria-describedby` + `aria-description` 兜底。
- 错误 `<p>` 是 `role="alert"`，出现时会被读屏播报；不要重复在控件上写一份错误文本。
- 有 `error` 时控件的 `aria-invalid="true"` 由 field 写入并在错误清除后移除；控件上的 `aria-required` / `aria-invalid` 归 field 管理，作者自己写的 `aria-label` / `aria-labelledby` / `aria-describedby` / `aria-description` 优先，field 不会覆盖。
- 被包裹的控件若自带 `label` attribute，field 不会再写 aria-label/labelledby —— 此时用控件的 label 命名，field 的 `label` 只剩视觉作用，建议二选一。
- 只支持一个控件语义：一个 `<an-field>` 包一个控件；多个控件共享一个错误会互相覆盖 `aria-invalid`。

## 反例

```html
<!-- ❌ 找 an-form：没有这个组件；field 也不是表单容器 -->
<an-form>
  <an-field label="邮箱"><an-input name="email"></an-input></an-field>
</an-form>

<!-- ❌ 给 field 写 name/value：它不参与表单值 -->
<an-field name="email" value="a@b.c"><an-input></an-input></an-field>

<!-- ❌ 以为 field 的 required 会拦截提交：真正生效的是控件的 required -->
<an-field label="邮箱" required>
  <an-input name="email"></an-input> <!-- 加 required，否则仍可提交 -->
</an-field>

<!-- ❌ 一个 field 包多个控件：label/描述/错误归属不清 -->
<an-field label="联系方式">
  <an-input name="email"></an-input>
  <an-input name="phone"></an-input>
</an-field>
```

```ts
// ❌ 自己监听 invalid 再手写错误文本：field 已经做了
form.addEventListener('invalid', (event) => {
  document.querySelector('#my-error').textContent = event.target.validationMessage;
}, true);

// ✅ 交给 field：控件只需 required，错误文本由平台消息驱动
```

```css
/* ❌ 直接改 Shadow DOM 内部段落 */
an-field p { color: red; }

/* ✅ 公开 part / 变量 */
an-field::part(error) { font-weight: 600; }
an-field { --an-field-error-color: #dc2626; }
```
