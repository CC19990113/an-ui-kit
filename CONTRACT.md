# 组件契约（CONTRACT）

x-elements 的每个组件都必须满足以下 **9 条契约**。它们是可被 CI 或评审验证的硬规则，不是风格建议。
新增或修改组件前先读本文件；契约本身要改，先改本文件，再改实现。

适用范围：`packages/elements` 下的全部组件。
前提假设：组件使用 Shadow DOM（`attachShadow({ mode: 'open' })`）——否则 `:host`、part、CSS 变量隔离都无从谈起。

| # | 契约 | 关键约束 | 检查方式 |
|---|------|----------|----------|
| 1 | 标签名 | `x-{component}`，必须带连字符 | 评审 + CEM `tagName` |
| 2 | attribute / property | attribute 全 kebab-case，property camelCase | 评审 + 类型派生 |
| 3 | 事件 | `x-{component}-{action}`，`bubbles: true, composed: true` | 评审 + 测试断言 |
| 4 | CSS 变量 | `--x-{component}-{prop}`，带 fallback，不硬编码颜色 | 评审 + grep 颜色字面量 |
| 5 | CSS parts | 只暴露语义名，最小集合 | 评审 |
| 6 | 主题 | `:host([data-theme="dark"])` 与 `prefers-color-scheme` 双入口 | 评审 + 视觉回归 |
| 7 | CEM | CEM 是唯一真相源，禁止另写规格 | CI：scan 后 diff 为空 |
| 8 | reset | `:host` 显式赋值 box-sizing / border / margin / line-height | 评审 |
| 9 | 零运行时依赖 | `packages/*/dependencies` 必须为空 | CI 断言 |

---

## 1. 标签名：`x-{component}`，必须带连字符

- 统一前缀 `x-`，格式 `x-{component}`；`component` 用小写 kebab-case（如 `x-split-button`）。
- Custom Elements 规范要求自定义元素名**必须包含连字符**，且只能用小写字母、数字和 `-`。
- 一个标签只注册一次：重复 `customElements.define()` 会抛 `NotSupportedError`，入口处必须用 `customElements.get()` 守卫。
- 标签名与源码目录一一对应：`src/button/button.ts` → `x-button`。

**✅ 正确**

```ts
customElements.define('x-button', XButton);
customElements.define('x-split-button', XSplitButton);
```

**❌ 错误**

```ts
customElements.define('xbutton', Xbutton);   // 没有连字符，浏览器直接拒绝注册
customElements.define('xButton', XButton);   // 大写字母不合法
customElements.define('button', Button);     // 污染原生标签命名空间
```

---

## 2. attribute 全 kebab-case，property 全 camelCase

- HTML attribute：全小写 kebab-case（`loading-text`、`max-count`）。
- JS property：camelCase（`loadingText`、`maxCount`）。
- 两者一一对应：attribute 变化通过 `attributeChangedCallback` 同步到 property；property 变化只在需要被 CSS 选择器或 SSR 消费时反射回 attribute。
- attribute 名里不允许出现大写、下划线或驼峰。
- boolean 属性用「存在」表达：`<x-button disabled>`。禁止写 `disabled="false"` 想表达「不禁用」——它在语义上是**开启**。
- property 不要占用原生 DOM 已有语义名（`title`、`hidden`、`id` 等），避免覆盖宿主行为。

**✅ 正确**

```ts
class XButton extends HTMLElement {
  static observedAttributes = ['loading-text'];

  get loadingText(): string | null {
    return this.getAttribute('loading-text');
  }
  set loadingText(value: string | null) {
    if (value == null) this.removeAttribute('loading-text');
    else this.setAttribute('loading-text', value);
  }
}
```

```html
<x-button loading-text="保存中"></x-button>
<x-button disabled></x-button>
```

**❌ 错误**

```ts
class XButton extends HTMLElement {
  static observedAttributes = ['loadingText'];        // attribute 不能是 camelCase
  get loading_text(): string | null { return null; }  // property 不能是 snake_case
}
```

```html
<x-button loadingText="保存中"></x-button>
<!-- HTML 解析会转小写，映射不上 kebab-case 的 attribute 名 -->

<x-button disabled="false"></x-button>
<!-- 实际效果是「禁用」 -->
```

---

## 3. 事件：`x-{component}-{action}`，必须 `bubbles: true, composed: true`

- 事件名全小写 kebab-case，格式 `x-{component}-{action}`；`action` 用动词或过去分词语义（`click`、`change`、`open`、`close`）。
- 对外事件**必须**同时设置 `bubbles: true`（可冒泡到宿主页面）与 `composed: true`（可穿透 Shadow DOM 边界）。缺一个，框架和 `document` 级监听就收不到。
- 禁止对外派发无前缀事件（`click`、`change`），避免和原生事件混淆；原生事件只在组件内部使用。
- `detail` 是普通对象，字段 camelCase；内部原生事件放 `detail.originalEvent`。不要把 `Event` 对象直接当 `detail`（丢失可序列化性与可测性）。
- 需要取消的语义（如 `before-open`）用 `cancelable: true`，并在 JSDoc 里写清取消后的行为。

**✅ 正确**

```ts
this.dispatchEvent(
  new CustomEvent('x-button-click', {
    detail: { originalEvent: event },
    bubbles: true,
    composed: true,
  }),
);
```

**❌ 错误**

```ts
this.dispatchEvent(new CustomEvent('click', { detail: {} }));                 // 无组件前缀，与原生事件冲突
this.dispatchEvent(new CustomEvent('xButtonClick', { bubbles: true }));       // 非 kebab-case
this.dispatchEvent(new CustomEvent('x-button-click', { detail: { event } })); // 缺 bubbles/composed，跨 shadow 即丢失
```

框架监听映射（保持一致，不要另起别名）：

| 框架 | 监听写法 |
|------|----------|
| 原生 | `el.addEventListener('x-button-click', fn)` |
| React 19 | `onx-button-click={fn}`（`on` + **事件名原样**；React 19 对自定义元素执行 `addEventListener(key.slice(2))`，不做 camelCase 转换。`x-button-click` 本身全小写，所以形态恰好是全小写，写成 `onXButtonClick` 监听的是 `XButtonClick`，命中 0 次） |
| Vue 3 | `@x-button-click="fn"` |
| Angular | `(x-button-click)="fn($event)"` |
| jQuery | `.on('x-button-click', fn)` |

> 验证状态：原生 / React 19 / Vue 3 由 `apps/demo` 的 Playwright e2e 覆盖；**Angular 与 jQuery 是 planned，未在本仓库 demo 验证**，表中写法仅供参考。

---

## 4. CSS 变量：`--x-{component}-{prop}`

- 组件所有对外可调的外观参数都用 CSS 自定义属性暴露，命名 `--x-{component}-{prop}`，`prop` 小写 kebab-case。
- 组件内部必须给 fallback：`var(--x-button-height, 2.25rem)`；能和设计 token 链条就链上：`var(--x-button-bg, var(--x-color-accent-9))`。
- 颜色、间距、字号、圆角禁止写死字面量，优先消费 tokens 的变量：颜色 `--x-color-{hue}-{1..12}` 与语义别名（`--x-color-accent-9`、`--x-color-bg-1`、`--x-color-fg-1`）、字号 `--x-font-size-{xs,sm,md,lg,xl,xxl}`、间距 `--x-space-*`、圆角 `--x-radius-*`；组件级变量只是「这个组件的可调参数出口」。
- 变量只影响外观（颜色、尺寸、间距、圆角、动效），不得用来切换结构或语义。
- 不允许缺 `x-` 前缀，防止与宿主页面的同名变量碰撞。

**✅ 正确**

```css
:host {
  --x-button-height: 2.25rem;
  --x-button-bg: var(--x-color-accent-9);
  height: var(--x-button-height);
  background: var(--x-button-bg);
}
```

**❌ 错误**

```css
:host {
  --button-height: 2.25rem;     /* 缺 x- 前缀，必碰撞 */
  --x-button--height: 2.25rem;  /* 双连字符，不规范 */
  background: #3b82f6;          /* 硬编码颜色，绕过 token */
}
```

---

## 5. CSS parts：只暴露语义名

- `part="..."` 的命名必须是**语义**节点：`base`、`icon`、`label`、`prefix`、`suffix`、`spinner`。
- 全小写 kebab-case，不含组件名前缀（part 作用域本就在组件内部），不暴露内部布局包裹层（`wrapper`、`container-inner`、`div-1`）。
- part 一旦发布就是公开 API：集合最小化，只暴露消费者确实需要改样式的节点；新增可以，重命名/删除属于破坏性变更。
- 纯装饰节点不暴露 part；能通过 CSS 变量解决的，优先变量而不是 part。

**✅ 正确**

```html
<button part="base">
  <span part="icon"><slot name="icon"></slot></span>
  <span part="label"><slot></slot></span>
</button>
```

**❌ 错误**

```html
<div part="x-button-wrapper">     <!-- 含组件名前缀，且语义空洞 -->
  <div part="inner-1"></div>      <!-- 结构名，不是语义名 -->
  <div class="shadow-layer"></div> <!-- 想给外部定制却没暴露 part -->
</div>
```

---

## 6. 主题：`:host([data-theme="dark"])` 与 `prefers-color-scheme` 双支持

- 主题必须同时提供两条入口：
  1. **显式**：宿主或祖先带 `data-theme="dark"` → `:host([data-theme="dark"])`；
  2. **系统**：`@media (prefers-color-scheme: dark)`。
- 显式 `data-theme="light"` 必须能击败系统暗色（`:host([data-theme="light"])`，或对媒体查询用 `:not([data-theme])`）。
- 颜色只从 `--x-color-*` 消费，组件 CSS 里不得出现颜色字面量；深色不是「另写一套色值」，而是同一套 token 换值。
- 组件声明 `color-scheme`，让原生控件（滚动条、输入框、焦点环）跟随主题。

**✅ 正确**

```css
/* token 层：两条入口都要有 */
:root {
  --x-color-bg-1: oklch(0.99 0 0);
}
[data-theme='dark'] {
  --x-color-bg-1: oklch(0.18 0 0);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --x-color-bg-1: oklch(0.18 0 0);
  }
}

/* 组件层：只消费 token，并声明 color-scheme */
:host {
  background: var(--x-color-bg-1);
  color-scheme: light dark;
}
:host([data-theme='dark']) {
  color-scheme: dark;
}
```

**❌ 错误**

```css
:host {
  background: #ffffff; /* 颜色字面量：系统暗色时组件仍是一块白 */
}

@media (prefers-color-scheme: dark) {
  :host {
    background: #18181b; /* 只走系统一条路，嵌套暗色子区域无法覆盖 */
  }
}

/* 完全不做 @media 的组件：跟随系统失效；完全不做 [data-theme] 的组件：局部主题失效 */
```

**库级主题入口：`data-theme` 是约定，不是组件 attribute**

`data-theme` 是**库级、宿主侧**的主题开关：设在 `<html>`、任意祖先，或组件自身，由 token 层
（`[data-theme='dark']`）与组件层（`:host([data-theme='dark'])`）共同消费。
它不注册进组件的 `observedAttributes`，也**不出现在 CEM 的 `attributes` 里**——CEM 只描述组件自身声明的
attribute，因此 registry / MCP / skill 都查不到它，这不是遗漏。判断依据：组件的 `static observedAttributes`
与 CEM `declaration.attributes` 均不含 `data-theme`；若某组件真的把主题做成组件属性，那才是违规。

---

## 7. CEM 是唯一真相源

- 组件的属性、事件、slot、CSS 变量、CSS part 全部写在源码 JSDoc 里（`@attr`、`@fires`、`@slot`、`@cssprop`、`@csspart`），由 `x-cem` 扫描生成仓库根的 `custom-elements-manifest.json`（Custom Elements Manifest，CEM）并提交进仓库。
- 框架类型（React JSX、Vue `GlobalComponents`、Angular 模板类型）、文档、AI 元数据、registry 条目**全部从 CEM 派生或校验**。
- 禁止另写一份规格：不维护手写的属性/事件文档当权威，不手改生成的 `.d.ts` 添加 CEM 里没有的东西。
- 源码 JSDoc 是唯一需要手改的注释处；改属性 = 改 JSDoc → 重新 scan → 派生类型/文档。
- CI 必须做同步断言：`x-cem scan` 后 `git diff --exit-code custom-elements-manifest.json`（CEM 落后于源码即失败）。

**✅ 正确**

```ts
/**
 * 主按钮。
 *
 * @attr {string} variant - primary | secondary
 * @fires {CustomEvent<{ originalEvent: MouseEvent }>} x-button-click - 点击
 * @cssprop --x-button-bg - 背景色
 * @csspart base - 根按钮
 */
export class XButton extends HTMLElement { /* ... */ }
```

**❌ 错误**

```md
# Button API（手写，并当成权威规格）

| 属性 | 说明 |
| loadingText | 是否加载中 |
```

上面这份手写表与 CEM 各说各话：CEM 里是 `loading-text`，派生出的类型会和文档对不上。

```ts
// 手改派生类型，加一个 CEM 里不存在、运行时也没有的属性
interface XButtonProps {
  variant: 'primary' | 'secondary';
  ghost: boolean;
}
```

---

## 8. 组件 reset：`:host` 四项显式赋值

每个组件的 `:host` 必须显式赋值这四项：

```css
:host {
  box-sizing: border-box;
  border: 0 solid transparent;
  margin: 0;
  line-height: 1.5;
}
```

原因：Tailwind v4 的 preflight 会重置 `*, ::before, ::after`（`box-sizing: border-box; border: 0 solid; margin: 0`）以及 `html { line-height: 1.5 }`。文档级通配选择器会命中宿主元素，却进不了 Shadow DOM；而 `line-height` 这类可继承属性又会穿进影子树。两头都受页面 reset 影响，组件不显式声明，同一份组件在有无 Tailwind 的页面里尺寸和基线就会不同。

- 这四项是组件自身的 reset，取值固定，不接 token、不参与主题切换。
- 禁止用 `all: unset` / `all: initial` 代替：那会把 `font`、`color` 的继承一起切断，组件无法跟随页面排版。
- 除这四项外不要依赖浏览器默认样式；需要 `padding`、`font`、`color` 时同样显式声明（可消费 token）。

**✅ 正确**

```css
:host {
  box-sizing: border-box;
  border: 0 solid transparent;
  margin: 0;
  line-height: 1.5;

  font: inherit;
  color: var(--x-color-fg-1);
  padding: var(--x-button-padding, 0 1rem);
}
```

**❌ 错误**

```css
:host {
  margin: 0; /* 只写一项：line-height / border 仍随页面漂移 */
}

:host {
  all: initial; /* 切断了 font/color 继承，组件不再跟随页面排版 */
}
```

---

## 9. 硬红线：`packages/*/dependencies` 必须为空

- `packages/*/package.json` 的 `dependencies` 必须缺省或为 `{}`。这是「零运行时依赖」的唯一判定标准。
- 构建期工具放 `devDependencies`（TypeScript、Vitest、Vite 等），不进产物。
- workspace 内的包（如 `tokens`）只能作为 devDependency 或构建期读取；运行时通过 CSS 变量 / 内联产物消费，**不得 import 另一个包的运行时代码**。
- 组件不与 React/Vue/Angular 声明 peerDependency：框架适配层是零运行时的 `.d.ts`，不是代码。
- `peerDependencies` / `optionalDependencies` 默认同样保持为空；确有需要必须走评审。
- CI 断言：遍历 `packages/*/package.json`，`Object.keys(pkg.dependencies ?? {}).length === 0`，否则失败。

**✅ 正确**

```json
{
  "name": "@x/elements",
  "dependencies": {},
  "devDependencies": {
    "vitest": "^5.1.1"
  }
}
```

**❌ 错误**

```json
{
  "dependencies": {
    "lit": "^3.2.0"
  }
}
```

```json
{
  "dependencies": {
    "@x/tokens": "workspace:*"
  }
}
```

运行时并不需要 workspace 包；它应该放 `devDependencies`，CSS 变量通过构建产物注入。

---

## 已知缺口（Known gaps）

### `type="submit"` 不提交外层表单

`<x-button type="submit">` 内部是 Shadow DOM 里的原生 `<button>`，它不是外层 `<form>` 的表单关联元素：
`button.form === null`，点击**不会**触发表单提交（`submit` / `requestSubmit` 都不会发生）。
本库组件目前也没有声明 `static formAssociated = true`、没有通过 `ElementInternals` 做表单关联。

- 影响：从原生 `<button>` 迁到 `<x-button>` 时，提交按钮的既有行为会静默失效。
- 临时方案：监听 `x-button-click`，手动调用外层表单的 `requestSubmit()`。
- 待办：下一阶段在 `XElement` 基类统一支持 `static formAssociated` + `ElementInternals`（含 `setFormValue`），
  组件继承后 `type="submit"` / `type="reset"` 才能真实作用于外层表单。
- 在此之前：文档、JSDoc、skill 与 AI 元数据**不得**声称 `<x-button>` 具备 "form semantics"；
  已修正为「`type="submit"` 不提交外层表单（Shadow DOM 限制）」。

---

## 附录 A：命名速查

| 对象 | 规则 | 示例 |
|------|------|------|
| 标签名 | `x-{component}` | `x-button` |
| attribute | kebab-case | `loading-text` |
| property | camelCase | `loadingText` |
| 事件 | `x-{component}-{action}` | `x-button-click` |
| CSS 变量 | `--x-{component}-{prop}` | `--x-button-bg` |
| CSS part | 语义名 | `base` / `icon` / `label` |
| 设计 token | 颜色 `--x-color-{hue}-{1..12}` + 语义别名；字号 `--x-font-size-{xs,sm,md,lg,xl,xxl}`；间距 `--x-space-*`；圆角 `--x-radius-*` | `--x-color-accent-9` |
| detail 字段 | camelCase | `detail.originalEvent` |

## 附录 B：契约变更流程

1. 先在实现里改 JSDoc（唯一手写规格处），重新生成 CEM。
2. 同步更新本文件对应条目与正反例。
3. 新增契约 = 新条目编号顺延；修改/删除契约属于对外破坏性变更，必须由主对话确认后合入。
4. CI 必须同时通过：CEM 同步断言、`dependencies` 为空断言、a11y 断言。

## 附录 C：构建顺序

`packages/tokens` 的 `exports` 指向构建产物（`./dist/tokens.ts`、`./dist/tokens.css`），而 `dist/` 不进版本库。因此：

1. **packages/tokens 必须先 build**：`pnpm --filter @x/tokens build`；
2. 其它包才能 `import '@x/tokens'` 或引用 `@x/tokens/tokens.css`；
3. 新 clone 与 CI 的 build/test 步骤必须先构建 tokens，不要依赖仓库里不存在的 `dist/`。
