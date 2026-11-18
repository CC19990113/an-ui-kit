# @x/mcp

x-elements 的 MCP server（stdio）。把仓库根目录的 Custom Elements Manifest（CEM）暴露给 AI agent，让它查真实契约，而不是猜属性名和事件名。

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
pnpm --filter @x/mcp build             # -> packages/mcp/manifest.json + dist/server.js

# 3. 跑端到端测试（用官方 client 真连 stdio server）
pnpm --filter @x/mcp test

# 4. 手动启动（构建产物 / 源码直跑）
pnpm --filter @x/mcp start   # node dist/server.js
pnpm --filter @x/mcp dev     # node src/server.js（读已提交的 manifest.json）
```

根 CEM 不存在时 `build` 直接报错退出，提示先跑 `pnpm cem`。启动后只向 **stderr** 打一行就绪日志；stdout 全部是 JSON-RPC。

`X_ELEMENTS_MCP_MANIFEST=/path/to/manifest.json` 可覆盖 manifest 位置（测试或多版本对比用）。

## 接到 agent

任何支持 MCP 的宿主都可以直接用 `node` 拉起打包后的入口：

```jsonc
// Claude Desktop: claude_desktop_config.json
{
  "mcpServers": {
    "x-elements": {
      "command": "node",
      "args": ["/absolute/path/to/x-elements/packages/mcp/dist/server.js"]
    }
  }
}
```

```toml
# Codex: ~/.codex/config.toml
[mcp_servers.x-elements]
command = "node"
args = ["/absolute/path/to/x-elements/packages/mcp/dist/server.js"]
```

调试用 MCP Inspector：

```bash
npx -y @modelcontextprotocol/inspector --cli node dist/server.js --method tools/list
npx -y @modelcontextprotocol/inspector --cli node dist/server.js \
  --method tools/call --tool-name get_component --tool-arg tagName=x-button
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

## 已知缺口

1. **`type="submit"` 不提交外层表单**：`<x-button>` 内部的原生 button 在 Shadow DOM 里，拿不到外层 `<form>`（`button.form === null`），这是 Shadow DOM 结构限制，不是按钮实现写错。当前文档只承诺 `type` 的原生语义（`button` / `submit` / `reset`），表单提交必须监听 `x-button-click` 后手动 `form.requestSubmit()`。后续给组件基类引入 `ElementInternals` + `static formAssociated = true` 后统一支持（下一阶段）。
2. **`data-theme` 不在 CEM attributes 里**：`:host([data-theme='dark'])` 是库级主题入口（CONTRACT §6），不是组件 `@attr`，所以 MCP 的 `get_component` 查不到它。主题用法见 `skills/x-elements`。
3. **manifest 来源是根 CEM 拷贝**：`packages/mcp/manifest.json` 由构建步骤从仓库根 `custom-elements-manifest.json` 复制，本包不 `x-cem scan`。根 CEM 更新后必须重新 `pnpm --filter @x/mcp build`，否则本包仍是旧副本。
4. **类级 description 缺失（待 x-cem 0.1.2）**：x-cem 0.1.1 不输出 class `description`；`list_components` 的 `description` 会退化为按 manifest 现场拼的事实摘要（属性名、事件名），不复制手写文档。scanner 支持后自动改用真 description。
5. **默认值位置（待 x-cem 0.1.2）**：0.1.1 把 `Default: "md"` 写在属性 description 里。服务端优先读结构化 `attribute.default`（0.1.2 起），读不到时用正则从 description 还原；无默认值的布尔属性为 `null`。

## 发布

按阶段 1 的裁决，暂不发 npm：包保持 `"private": true`。`bin` 已指向打包后的 `dist/server.js`；将来发布只需删除 `private`、确认 `files` 覆盖 `dist` 与 `manifest.json`、并接受打包产物包含 MIT 的 MCP SDK / zod（`prepublishOnly` 会先 build）。
