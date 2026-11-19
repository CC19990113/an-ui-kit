# @an-ui-kit/mcp

AN UI Kit 的 MCP server（stdio）。把仓库根目录的 Custom Elements Manifest（CEM）暴露给 AI agent，让它查真实契约，而不是猜属性名和事件名。

- **只读**：三个工具都不改文件、不联网。
- **不另写规格**：数据源是仓库根 `custom-elements-manifest.json` 的拷贝 `manifest.json`（CEM 2.1.0），本包不单独扫描组件源码。
- **零运行时依赖**：`dependencies` 为空；MCP SDK 与 zod 在 `pnpm build` 时打进 `dist/server.js`（`dependencies` 必须为空是仓库 CI 红线）。

## 工具

| 工具 | 参数 | 返回 |
| --- | --- | --- |
| `list_components` | 无 | `[{ tagName, name, description }]` |
| `get_component` | `{ tagName: string }` | 完整契约：`attributes`（含 CEM 类型原文、默认值）、`events`、`slots`、`cssProperties`、`cssParts`、`description` |
| `search_components` | `{ query: string }` | `{ query, count, results: [{ tagName, name, description, matches }] }`；按 tag / 类名 / 描述 / 属性名模糊匹配，空格分词后每个词都要命中 |

未知 `tagName` 返回 `isError: true` 的文本结果并列出可用组件，进程不退出。

## 生成与构建

`packages/mcp/manifest.json` **不是**本包独立生成的，它是仓库根 CEM 的拷贝；构建时同步，避免两份 CEM 漂移。

```bash
# 1. 仓库根目录：由组件源码生成唯一真相源 custom-elements-manifest.json
pnpm cem

# 2. 拷贝根 CEM 到 packages/mcp/manifest.json，并打包成单文件 CLI
pnpm --filter @an-ui-kit/mcp build             # -> packages/mcp/manifest.json + dist/server.js

# 3. 跑端到端测试（用官方 client 真连 stdio server）
pnpm --filter @an-ui-kit/mcp test

# 4. 手动启动（构建产物 / 源码直跑）
pnpm --filter @an-ui-kit/mcp start   # node dist/server.js
pnpm --filter @an-ui-kit/mcp dev     # node src/server.js（读已提交的 manifest.json）
```

根 CEM 不存在时 `build` 直接报错退出，提示先跑 `pnpm cem`。启动后只向 **stderr** 打一行就绪日志；stdout 全部是 JSON-RPC。

`AN_UI_KIT_MCP_MANIFEST=/path/to/manifest.json` 可覆盖 manifest 位置（测试或多版本对比用）。

## 接到 agent

任何支持 MCP 的宿主都可以直接用 `node` 拉起打包后的入口：

```jsonc
// Claude Desktop: claude_desktop_config.json
{
  "mcpServers": {
    "an-ui-kit": {
      "command": "node",
      "args": ["/absolute/path/to/an-ui-kit/packages/mcp/dist/server.js"]
    }
  }
}
```

```toml
# Codex: ~/.codex/config.toml
[mcp_servers.an-ui-kit]
command = "node"
args = ["/absolute/path/to/an-ui-kit/packages/mcp/dist/server.js"]
```

调试用 MCP Inspector：

```bash
npx -y @modelcontextprotocol/inspector --cli node dist/server.js --method tools/list
npx -y @modelcontextprotocol/inspector --cli node dist/server.js \
  --method tools/call --tool-name get_component --tool-arg tagName=an-button
```

## 目录

```text
packages/mcp/
├─ src/server.js       # MCP 工具注册 + stdio 启动
├─ src/manifest.js     # CEM 读取、规范化、查询（无网络、无源码读取）
├─ test/server.test.js # 真 stdio 端到端测试（官方 client）
├─ scripts/build.mjs   # 拷贝根 CEM + esbuild 打包
├─ manifest.json       # 根 CEM 的拷贝（构建时同步，不是独立扫描）
└─ dist/server.js      # 生成物：自包含 CLI（gitignored）
```

## 表单提交

`<an-button>` 是 form-associated 自定义元素（`static formAssociated = true`，基类 `attachInternals()` 提供 `this.internals` 与 form 生命周期钩子）。`type="submit"` 点击时调用外层表单的 `requestSubmit()`，保留约束校验；`type="reset"` 调用 `form.reset()`。不要再监听 `an-button-click` 手动 `requestSubmit()`，按钮已提交过，会重复提交。

表单里直接写 `<an-button type="submit">提交</an-button>` 即可。

## 已知缺口

1. **`data-theme` 不在 CEM attributes 里**：`:host([data-theme='dark'])` 是库级主题入口（CONTRACT §6），不是组件 `@attr`，所以 MCP 的 `get_component` 查不到它。主题用法见 `skills/an-ui-kit`。
2. **manifest 来源是根 CEM 拷贝**：`packages/mcp/manifest.json` 由构建步骤从仓库根 `custom-elements-manifest.json` 复制，本包不 `x-cem scan`。根 CEM 更新后必须重新 `pnpm --filter @an-ui-kit/mcp build`，否则本包仍是旧副本。
3. **类级 description 缺失（待 x-cem 0.1.2）**：x-cem 0.1.1 不输出 class `description`；`list_components` 的 `description` 会退化为按 manifest 现场拼的事实摘要（属性名、事件名），不复制手写文档。scanner 支持后自动改用真 description。
4. **默认值位置（待 x-cem 0.1.2）**：0.1.1 把 `Default: "md"` 写在属性 description 里。服务端优先读结构化 `attribute.default`（0.1.2 起），读不到时用正则从 description 还原；无默认值的布尔属性为 `null`。

## 发布

已作为 `@an-ui-kit/mcp@0.1.0` 发布到 npm（`publishConfig.access: "public"`，registry 为 npmjs）。`bin` 指向打包后的 `dist/server.js`，命令名 `an-ui-kit-mcp`：

```bash
npx -y @an-ui-kit/mcp          # 直接跑 bin（an-ui-kit-mcp）
npm i -g @an-ui-kit/mcp        # 或全局安装后用 an-ui-kit-mcp
```

后续发版：改 `package.json` 的 `version` 后 `pnpm --filter @an-ui-kit/mcp publish`。`prepublishOnly` 会先 build —— 拷贝根 CEM 到 `manifest.json`，再用 esbuild 打包出自包含的 `dist/server.js`；`files` 覆盖 `dist`、`manifest.json`、`README.md`，产物内含 MIT 的 MCP SDK / zod。
