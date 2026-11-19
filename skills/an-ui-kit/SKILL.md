---
name: an-ui-kit
description: 用 AN UI Kit（Custom Elements 组件库）构建 UI 时使用。覆盖 React 19 / Vue 3 / 原生，零运行时依赖、Shadow DOM 隔离。
---

# AN UI Kit

## 什么时候用

- 用 `<an-button>` / `<an-input>` 等 AN UI Kit 组件搭界面：原生 HTML、React 19、Vue 3。
- 搭表单（输入 / 数字 / 日期 / 复选 / 单选 / 下拉 / 上传）：表单控件全部 form-associated，`<an-form>` 只是没有原生 `<form>` 时的校验/提交控制器，不是 form owner。
- 需要确认某个组件到底有哪些 attribute / 事件 / slot / CSS 变量 / CSS part。
- 把别的 UI 库（Ant Design、Element Plus、Bootstrap 等）的按钮 / 输入框用法迁移到 `<an-button>` / `<an-input>`。

不适用：React 18 及以下（custom element 的事件 prop 不生效，只能 ref + `addEventListener`）；需要直接查询 Shadow DOM 内部节点的场景（应改用 `::part()`）。

## 先查契约，不要凭记忆

- 配了 AN UI Kit MCP server（`@an-ui-kit/mcp`）：`list_components` → `get_component({ tagName })` → `search_components({ query })`。
- 没配：读 `references/<tagName>.md`。
- attribute 名、事件名、CSS 变量名只能来自契约。契约里没有就是没有，不要写“看起来应该有”的 `color`、`icon`、`loading-text`（`label` 只属于 `an-input` / `an-textarea` / `an-select` / `an-field` 等，`an-button` 没有）。

当前组件（17 个）：

- `an-button`（见 [references/an-button.md](references/an-button.md)）—— 动作元素，真原生 `<button>`；`type="submit|reset"` 直接参与外层表单。
- `an-input`（见 [references/an-input.md](references/an-input.md)）—— 单行输入框，真原生 `<input>` + form-associated。
- `an-textarea`（见 [references/an-textarea.md](references/an-textarea.md)）—— 多行输入框，真原生 `<textarea>`；`value` 只作初始值、`required` 按 trim 判空。
- `an-number`（见 [references/an-number.md](references/an-number.md)）—— 数字输入，内部 `<input type="text" inputmode="decimal" role="spinbutton">`（非原生 `type=number`）；`value` 只作初始文本，读 property 拿 `number | null`。
- `an-select`（见 [references/an-select.md](references/an-select.md)）—— 下拉选择（可多选/搜索/虚拟滚动）；选项写成 light DOM 的 `<an-option>` 或原生 `<option>`。
- `an-option`（见 [references/an-option.md](references/an-option.md)）—— `<an-select>` 的选项；不自带表单值，`value` 缺省取文本。
- `an-option-group`（见 [references/an-option-group.md](references/an-option-group.md)）—— `<an-select>` 的分组容器；`label` 渲染成 `role="group"` 的 `aria-label`（缺省回退到自身文本节点），`disabled` 级联到组内选项。
- `an-checkbox`（见 [references/an-checkbox.md](references/an-checkbox.md)）—— 布尔勾选框，真原生 `<input type="checkbox">`；标签文本走默认 slot。
- `an-checkbox-group`（见 [references/an-checkbox-group.md](references/an-checkbox-group.md)）—— 复选组的表单半边；`value` property 是 `string[]`，attribute 逗号分隔。
- `an-radio`（见 [references/an-radio.md](references/an-radio.md)）—— 单选组里的一个选项；不参与表单，由 group 托管。
- `an-radio-group`（见 [references/an-radio-group.md](references/an-radio-group.md)）—— 单选组的表单半边；管值、校验、disabled 下推与方向键。
- `an-switch`（见 [references/an-switch.md](references/an-switch.md)）—— 开关，原生 checkbox + `role="switch"`；标签文本走默认 slot。
- `an-date`（见 [references/an-date.md](references/an-date.md)）—— 单日期选择，form-associated，值 `YYYY-MM-DD`；本地日期字段，无 UTC 换算。
- `an-date-range`（见 [references/an-date-range.md](references/an-date-range.md)）—— 日期范围，提交 `name` / `end-name` 两个字段。
- `an-upload`（见 [references/an-upload.md](references/an-upload.md)）—— 文件选择 / 拖放 + 上传队列，form-associated；`accept` / `max-size` 只是 UX 校验。
- `an-field`（见 [references/an-field.md](references/an-field.md)）—— label/hint/error 布局外壳；不参与表单值，自动显示内部控件的平台校验消息。
- `an-form`（见 [references/an-form.md](references/an-form.md)）—— 校验 / 提交控制器，**不是 form owner**；聚合后代控件，`submit()` 只校验 + 派发事件。

## an-input 用法要点

- **`value` 只作初始值**：attribute 只在挂载时读一次，键入不回写 attribute。不要在 React/Vue 里把 `value` 当受控属性绑回去（每次键入重设 value 会打断 IME、丢光标）；用事件把值存到自己的 state 做回显即可。
- **两个事件**：`an-input`（每次原生 input，`detail = { value, originalEvent }`）和 `an-change`（原生 change，失焦/回车后）。React prop 是 `onan-input` / `onan-change`，Vue 是 `@an-input` / `@an-change`。
- **`required` 参与外层 form 约束校验**：组件通过 `ElementInternals.setValidity({ valueMissing })` 登记，`form.requestSubmit()` 在空值时被拦（`submit` 不触发、`invalid` 触发）；不要在外面自己写一遍必填校验。
- **`disabled` 是完整禁用**：自身 `disabled` 或祖先 `<fieldset disabled>` 时，内部 input 禁用、不派发事件、**不进 `FormData`、不参与约束校验**（`readonly` 不派发事件但值仍会提交）。
- **必须有可访问名**：写 `label`，或（不给可见 label 时）写 `aria-label` / `aria-labelledby`。组件不会替你造名。
- 不要往 `<an-input>` 里塞原生 `<input>`；要改内部样式用 `an-input::part(input)`。

## 表单组合规范

**有原生 `<form>` 就优先用原生 `<form>`。** 表单控件（`an-input` / `an-number` / `an-checkbox` / `an-checkbox-group` / `an-switch` / `an-radio-group` / `an-textarea` / `an-select` / `an-date` / `an-date-range` / `an-upload` / `an-button`）都是 form-associated 自定义元素，直接放进原生 `<form>` 就具备提交、`FormData`、`requestSubmit()`、`reset()` 与约束校验（`an-option` / `an-radio` / `an-field` 是结构件，不参与表单值）。

`<an-form>` 确实存在，但它是**校验 / 提交控制器，不是 form owner**：没有 Shadow DOM（`display: contents`），通过 `checkValidity()` / `reportValidity()` / `reset()` / `getFormData()` 聚合后代控件；`submit()` 只做「校验 → 派发 `an-form-submit`」，**不调用** `form.requestSubmit()`、不发请求，也不级联 `disabled`。只在没有原生 `<form>`、又需要统一校验/一次拿 `FormData` 时用它（只扫描自己的 light DOM 后代）。

```html
<form id="profile">
  <an-field label="邮箱" hint="用于登录链接">
    <an-input name="email" type="email" required></an-input>
  </an-field>
  <an-field label="城市">
    <an-select name="city" placeholder="请选择城市" required>
      <an-option value="bj">北京</an-option>
      <an-option value="sh">上海</an-option>
    </an-select>
  </an-field>
  <an-field label="套餐">
    <an-radio-group name="plan" required>
      <an-radio value="free">免费版</an-radio>
      <an-radio value="pro">专业版</an-radio>
    </an-radio-group>
  </an-field>
  <an-button type="submit" variant="primary">保存</an-button>
</form>
```

- **`<an-field>` 是布局+错误展示外壳，不参与表单值**：没有 `name` / `value`，不进 `FormData`。它只包**一个**控件，负责 label/hint/error 版式，并捕获控件的 `invalid` 事件显示平台 `validationMessage`（`error` attribute 可强制覆盖）。
- **`required` 由各控件自己的 `setValidity` 参与原生约束校验**：`an-input` / `an-textarea` / `an-select` / `an-radio-group` / `an-checkbox` / `an-checkbox-group` / `an-switch` / `an-number` / `an-date` / `an-date-range` / `an-upload` 都实现 `valueMissing`。`<an-field required>` 只是表现层（星号 + `aria-required`），不改变校验结果 —— 真正拦截提交的是控件上的 `required`；不要在 `submit` 处理器里再写一遍必填拦截。
- **`value` 只作初始值/初始选中**（`an-input` / `an-textarea` / `an-number` / `an-select` / `an-radio-group` / `an-date` / `an-date-range`）：用户改动**不回写** attribute，别把 attribute 当受控状态回写。`an-checkbox` / `an-switch` 的 `checked` 是公开状态，用户点击会回写 attribute（attribute 与 property 始终一致）。
- **多值组件用 property 读写**：`an-select` 的 `.values` 与 `an-checkbox-group` 的 `.value` 是 `string[]`，attribute 是逗号分隔字符串；元素值本身含逗号时 attribute 无法往返，必须只走 property。`an-checkbox-group` 每个选中值单独提交一条 `name` 记录。
- **`an-radio-group` 持有表单值**，子项 `<an-radio>` 不参与表单；`an-select` 的选项写成 light DOM 的 `<an-option>` 或原生 `<option>`；`an-textarea` 的 `required` 按 trim 后为空判定。
- **`disabled` vs `readonly`**：`disabled`（含祖先 `<fieldset disabled>`）不进 `FormData`、不参与约束校验、不派发事件；`readonly` 只在 `an-input` / `an-textarea` / `an-number` / `an-date` 上存在 —— 值仍提交，但免除约束校验、不改值、不派发事件（`an-number` 同时禁止步进）。`an-select` / `an-checkbox` / `an-checkbox-group` / `an-switch` / `an-radio*` / `an-date-range` / `an-upload` 没有 `readonly`。
- **日期只用本地日期字段**：`YYYY-MM-DD` 值按 `new Date(y, m-1, d)` 处理，禁止 `toISOString()`、`Date.parse('YYYY-MM-DD')` 或任何 UTC 换算（会差一天）。
- 提交用 `<an-button type="submit">`（`type` 默认是 `button`，不写不会提交）；`an-button-click` 里不要重复调 `requestSubmit()`；用 `<an-form>` 时同理，不要既调 `an-form.submit()` 又调 `form.requestSubmit()`。

## 安装与注册

```js
import '@an-ui-kit/elements';            // 注册所有组件（根入口）
import '@an-ui-kit/tokens/tokens.css';   // 主题/配色需要；不加载时组件用内置 fallback 色
```

组件必须在浏览器环境注册后才生效；模板里先出现标签、入口后 import 也可以（升级后会接管）。

## 硬规则（违反即错）

1. **标签名必须带连字符且全小写**：`<an-button>`。
   判错：出现 `<anbutton>`、`<AnButton>`（作为 HTML 标签）、`<x_button>` —— 都不会注册，无样式、无事件。

2. **React 19 的事件 prop 是 `on` + 事件名原样**：`an-button-click` → `onan-button-click`。
   判错：写 `onAnButtonClick`（监听的是 `AnButtonClick`，永不触发）或 `onClick`（收的是 host 上的原生 click，不是组件事件）。
   TypeScript 需要先 `import type {} from '@an-ui-kit/elements/react';`，否则 JSX 不认标签和事件类型。

3. **事件名大小写敏感、保持全小写连字符**：原生 `addEventListener('an-button-click', …)`、Vue `@an-button-click`、React `onan-button-click`。
   判错：出现 `anButtonClick`、`anbuttonclick`、`an-button:click` —— 都收不到事件。

4. **只使用契约里存在的组件 attribute，且值必须在联合类型内**：`an-button` 当前只有 `variant="default|primary|danger|ghost"`、`size="sm|md|lg"`、`disabled`、`loading`、`type="button|submit|reset"`。
   判错：写出 `color`、`label`、`icon`、`loading-text`、`class="btn-primary"`、`variant="secondary"` 等契约外用法。
   （`class`、`id`、`style`、`data-*`、`aria-*`、`slot` 是标准全局 attribute，不在此限。）

5. **布尔 attribute 用“存在 / 不存在”表达**：HTML 写 `<an-button disabled>`、`<an-button loading>`。
   判错：写 `disabled="false"` / `loading="false"` —— 字符串仍然表示属性存在，按钮真的被禁用。JSX 用 `disabled={busy}`，Vue 用 `:disabled="busy"`。

6. **样式只走公开面：组件 CSS 变量、`::part()`、token 变量**：可用 `--an-button-height`、`--an-button-radius`、`--an-button-font-size`，内部按钮用 `an-button::part(base)`。
   判错：写 `an-button button { … }`、`an-button .base { … }`、`::v-deep(an-button button)` —— 选不到 Shadow DOM 内部，静默失效。

7. **主题用 `data-theme` + token，不自造主题 attribute**：在 `html`/祖先（或组件自身）设 `data-theme="dark|light"`；颜色只消费 `--an-color-*`。
   判错：写 `<an-button theme="dark">` 或颜色字面量覆盖内部类。

8. **不要给 `<an-button>` 再包 `<button>`**：它内部已经是真 `<button part="base">`。
   判错：`<an-button><button>保存</button></an-button>` —— 嵌套按钮（a11y 错误）且 label 结构错。直接 `<an-button>保存</an-button>`。

9. **用前必须注册，Vue 必须声明自定义元素**：入口执行 `import '@an-ui-kit/elements'`；Vue 3 配 `isCustomElement: (tag) => tag.startsWith('an-')`（运行时模板用 `app.config.compilerOptions.isCustomElement`）。
   判错：模板用了 `<an-button>` 但入口没有 import；Vue 未配 `isCustomElement`（会报 “Failed to resolve component: an-button”）。

10. **`type="submit"` 会提交外层表单（form-associated）**：`<an-button>` 是 form-associated 自定义元素，`type="submit"` 点击时通过外层 `form.requestSubmit()` 提交（保留约束校验），`type="reset"` 调 `form.reset()`。表单里直接写 `<an-button type="submit">提交</an-button>` 即可。
    判错：在 `an-button-click` handler 里再手动 `form.requestSubmit()` —— 按钮已经提交过，会重复提交。

11. **`<an-input>` 的 `value` 不是受控属性**：只作初始值，键入不回写 attribute。
    判错：在 `an-input` handler 里 `el.value = …` 回写；React 里把 `value={state}` 每次 render 重设（打断 IME、光标跳）。
    正解：`value` 给初始值，读 `an-input` 的 `detail.value` 存进自己的 state 做回显。

12. **`<an-input>` 用契约事件，不用原生事件**：`an-input` / `an-change`（React `onan-input` / `onan-change`）。
    判错：监听原生 `change`（非 composed，出不了 Shadow DOM）、写 `onInput` / `onChange` 自定义属性、用 `an-input` 当 attribute 名。
    正解：`el.addEventListener('an-input', (event) => event.detail.value)`、`@an-input`、`onan-input`。

13. **`<an-input>` 必须有可访问名**：`label` 或 `aria-label` / `aria-labelledby`。
    判错：`<an-input placeholder="请输入">` —— 无名控件，屏幕阅读器读不出这是什么。
    正解：`<an-input label="邮箱" placeholder="you@example.com">` 或 `<an-input aria-label="搜索">`。

## 反例 → 正例

| 反例（错） | 正例（对） |
| --- | --- |
| `<an-button onclick={save}>` | `<an-button onan-button-click={save}>` |
| `<an-button onAnButtonClick={save}>` | `<an-button onan-button-click={save}>` |
| `<an-button class="btn-primary">` | `<an-button variant="primary">` |
| `<an-button variant="secondary">` | `<an-button variant="default">` |
| `<an-button loading="false">` | `<an-button>` |
| `<an-button disabled="false">` | `<an-button disabled>` |
| `<an-button><button>保存</button></an-button>` | `<an-button>保存</an-button>` |
| `an-button button { … }` | `an-button::part(base) { … }` |
| `<an-button theme="dark">` | `<html data-theme="dark">`（或祖先带 `data-theme="dark"`） |
| `<an-input onInput={save} onchange={save}>` | `<an-input onan-input={save}>` / `<an-input @an-input="save">` |
| `<an-input value={state}>`（每次 render 重设） | `<an-input value="初始值" onan-input={…}>`（state 只做回显） |
| `<an-input placeholder="请输入">` | `<an-input label="邮箱" placeholder="请输入">` |
| `an-input input { … }` | `an-input::part(input) { … }` |
| `<an-form>` 当 form owner（指望它 `requestSubmit()` / 发请求） | 原生 `<form>` 负责提交；`<an-form>` 只做没有原生 form 时的校验/聚合 |
| 解析 `an-checkbox-group` 的 `value` attribute 字符串当数组 | 读 `.value`（`string[]`）；元素值含逗号时只走 property |
| `<an-select>` 多选读 `value` 再 `split(',')` | 读 `.values`（`string[]`） |
| 日期用 `new Date(str).toISOString()` 换算 | 只用本地日期字段 `YYYY-MM-DD`，按 `new Date(y, m-1, d)` 处理 |
| 把 `an-upload` 的 `accept` / `max-size` 当服务端安全校验 | 服务端重新校验 MIME / 大小 / 内容；前端限制只是 UX |
| `<an-field name="email">`（指望它提交值） | `<an-input name="email">`（字段名/值属于控件） |
| 自己在 `submit` 里遍历控件判空 | 控件加 `required`，交给原生约束校验 + `<an-field>` 显示消息 |

## 生成代码后的自查

1. 标签名是 `an-*` 且带连字符？
2. React 事件 prop 是 `on` + 原样事件名（`onan-button-click`）？
3. 用到的每个组件 attribute 都能在 `get_component` / `references/` 里找到？
4. 布尔属性没有写成 `="false"`？
5. 样式只用了 CSS 变量 / `::part()` / token，没有选 Shadow DOM 内部？
6. 没有在 `<an-button>` 里再放 `<button>`？`<an-input>` 里没有塞原生 `<input>`？
7. 表单没有多余的手动接线（`type="submit"` 已经提交，别在 `an-button-click` 里再调 `requestSubmit()`；`required` 已经经 `setValidity` 参与校验，别自己再拦一遍）？
8. `<an-input>` 的 `value` 只给初始值，没有当受控属性回写？
9. 每个 `<an-input>` 都有 `label` 或 `aria-label` / `aria-labelledby`？
10. 表单没有把 `<an-form>` 当 form owner，也没有在 `submit` 处理器里重写一遍必填拦截？
11. 多值组件读的是 `.values` / `.value` 数组，而不是 `split(',')` 解析 attribute？
12. 日期只用 `YYYY-MM-DD` 本地日期字段，没有 `toISOString()` / UTC 换算？
13. 上传的 `accept` / `max-size` 只当 UX 校验，服务端有复验？
