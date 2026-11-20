# `@an-ui-kit/cli`

按一份 JSON 配置，把 [`@an-ui-kit/elements`](../elements) **裁剪成只含你选中组件的单文件 ESM**：
一个 `.js` 文件，CSS 已内联，不依赖任何 npm 包，直接 `<script type="module">` 或 `import` 进项目即可。

- 面向使用者的工具（不是仓库内构建脚本）：装在**你的项目**里，不要求仓库源码。
- 与 `@an-ui-kit/elements` **同一份组件源码**：标签名、类名、注册守卫、样式完全一致，
  所以裁剪产物和全量包的行为逐个组件相同。
- 只有 esbuild 一个运行时依赖（CLI 自己解析 argv，不引 commander / yargs）。

## 安装

```bash
npm i -D @an-ui-kit/cli @an-ui-kit/elements
# 或 pnpm add -D @an-ui-kit/cli @an-ui-kit/elements / yarn add -D ...
```

`@an-ui-kit/elements` 必须 **>= 0.2.0**（裁剪需要 npm 包内的 `src` 组件源码）。

也可以不安装、直接用 npx：优先用项目里装的 `@an-ui-kit/elements`（版本由你掌握），
项目里没有时回落到 CLI 自带的那一份。

```bash
npx @an-ui-kit/cli generate
```

## 快速开始

```bash
# 1. 生成配置（不覆盖已有文件，要覆盖请加 --force）
npx an-ui-kit init

# 2. 编辑 an-ui-kit.config.json —— "all" 表示全部，数组表示只打包这几个
#    { "components": ["an-button", "an-input"] }

# 3. 生成产物（默认 ./an-ui-kit.bundle.js）
npx an-ui-kit generate

# 4. 在项目里引入产物，然后直接用标签
```

```html
<script type="module" src="/an-ui-kit.bundle.js"></script>

<an-button variant="primary">保存</an-button>
```

```ts
// 也可以从产物里拿到组件类与基类
import { AnButton, AnElement } from './an-ui-kit.bundle.js';
```

> 产物里**不含** `@an-ui-kit/tokens` 的设计变量。需要完整的 `--an-color-*` 与明暗主题时，
> 额外引入 `@an-ui-kit/tokens/tokens.css`（组件内部有 fallback，不引入也能看）。

## 命令与参数

### `an-ui-kit list`

列出当前安装的 `@an-ui-kit/elements` 里可裁剪的组件标签，并打印包版本与解析到的绝对路径
（多版本共存时，这条路径能解释「为什么组件清单和我以为的不一样」）。

```text
[an-ui-kit] @an-ui-kit/elements@0.2.0
[an-ui-kit] 包路径：/path/to/node_modules/@an-ui-kit/elements
[an-ui-kit] 源码：/path/to/node_modules/@an-ui-kit/elements/src
[an-ui-kit] 组件（2）：an-button, an-input
```

### `an-ui-kit init [--config <path>] [--force]`

在 cwd 写一份默认配置。默认**不覆盖**已有文件（配置是你手写的），要覆盖得显式 `--force`。

| 选项 | 默认 | 说明 |
| --- | --- | --- |
| `--config <path>` | `./an-ui-kit.config.json` | 配置路径，父目录会自动创建 |
| `--force` | 关 | 已存在时覆盖 |

默认内容：

```json
{
  "$schema": "https://raw.githubusercontent.com/CC19990113/an-ui-kit/main/schema/an-ui-kit.config.schema.json",
  "components": "all"
}
```

`$schema` 只给编辑器补全用（VS Code / JetBrains 会拉远程 JSON Schema），CLI 运行时不读它，
删掉或改成本地路径都不影响使用。

### `an-ui-kit generate [--config <path>] [--components a,b] [--out <path>] [--no-minify]`

读配置 → 用 esbuild 把选中的组件打成单文件 ESM → 写盘，并打印模式、组件、输出绝对路径、
raw 与 gzip 大小。

| 选项 | 默认 | 说明 |
| --- | --- | --- |
| `--config <path>` | `./an-ui-kit.config.json` | 配置不存在时等价于 `"all"` |
| `--components a,b` | 取配置 | 逗号分隔；也接受 `all`；覆盖配置里的清单 |
| `--out <path>` | `./an-ui-kit.bundle.js` | 产物路径，父目录自动创建 |
| `--no-minify` | 关 | 不压缩，便于读产物调试 |

```text
[an-ui-kit] @an-ui-kit/elements@0.2.0（/path/to/node_modules/@an-ui-kit/elements）
[an-ui-kit] 配置来源：/path/to/an-ui-kit.config.json
[an-ui-kit] 模式：custom
[an-ui-kit] 组件（1）：an-button
[an-ui-kit] 压缩：开启（esbuild minify）
[an-ui-kit] 输出：/path/to/an-ui-kit.bundle.js
[an-ui-kit] raw：5689 B（5.6 KB）
[an-ui-kit] gzip（level 9）：2280 B（2.2 KB）
```

通用：`-h` / `--help` 打印用法；`--version` 打印 CLI 版本。未知子命令、未知组件都会退出码 1。

## 产物是什么

- **单文件 ESM**：只含选中组件 + 它们共享的 `internal/base.ts` 与 CSS；CSS 以字符串内联。
- **没有 npm 依赖**：不需要 `@an-ui-kit/elements` 也在运行时可用（安装它只是为了让 CLI 有源码可读）。
- **自带注册**：模块执行时对每个组件跑 `customElements.get(tag) || customElements.define(tag, Class)`，
  重复引入不会二次注册。
- **导出类与基类**：`export * from './internal/base'`（`AnElement` 等）+ 每个组件的类（`AnButton`…）。
- **不含类型声明**：产物是 `.js`；TS 项目需要类型时，从全量包 `@an-ui-kit/elements` 的 `dist/index.d.ts`
  取（两边导出同名类，类型可复用）。

## 与全量包的关系

| | `@an-ui-kit/elements` | CLI 产物 |
| --- | --- | --- |
| 形态 | npm 包，`exports` 只有 `.` | 单个 `.js` 文件，可任意路径存放 |
| 组件 | 全部 | 配置里选中的 |
| CSS | 随构建内联 | 同样内联 |
| 类型 | 有 `.d.ts` | 无 |
| 依赖 | 零运行时依赖 | 零运行时依赖 |

仓库自己的 `scripts/build-elements.mjs` 与这个 CLI 生成同构的入口（同一套 `src/` 扫描规则与注册守卫），
区别是前者给仓库用、产物落在 `packages/elements/dist`，后者的产物落在你的项目里。

## 常见错误

**`已安装的 @an-ui-kit/elements@x.y.z 没有随包发布组件源码（缺少 .../src），无法按配置裁剪。`**
装到的版本太旧（`files` 里还没有 `src`）。升级：`npm i -D @an-ui-kit/elements@latest`（要求 >= 0.2.0）。

**`未知组件：an-xxx` + 可用组件清单**
组件名拼错，或你装的 elements 版本里还没有这个组件。先 `an-ui-kit list` 看清单。

**`找不到 @an-ui-kit/elements，无法裁剪组件。`**
项目里没装（CLI 只负责裁剪，不会替你下载组件源码）：`npm i -D @an-ui-kit/elements`。

**`配置文件 ... 不是合法 JSON` / `"components" 只能是 ...` / `有未支持的字段：component`**
配置写坏了。只支持 `$schema` 与 `components`；`components` 只接受 `"all"` 或非空字符串数组。
拼错字段名会直接报错，不会静默退化成「全量」。

## 说明 / 非目标

- 不做 CommonJS / IIFE 产物：现代浏览器与所有主流打包器都吃 ESM。
- 不抽取独立 `.css`：单文件是卖点，样式随 JS 内联。
- 不是 shadcn 式「复制源码」流程：需要源码可改请用仓库 README 里的 shadcn CLI 方式。
