# AN UI Kit · 设计理念（PHILOSOPHY）

本文档记录 AN UI Kit 的设计边界与取舍，面向需要评估、使用或修改本库的人类开发者与 AI agent。

## 1. 定位与边界

AN UI Kit 只提供原生语义与可验证契约，不接管业务状态、数据流与页面架构。

**具体体现**：整个仓库由 tokens（设计变量）、elements（组件）、mcp（AI 查询）、cli（裁剪）四个包组成，组件基于原生 Custom Elements，通过标准浏览器接口与宿主协作。交互控件使用 `open` 模式的 Shadow DOM，`<an-form>` 则直接聚合 light DOM 控件。

**我们不做什么**：不扮演前端应用框架，不替业务决定状态管理、路由或数据请求方式。

## 2. 自由

使用者能改任何东西，组件只负责自身内部表现，不把外部宿主绑死在特定框架或样式体系上。

**具体体现**：
- 使用 Shadow DOM 的组件采用 `attachShadow({ mode: 'open' })`，保留五条对外出口：attribute、property、`bubbles: true, composed: true` 事件、CSS 变量与 `::part()`。
- `@an-ui-kit/tokens` 提供明暗双主题入口（显式 `data-theme="dark"` / `data-theme="light"` 与系统 `prefers-color-scheme`），组件内部 CSS 变量均带 fallback，不强绑外部样式表。
- 同一份构建产物可在原生 HTML、React 19 与 Vue 3 中运行。CI 在 Chromium、WebKit 与 Firefox 中检验同一套交互、主题及无障碍用例，并为单测设置覆盖率门槛。

**我们不做什么**：不锁定内部样式，不使用 `closed` Shadow DOM 阻止外部通过 CSS 变量与 `::part()` 覆盖外观。

## 3. 开放

没有黑盒扩展点，源码与契约都可读、可复制、可替换。

**具体体现**：
- `CONTRACT.md` 定义了 9 条可验证硬规则，覆盖标签名、attribute/property、事件、CSS 变量、parts、主题双入口、CEM 单一真相源、reset 四项与零依赖。
- 组件源码零第三方运行时依赖，既可以通过 npm 安装，也可以通过 `registry/`（shadcn 兼容组件 JSON）直接复制到业务项目中自行修改与替换。

**我们不做什么**：不设置私有协议或未文档化的内部钩子，也不把组件逻辑封装成无法拆解的黑盒运行时。

## 4. 更利好 AI

机器能发现、能校验、能生成、能裁剪，不需要靠猜 API 写界面代码。

**具体体现**：
- 根目录 `custom-elements-manifest.json`（CEM，schema 2.1.0，当前记录 17 个自定义元素及内部基类）是唯一真相源，CI 会校验源码扫描结果与该文件无 diff。
- 由 CEM 单一真相源派生三样产物：`registry/`（供代码生成的组件 JSON）、`@an-ui-kit/mcp`（基于 stdio 的只读 MCP Server，供 AI agent 查询组件契约）与 `skills/an-ui-kit/`（给 AI agent 的使用说明）。
- `@an-ui-kit/cli` 支持按 JSON 配置裁剪，只产出业务实际用到的组件。

**我们不做什么**：不另外维护一套手工编写的 AI 专用规格文档，避免文档与源码实现脱节。

## 5. 轻量

零运行时依赖，体积有硬预算，不在全局隐藏状态。

**具体体现**：
- `packages/*/dependencies` 恒为空对象 `{}`，由 CI 脚本强制断言；构建产物不引入任何第三方运行时库。
- 全量产物以 gzip 计算，保留 4096B 共享基线，再按每组件 2560B 计入预算，17 个组件的预算为 47616B。运行 `node scripts/ci/assert-bundle-size.mjs` 可查当前产物的实测体积与余量。
- 通过 `@an-ui-kit/cli` 可按配置生成仅包含所选组件的单文件 ESM 产物，进一步压低最终加载体积。

**我们不做什么**：不引入运行时依赖包，不在模块顶层维护隐式全局状态池或暗中挂载全局单例。

## 6. 足够简单

一行 script 加一个 HTML 标签就能运行，表单控件直接走浏览器平台语义。

**具体体现**：
- 在支持 ES 模块的原生 HTML 页面中引入脚本后即可直接使用 `<an-button>` 等标签，无需额外编译链。
- 值控件作为 form-associated custom elements 与原生 `<form>` 协作。用 `FormData` 收集值、用 `required` 约束提交、用 `reset()` 恢复初值，整组可通过 `<fieldset disabled>` 禁用。`<an-button>` 承接提交或重置动作，`<an-form>` 提供可选的规则校验与数据聚合。

**我们不做什么**：不强迫使用者为了渲染基础控件而接入特定的构建工具或表单包装层。

## 7. 关键取舍

每项架构选择都在解决具体问题，同时承担对应的约束。

- **为什么是 Custom Elements 而不是框架组件**：原生 Custom Elements 让同一份构建产物直接跑在原生 HTML、React 19 与 Vue 3 中，避免为每个框架重复维护一套实现；代价是部分未验证环境（如目前仅处于规划阶段的 Angular 与 jQuery）需要后续逐一补齐验证。
- **为什么用 CEM 作为唯一真相源**：以 CEM（schema 2.1.0）作为单一真相源，才能让类型定义、代码生成 `registry/`、`@an-ui-kit/mcp` 查询与 `skills/an-ui-kit/` 说明始终与源码一致，消除多份规格之间的漂移。
- **为什么交互做进组件、请求留给业务**：组件只处理内部状态与交互反馈（如加载态、禁用态、表单校验），通过 `bubbles: true, composed: true` 事件通知外部；具体接口请求、鉴权与重试逻辑留在业务层，保证组件可复用且不耦合后端协议。

**具体体现**：Custom Elements 让同一份产物跨框架运行，CEM 单一真相源对应 `CONTRACT.md` 第 7 条，请求留给业务则对应零依赖约束与 `bubbles: true, composed: true` 事件契约。

**我们不做什么**：不为单一框架编写独占特性，也不在组件内部硬编码业务 API 调用。

## 8. 边界与破例原则

明确不做哪些需求，才能守住前五条理念；只有平台标准本身变化或契约被显式修订时才会破例。

**具体体现**：
- **破例条件**：仅当 `CONTRACT.md` 先行修订并通过评审后，组件实现才允许调整对外接口或规则；所有例外都必须能被 CI 或评审脚本检查。
- **明确不做的需求**：
  - **SSR 专用运行时**：不提供服务端渲染专用适配运行时，组件依托浏览器 Custom Elements 与 Shadow DOM 能力工作。
  - **内置业务请求**：不封装业务接口、业务鉴权与自动重试；网络能力只以可选的通用实现提供（例如上传器），不绑定任何后端协议，不传就不发请求。
  - **锁定样式**：不封闭 Shadow DOM 或移除 CSS 变量与 `::part()`，保留外部覆盖样式的通道。

**我们不做什么**：不为了迎合短期业务定制而打破零运行时依赖、`CONTRACT.md` 契约或体积预算上限。
