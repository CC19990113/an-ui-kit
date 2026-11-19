# @an-ui-kit/tokens

AN UI Kit 的设计 token 包。零第三方依赖：色板、构建、对比度断言全部自研。

## 命令

```bash
node scripts/build.mjs      # src/tokens.json -> dist/{tokens.css,tokens.ts,tokens.json}
node scripts/contrast.mjs   # WCAG 2.x 对比度断言，任一主题不达标 exit 1
```

`package.json` 的 `dependencies` 恒为空对象。

## 源文件

`src/tokens.json` 是 DTCG 风格源：

- 颜色以 OKLCH 表示：`{ "$value": { "l": 0.62, "c": 0.19, "h": 262 } }`，`l/c ∈ [0,1]`，`h` 为角度，不出现十六进制。
- 语义 token 用 DTCG 别名引用色阶，例如 `{ "$value": "{color.palette.blue.9}" }`。

### 12 阶插值策略

五套色（gray / blue / red / green / yellow）各有 12 阶，**1 最浅（L 最高）→ 12 最深（L 最低）**，按 hue 在 OKLCH 空间手工建模：

- 1 → 9 阶：明度 `L = L9 + (0.985 - L9) · (1 - t)^0.6`，彩度 `C = C9 · t^ce`，其中 `t = (step - 1) / 8`，`ce` 为各色单独的彩度缓动指数（yellow 取 2.1 以免浅色阶越出 sRGB 色域）。
- 9 → 12 阶：L、C 分别线性插值到各色的 `L12`、`C12`。
- 色相 `h` 恒定，不在阶间偏移。
- 全部 60 个色阶均验证落在 sRGB 色域内。

模型参数（锚点）写在 tokens.json 每个色族的 `$description` 里。

## 产出契约（@an-ui-kit/elements 消费）

| 种类 | 变量 |
| --- | --- |
| 色阶 | `--an-color-{hue}-{1..12}`，hue ∈ gray\|blue\|red\|green\|yellow |
| 语义色 | `--an-color-accent-9`（blue-9）、`--an-color-danger-9`（red-9）、`--an-color-fg-1`、`--an-color-bg-1`、`--an-color-border-1` |
| 间距 | `--an-space-{0..12}`，4px 步进 |
| 圆角 | `--an-radius-{none,sm,md,lg,full}` |
| 字号 | `--an-font-size-{xs,sm,md,lg,xl,xxl}` |

- `dist/tokens.css`：`:root` 为亮色，`[data-theme="dark"]` 覆盖暗色语义别名；另提供
  `[data-theme="light"]`（显式亮色优先）与 `@media (prefers-color-scheme: dark)` 系统暗色入口。
- `dist/tokens.ts`：`export const tokens = {...} as const`，颜色为解析后的 `{l,c,h}`。
- `dist/tokens.json`：扁平点号键，附 `cssVar` / `css`，便于 AI/工具读取。

### 暗色主题

色阶不重排（保持 1 最浅 → 12 最深的单一排序）；暗色主题只在 `[data-theme="dark"]` 下重映射语义别名
（同时输出 `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {...} }`，
遵循仓库 `CONTRACT.md` 第 6 条；显式 `[data-theme="light"]` 可覆盖系统暗色）：

| token | light | dark |
| --- | --- | --- |
| `--an-color-bg-1` | gray-1 | gray-12 |
| `--an-color-fg-1` | gray-12 | gray-1 |
| `--an-color-border-1` | gray-6 | gray-11 |
| `--an-color-accent-9` | blue-9 | blue-9 |
| `--an-color-danger-9` | red-9 | red-9 |

`--an-color-accent-9` / `--an-color-danger-9` 对白色文字的对比度均 ≥ 4.5:1（blue-9、red-9）。

## 对比度

`scripts/contrast.mjs` 自实现 OKLCH → OKLab → linear sRGB → WCAG 相对亮度链路，逐主题检查
`--an-color-fg-1` 对 `--an-color-bg-1` 是否 ≥ 4.5:1，并打印十六进制近似值便于核对。
