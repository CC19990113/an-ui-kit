# an-form

> 由 `packages/mcp/manifest.json`（仓库根 `custom-elements-manifest.json` 的拷贝）派生，表里的类型原文、事件名、CSS 变量、part 与 CEM 一致。
> 改组件 JSDoc 后重新生成：仓库根 `pnpm cem`，再 `pnpm --filter @an-ui-kit/mcp build`。

`<an-form>`：在没有原生 `<form>` 的场景中，聚合控件的校验、重置与数据。宿主为 `display: contents`，通过 `checkValidity()` / `reportValidity()` / `reset()` / `getFormData()` 与自己的 light DOM 后代协作。原生 `<form>` 保留 form owner 职责；`<an-form>` 不触发浏览器原生提交，也不级联 `disabled`。

## 导入与注册

```js
import '@an-ui-kit/elements';            // 注册全部 17 个组件
import '@an-ui-kit/tokens/tokens.css';   // 主题/配色（颜色全部来自 --an-color-*）
```

`@an-ui-kit/elements` 注册全部组件（根入口）。React 还要 `import type {} from '@an-ui-kit/elements/react';`；Vue 3 还要配 `isCustomElement`（见 [../SKILL.md](../SKILL.md) 规则 9）。

## Attributes

| 名称 | 类型（CEM 原文） | 默认值 | 说明 |
| --- | --- | --- | --- |
| `novalidate` | `boolean` | `false` | `submit()` / `submitAsync()` 跳过校验，直接派发成功事件 |
| `loading` | `boolean` | `false` | 仅作为「提交中」状态钩子；组件本身不改变行为，也不动按钮 |
| `show-error-summary` | `boolean` | `false` | 提交校验失败时把错误列表放在宿主首个子节点；点击条目可滚动到对应控件并聚焦 |

补充：

- `loading` **不**禁用按钮、**不**阻止重复提交：需要防重时自己读 `loading` 或禁用提交按钮。
- `an-form` 没有 `disabled`：禁用控件用控件自身 `disabled`，禁用整组用祖先 `<fieldset disabled>`。
- 布尔 attribute 只认「存在/不存在」。

## 事件

| 名称 | detail | 触发条件 |
| --- | --- | --- |
| `an-form-submit` | `CustomEvent<{ formData: FormData, values: Record<string, string \| string[]> }>` | `submit()` / `submitAsync()` 校验通过后 |
| `an-form-invalid` | `CustomEvent<{ fields: Array<{ name: string, message: string, element: Element }> }>` | 提交校验发现非法控件时（`novalidate` 时不派发） |
| `an-form-reset` | `CustomEvent`（无 detail） | `reset()` 执行后 |

- `bubbles: true`、`composed: true`。
- `an-form-submit` 不提交网络请求、不调用 `form.requestSubmit()`；拿到 `detail.formData` 后自己发。
- `an-form-invalid` 派发前会报告错误：平台错误用 `reportValidity?.()`，规则错误通过控件的 `validationMessage` 与 `invalid` 事件交给 `<an-field>`。事件派发后聚焦第一个非法控件。
- `values` 将同名多条记录整理成数组（单条为字符串），文件以文件名表示。用 `formData.getAll(name)` 按提交顺序取同名值，或用 `formData` 获取原始 `File`。

## 方法

| 名称 | 说明 |
| --- | --- |
| `validate()` | 返回 `{ valid: boolean, fields: AnFormFieldError[] }`。检查平台约束和内置规则，不调用 `validator` |
| `validateAsync()` | 返回 `Promise<{ valid: boolean, fields: AnFormFieldError[] }>`，也执行并等待 `validator` |
| `validateField(name)` | 按 `name` 校验并等待 `validator`，返回 `Promise<boolean>`；字段不存在也返回 `true`，不显示错误汇总 |
| `submit()` | 返回 `boolean`。校验平台约束和内置规则，不调用 `validator`；通过派发 `an-form-submit`，不通过则报告错误并派发 `an-form-invalid` |
| `submitAsync()` | 返回 `Promise<boolean>`。也执行并等待 `validator`；成功事件携带实际通过校验的 `FormData` 快照 |
| `reset()` | 对各控件调用 `reset?.()`，清理规则错误与汇总，恢复未修改状态并派发 `an-form-reset` |
| `resetField(name)` | 重置该字段名下的控件，清除对应的规则错误与修改状态 |
| `getFieldValue(name)` | 读取首个匹配控件的字符串值；字段不存在返回 `null`，禁用控件或未勾选项返回空字符串。完整同名多值用 `getFormData().getAll(name)` |
| `getFormData()` | 按 DOM 顺序聚合控件提供的条目，跳过禁用控件和未勾选项 |

`validate()`、`validateAsync()` 和 `validateField(name)` 返回校验结果，由应用决定如何使用。它们不派发 `an-form-submit` 或 `an-form-invalid`，不会生成提交错误汇总；平台 `checkValidity()` 仍可能派发原生 `invalid`。

## Properties

| 名称 | 说明 |
| --- | --- |
| `rules` | `Record<string, AnFormRule \| AnFormRule[]>`，仅 JavaScript property。键为控件 `name`；同字段的规则按数组顺序执行。替换规则会清除先前显示的规则错误 |
| `isDirty` | 是否有至少一个命名字段的值与初始快照不同 |
| `dirtyFields` | 与初始快照不同的字段名列表（同名只列一次）；字段重置后从列表移除 |

规则对象可包含 `required`、`pattern`（`RegExp` 或字符串）、`min` / `max`（数字）、`minLength` / `maxLength`（文本长度），以及可选的内置规则提示 `message`。`validator(value, form)` 接收该字段的单个字符串值和控制器，返回 `null` 表示通过，或返回一条错误文案；也可返回解析为这两种结果的 Promise。显式 `validate()` 与 `submit()` 不调用任何 `validator` 回调，即使该回调同步返回。

## 控件与提交按钮

- **控件识别**：后代元素只要暴露 `checkValidity()` 且满足「有 `name`」或「`formAssociated === true`」就算控件；控件内部的子元素（`an-radio` / `an-checkbox` 等）被跳过，不会重复计入。`<an-button>` 是动作按钮，不贡献字段值。
- 嵌套 `<an-form>`：内层控件归内层，外层不会重复收集（`element.closest('an-form')` 判定）。
- 只有**没有真实 form owner** 的 `<an-button type="submit">` / `<an-button type="reset">` 才由控制器接管点击。有原生 `<form>` 时保留平台行为。提交按钮在任一启用字段有 `validator` 时走 `submitAsync()`，否则走 `submit()`。示例用 `type="button"` 显式调用 `submitAsync()`，便于应用掌握提交时机。
- 异步校验期间若字段变化，会丢弃旧结果，最多用新快照重验一次。新提交、`reset()`、`resetField(name)` 或替换 `rules` 会使在途提交作废。若结果仍过期，`submitAsync()` 返回 `false`，不派发提交或提交失败事件。

## Slots

无。它就是一个 light DOM 容器（`display: contents`），子节点原样留在原位。

## CSS Parts / CSS 变量

`show-error-summary` 的外层和条目分别带 `part="error-summary"`、`part="error-summary-item"`。它们位于 light DOM，使用常规 CSS 选择器；没有可用 `::part()` 穿透的 Shadow DOM，也没有组件级 CSS 变量。需要布局盒子时，在外面包一层 `<div>`。

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
<an-form id="settings" show-error-summary>
  <an-field label="昵称"><an-input name="nick" required></an-input></an-field>
  <an-button id="save-settings" type="button">保存</an-button>
</an-form>

<script type="module">
  import '@an-ui-kit/elements';

  const form = document.querySelector('#settings');
  form.rules = {
    nick: [
      { minLength: 2, message: '昵称至少 2 个字符' },
      {
        async validator(value) {
          const query = new URLSearchParams({ nick: value });
          const response = await fetch(`/api/settings/check-nick?${query}`);
          if (!response.ok) return '暂时无法校验昵称';
          const { available } = await response.json();
          return available ? null : '昵称已被占用';
        },
      },
    ],
  };
  document.querySelector('#save-settings').addEventListener('an-button-click', async () => {
    await form.submitAsync();
  });
  form.addEventListener('an-form-submit', async (event) => {
    await fetch('/api/settings', { method: 'POST', body: event.detail.formData });
  });
</script>
```

- 按钮使用 `type="button"`，提交前显式等待 `submitAsync()`。校验通过才会派发 `an-form-submit`。示例中的请求均由应用发出。
- 可以先用 `await form.validateField('nick')` 仅校验昵称；要撤销该字段的编辑，调用 `form.resetField('nick')`。
- 控件宿主需位于 `<an-form>` 的 light DOM 中，控制器不穿透其他元素的 shadow root。

### `novalidate` 与 `loading`

```html
<an-form novalidate loading>
  <an-input name="draft"></an-input>
  <an-button type="submit" disabled>保存中…</an-button>
</an-form>
```

- `novalidate` 只影响 `submit()` / `submitAsync()`；`validate()` / `validateAsync()` / `validateField(name)` 仍会校验。
- `loading` 是纯状态。应用需要阻止重复点击时，应禁用提交按钮或检查 `loading`。

### 校验协议

`an-form` 依赖控件暴露这些方法（`@an-ui-kit/elements` 的控件都实现）：

| 方法 | 用途 |
| --- | --- |
| `checkValidity()` | 返回布尔；原生约束失败时可能派发 `invalid` |
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
