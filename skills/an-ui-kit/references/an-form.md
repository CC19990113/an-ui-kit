# an-form

> 由 `packages/mcp/manifest.json`（仓库根 `custom-elements-manifest.json` 的拷贝）派生，表里的类型原文、事件名、CSS 变量、part 与 CEM 一致。
> 改组件 JSDoc 后重新生成：仓库根 `pnpm cem`，再 `pnpm --filter @an-ui-kit/mcp build`。

`<an-form>`：给自定义控件补表单语义的**容器**，**不是 form owner**。它没有 Shadow DOM（宿主 `display: contents` 参与 light DOM 布局），通过控件协议 `checkValidity()` / `reportValidity()` / `reset()` / `getFormData()` 聚合后代控件；`<form>` 的提交/重置仍归原生 `<form>`。

为什么不能拥有 `<form>`：Shadow 内的控件无法与 light DOM 的 `<form>` 建立 form owner 关系，`ElementInternals.form` 只会指向最近的祖先 form。因此 `an-form` 不包装原生 `<form>`、不替代它，也不级联 `disabled`。

## 导入与注册

```js
import '@an-ui-kit/elements';            // 注册全部 16 个组件
import '@an-ui-kit/tokens/tokens.css';   // 主题/配色（颜色全部来自 --an-color-*）
```

`@an-ui-kit/elements` 注册全部组件（根入口）。React 还要 `import type {} from '@an-ui-kit/elements/react';`；Vue 3 还要配 `isCustomElement`（见 [../SKILL.md](../SKILL.md) 规则 9）。

## Attributes

| 名称 | 类型（CEM 原文） | 默认值 | 说明 |
| --- | --- | --- | --- |
| `novalidate` | `boolean` | `false` | `submit()` 跳过校验，直接派发成功事件 |
| `loading` | `boolean` | `false` | 仅作为「提交中」状态钩子；组件本身不改变行为，也不动按钮 |

补充：

- `loading` **不**禁用按钮、**不**阻止重复提交：需要防重时自己读 `loading` 或禁用提交按钮。
- `an-form` 没有 `disabled`：禁用控件用控件自身 `disabled`，禁用整组用祖先 `<fieldset disabled>`。
- 布尔 attribute 只认「存在/不存在」。

## 事件

| 名称 | detail | 触发条件 |
| --- | --- | --- |
| `an-form-submit` | `CustomEvent<{ formData: FormData, values: Record<string, string \| string[]> }>` | `submit()` 校验通过后 |
| `an-form-invalid` | `CustomEvent<{ fields: Array<{ name: string, message: string, element: Element }> }>` | `submit()` 发现非法控件时（`novalidate` 时不派发） |
| `an-form-reset` | `CustomEvent`（无 detail） | `reset()` 执行后 |

- `bubbles: true`、`composed: true`。
- `an-form-submit` 不提交网络请求、不调用 `form.requestSubmit()`；拿到 `detail.formData` 后自己发。
- `an-form-invalid` 会先对每个非法控件调用 `reportValidity?.()`，再把焦点移到第一个非法控件。
- `values` 把同名的多条记录合并成数组（单条为字符串），方便直接读取；要原始顺序用 `formData.getAll()`。

## 方法

| 名称 | 说明 |
| --- | --- |
| `validate()` | 只校验，返回 `{ valid: boolean, fields: AnFormFieldError[] }`；不改焦点、不派发事件 |
| `submit()` | 校验 → 通过则派发 `an-form-submit` 并返回 `true`；失败则 `reportValidity()`、派发 `an-form-invalid`、聚焦首个错误并返回 `false` |
| `reset()` | 对每个控件调用 `reset?.()`，然后派发 `an-form-reset` |
| `getFormData()` | 按 DOM 顺序聚合每个控件的 `getFormData()`，返回 `FormData` |

补充：

- **控件识别**：后代元素只要暴露 `checkValidity()` 且满足「有 `name`」或「`formAssociated === true`」就算控件；控件内部的子元素（`an-radio` / `an-checkbox` 等）被跳过，不会重复计入。
- 嵌套 `<an-form>`：内层控件归内层，外层不会重复收集（`element.closest('an-form')` 判定）。
- `an-button type="submit"` / `type="reset"` 的点击会被委托：只有**没有真实 form owner** 的按钮才走 `submit()` / `reset()`（有原生 `<form>` 时保持平台行为）。

## Slots

无。它就是一个 light DOM 容器（`display: contents`），子节点原样留在原位。

## CSS Parts / CSS 变量

无。不要给 `an-form` 写布局样式期待它成为盒子；它不生成盒子。需要布局请在外面包一层 `<div>` 或 `<form>`。

## 用法与注意事项

### 有原生 `<form>` 时不要用它

```html
<!-- ✅ 平台够用：form 负责提交/重置/校验 -->
<form id="profile">
  <an-field label="邮箱"><an-input name="email" required></an-input></an-field>
  <an-button type="submit">保存</an-button>
</form>
```

`FormData`、`requestSubmit()`、`reset()`、`required`、`<fieldset disabled>` 都是平台语义，不需要 `an-form`。

### 没有原生 `<form>`、又需要聚合时用它

```html
<an-form id="settings">
  <an-field label="昵称"><an-input name="nick" required></an-input></an-field>
  <an-field label="主题"><an-select name="theme"><an-option value="light">浅色</an-option></an-select></an-field>
  <an-button type="submit">保存</an-button>
</an-form>

<script>
  const form = document.querySelector('#settings');
  form.addEventListener('an-form-submit', async (event) => {
    await fetch('/api/settings', { method: 'POST', body: event.detail.formData });
  });
  form.addEventListener('an-form-invalid', (event) => {
    console.log(event.detail.fields.map((field) => field.name));
  });
</script>
```

- 用 `<an-form>` 时，提交按钮不要再触发原生 form；`an-button type="submit"` 已被委托到 `form.submit()`。
- `submit()` 返回布尔值，按钮点击处理器里可以用它取消后续动作。
- 要真正发请求，监听 `an-form-submit` 或自己调 `getFormData()`。
- **它只扫描自己 light DOM 里的后代**（`querySelectorAll('*')`），不穿透其他元素的 shadow root；控件必须作为 `an-form` 的 light DOM 后代存在（自定义元素宿主本身在 light DOM 即可，其内部 shadow 不影响）。

### `novalidate` 与 `loading`

```html
<an-form novalidate loading>
  <an-input name="draft"></an-input>
  <an-button type="submit" disabled>保存中…</an-button>
</an-form>
```

- `novalidate` 只影响 `submit()`；`validate()` 仍会校验。
- `loading` 是纯状态，组件不会因为它在提交中而拒绝第二次 `submit()` —— 防重逻辑自己写（禁用按钮 / 检查 `loading`）。

### 校验协议

`an-form` 依赖控件暴露这些方法（`@an-ui-kit/elements` 的控件都实现）：

| 方法 | 用途 |
| --- | --- |
| `checkValidity()` | 返回布尔，不显示 UI |
| `reportValidity()` | 显示平台错误（可选实现） |
| `reset()` | 恢复初始值（可选实现） |
| `getFormData()` | 返回该控件的 `FormData` 片段（可选实现） |

自定义控件要接入 `an-form`，至少实现 `checkValidity()`，并在有 `name` 时实现 `getFormData()`。

### 反例 → 正例

```html
<!-- ❌ 把 an-form 当 <form>：指望它 requestSubmit / 发请求 -->
<an-form action="/save" method="post">
  <an-input name="a"></an-input>
</an-form>

<!-- ✅ an-form 只做聚合，提交自己处理 -->
<an-form>
  <an-input name="a"></an-input>
  <an-button type="submit">保存</an-button>
</an-form>

<!-- ❌ 给 an-form 加 disabled，指望它下推 -->
<an-form disabled>...</an-form>

<!-- ✅ 禁用控件本身，或用 fieldset -->
<fieldset disabled><an-input name="a"></an-input></fieldset>
```
