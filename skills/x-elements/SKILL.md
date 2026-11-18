---
name: x-elements
description: 用 x-elements（Custom Elements 组件库）构建 UI 时使用。覆盖 React 19 / Vue 3 / 原生，零运行时依赖、Shadow DOM 隔离。
---

# x-elements

## 什么时候用

- 用 `<x-button>` 等 x-elements 组件搭界面：原生 HTML、React 19、Vue 3。
- 需要确认某个组件到底有哪些 attribute / 事件 / slot / CSS 变量 / CSS part。
- 把别的 UI 库（Ant Design、Element Plus、Bootstrap 等）的按钮用法迁移到 `<x-button>`。

不适用：React 18 及以下（custom element 的事件 prop 不生效，只能 ref + `addEventListener`）；需要直接查询 Shadow DOM 内部节点的场景（应改用 `::part()`）。

## 先查契约，不要凭记忆

- 配了 x-elements MCP server（`@x/mcp`）：`list_components` → `get_component({ tagName })` → `search_components({ query })`。
- 没配：读 `references/<tagName>.md`。
- attribute 名、事件名、CSS 变量名只能来自契约。契约里没有就是没有，不要写“看起来应该有”的 `color`、`label`、`icon`。

当前组件：`x-button`（见 [references/x-button.md](references/x-button.md)）。

## 安装与注册

```js
import '@x/elements';            // 注册所有组件；只有根入口，没有 @x/elements/button 子路径
import '@x/tokens/tokens.css';   // 主题/配色需要；不加载时组件用内置 fallback 色
```

组件必须在浏览器环境注册后才生效；模板里先出现标签、入口后 import 也可以（升级后会接管）。

## 硬规则（违反即错）

1. **标签名必须带连字符且全小写**：`<x-button>`。
   判错：出现 `<xbutton>`、`<XButton>`（作为 HTML 标签）、`<x_button>` —— 都不会注册，无样式、无事件。

2. **React 19 的事件 prop 是 `on` + 事件名原样**：`x-button-click` → `onx-button-click`。
   判错：写 `onXButtonClick`（监听的是 `XButtonClick`，永不触发）或 `onClick`（收的是 host 上的原生 click，不是组件事件）。
   TypeScript 需要先 `import type {} from '@x/elements/react';`，否则 JSX 不认标签和事件类型。

3. **事件名大小写敏感、保持全小写连字符**：原生 `addEventListener('x-button-click', …)`、Vue `@x-button-click`、React `onx-button-click`。
   判错：出现 `xButtonClick`、`xbuttonclick`、`x-button:click` —— 都收不到事件。

4. **只使用契约里存在的组件 attribute，且值必须在联合类型内**：`x-button` 当前只有 `variant="default|primary|danger|ghost"`、`size="sm|md|lg"`、`disabled`、`loading`、`type="button|submit|reset"`。
   判错：写出 `color`、`label`、`icon`、`loading-text`、`class="btn-primary"`、`variant="secondary"` 等契约外用法。
   （`class`、`id`、`style`、`data-*`、`aria-*`、`slot` 是标准全局 attribute，不在此限。）

5. **布尔 attribute 用“存在 / 不存在”表达**：HTML 写 `<x-button disabled>`、`<x-button loading>`。
   判错：写 `disabled="false"` / `loading="false"` —— 字符串仍然表示属性存在，按钮真的被禁用。JSX 用 `disabled={busy}`，Vue 用 `:disabled="busy"`。

6. **样式只走公开面：组件 CSS 变量、`::part()`、token 变量**：可用 `--x-button-height`、`--x-button-radius`、`--x-button-font-size`，内部按钮用 `x-button::part(base)`。
   判错：写 `x-button button { … }`、`x-button .base { … }`、`::v-deep(x-button button)` —— 选不到 Shadow DOM 内部，静默失效。

7. **主题用 `data-theme` + token，不自造主题 attribute**：在 `html`/祖先（或组件自身）设 `data-theme="dark|light"`；颜色只消费 `--x-color-*`。
   判错：写 `<x-button theme="dark">` 或颜色字面量覆盖内部类。

8. **不要给 `<x-button>` 再包 `<button>`**：它内部已经是真 `<button part="base">`。
   判错：`<x-button><button>保存</button></x-button>` —— 嵌套按钮（a11y 错误）且 label 结构错。直接 `<x-button>保存</x-button>`。

9. **用前必须注册，Vue 必须声明自定义元素**：入口执行 `import '@x/elements'`；Vue 3 配 `isCustomElement: (tag) => tag.startsWith('x-')`（运行时模板用 `app.config.compilerOptions.isCustomElement`）。
   判错：模板用了 `<x-button>` 但入口没有 import；Vue 未配 `isCustomElement`（会报 “Failed to resolve component: x-button”）。

10. **`type="submit"` 不会自动提交外层表单**：内部 button 在 Shadow DOM 里，`button.form === null`。
    判错：依赖 `<x-button type="submit">` 自动触发表单提交。正确做法：监听 `x-button-click`，在 handler 里调用 `form.requestSubmit()`。

## 反例 → 正例

| 反例（错） | 正例（对） |
| --- | --- |
| `<x-button onclick={save}>` | `<x-button onx-button-click={save}>` |
| `<x-button onXButtonClick={save}>` | `<x-button onx-button-click={save}>` |
| `<x-button class="btn-primary">` | `<x-button variant="primary">` |
| `<x-button variant="secondary">` | `<x-button variant="default">` |
| `<x-button loading="false">` | `<x-button>` |
| `<x-button disabled="false">` | `<x-button disabled>` |
| `<x-button><button>保存</button></x-button>` | `<x-button>保存</x-button>` |
| `x-button button { … }` | `x-button::part(base) { … }` |
| `<x-button theme="dark">` | `<html data-theme="dark">`（或祖先带 `data-theme="dark"`） |

## 生成代码后的自查

1. 标签名是 `x-*` 且带连字符？
2. React 事件 prop 是 `on` + 原样事件名（`onx-button-click`）？
3. 用到的每个组件 attribute 都能在 `get_component` / `references/` 里找到？
4. 布尔属性没有写成 `="false"`？
5. 样式只用了 CSS 变量 / `::part()` / token，没有选 Shadow DOM 内部？
6. 没有在 `<x-button>` 里再放 `<button>`？
7. 依赖 `type="submit"` 的地方已经改成手动 `requestSubmit()`？
