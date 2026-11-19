# an-date-range

> 由 `packages/mcp/manifest.json`（仓库根 `custom-elements-manifest.json` 的拷贝）派生，表里的类型原文、事件名、CSS 变量、part 与 CEM 一致。
> 改组件 JSDoc 后重新生成：仓库根 `pnpm cem`，再 `pnpm --filter @an-ui-kit/mcp build`。

`<an-date-range>`：日期范围选择器，form-associated，提交 `name`（开始）与 `end-name`（结束）**两个**字段。两次点击完成选择：第一次设开始，第二次设结束；顺序会自动排序（先点较晚的日期，第二次点较早的日期时，较早的那天成为新的开始）。

半选状态（只有开始、没有结束）**不提交任何字段**：light DOM 里两个隐藏 input 在两端都确定前处于 `disabled`，且 `setFormValue(null)`。这也是它不用单个 `ElementInternals` 承载两个字段的原因 —— 平台一个元素只给一条 `FormData` 记录。

## 导入与注册

```js
import '@an-ui-kit/elements';            // 注册全部 16 个组件
import '@an-ui-kit/tokens/tokens.css';   // 主题/配色（颜色全部来自 --an-color-*）
```

`@an-ui-kit/elements` 注册全部组件（根入口）。React 还要 `import type {} from '@an-ui-kit/elements/react';`；Vue 3 还要配 `isCustomElement`（见 [../SKILL.md](../SKILL.md) 规则 9）。

## Attributes

| 名称 | 类型（CEM 原文） | 说明 |
| --- | --- | --- |
| `start` | `string` | 范围开始 `YYYY-MM-DD`；只作 seed，property 改动不回写 attribute |
| `end` | `string` | 范围结束 `YYYY-MM-DD`；同上 |
| `min` | `string` | 最早可选日期（`YYYY-MM-DD`） |
| `max` | `string` | 最晚可选日期（`YYYY-MM-DD`） |
| `open` | `boolean` | 受控开合状态；与 `open` property 双向反射 |
| `inline` | `boolean` | 面板留在文档流内，不渲染触发器 |
| `disabled` | `boolean` | 阻止一切交互与提交 |
| `required` | `boolean` | 两端没选全时报 `valueMissing` |
| `placeholder` | `string` | 触发字段占位文本，默认 `开始日期 — 结束日期` |
| `name` | `string` | 开始日期提交的字段名 |
| `end-name` | `string` | 结束日期提交的字段名；默认空（不提交结束字段） |
| `size` | `'sm' \| 'md' \| 'lg'` | 控件尺寸，默认 `md` |
| `first-day` | `number` | 星期列起点：`0` = 周日，`1` = 周一（默认） |

补充：

- 没有 `label` attribute；可访问名用 `label` slot、外部 `<label>` 或 `aria-label` / `aria-labelledby`。
- **没有 `readonly`**：日期范围只有禁用语义；需要只读展示请自行渲染文本。
- `end-name` 为空时结束日期不进 `FormData`（只有开始字段），通常应显式设置。
- 布尔 attribute 只认「存在/不存在」。

## 事件

| 名称 | detail | 触发条件 |
| --- | --- | --- |
| `an-date-range-change` | `CustomEvent<{ start: string, end: string }>` | 范围**完成**或清空时；半选状态不派发 |
| `an-date-range-open` | — | 浮层面板打开 |
| `an-date-range-close` | — | 浮层面板关闭 |

- `bubbles: true`、`composed: true`，监听时 `event.target` 是 `<an-date-range>`。
- 第一次点击（只有开始）不派发 `an-date-range-change`，避免业务层拿到半截数据；用 `start` property 读中间态。
- 程序化写 `start` / `end` 不发事件。

## 方法

| 名称 | 说明 |
| --- | --- |
| `get/set start` | 读/写开始日期 `YYYY-MM-DD` |
| `get/set end` | 读/写结束日期 `YYYY-MM-DD` |
| `get isOpen` | 只读，面板实际是否打开 |
| `show()` | 打开面板；`inline` / `disabled` 时 no-op |
| `close()` | 关闭面板 |
| `toggle()` | 打开时关闭，关闭时打开 |

## Slots

| 名称 | 说明 |
| --- | --- |
| `label` | 触发字段上方的可选标签 |

## CSS Parts

| 名称 | 说明 |
| --- | --- |
| `base` | label / trigger / panel 的外壳 |
| `label` | 可见标签，`label` slot 为空时不渲染 |
| `trigger` | 可点击的触发字段 |
| `input` | 内部原生 `<input role="combobox">` |
| `panel` | 日历 dialog |
| `header` | 月份栏（标题 + 左右箭头） |
| `title` | `YYYY年M月` 标题 |
| `nav-prev` | 上一个月按钮 |
| `nav-next` | 下一个月按钮 |
| `grid` | 6 × 7 的 `role="grid"` 容器 |
| `weekday` | 星期列头 |
| `day` | 日按钮 |
| `day-selected` | 区间端点附加 |
| `day-today` | 今天附加 |
| `day-outside` | 相邻月份的日期附加 |
| `footer` | 底栏（清除 + 今天） |
| `clear` | 清除选择 |
| `today` | 以今天开始一段新范围 |

## CSS 自定义属性

| 名称 | 说明 |
| --- | --- |
| `--an-date-range-height` | 触发器高度 |
| `--an-date-range-bg` | 触发器背景 |
| `--an-date-range-fg` | 触发器文本色 |
| `--an-date-range-border-color` | 触发器边框 |
| `--an-date-range-radius` | 触发器圆角 |
| `--an-date-range-font-size` | 触发器字号 |
| `--an-date-range-padding-x` | 触发器水平内边距 |
| `--an-date-range-focus-ring` | 聚焦轮廓色 |
| `--an-date-range-muted-fg` | 弱化文本（星期、非本月日期） |
| `--an-date-range-panel-bg` | 面板背景 |
| `--an-date-range-panel-fg` | 面板文本色 |
| `--an-date-range-panel-border-color` | 面板边框 |
| `--an-date-range-panel-radius` | 面板圆角 |
| `--an-date-range-panel-shadow` | 面板阴影 |
| `--an-date-range-day-size` | 日按钮尺寸 |
| `--an-date-range-day-hover-bg` | 日按钮悬停背景 |
| `--an-date-range-day-selected-bg` | 端点背景 |
| `--an-date-range-day-selected-fg` | 端点文本色 |
| `--an-date-range-in-range-bg` | 区间内日期背景 |
| `--an-date-range-today-ring` | 今天的外圈颜色 |

## 用法与注意事项

### 基本用法

```html
<an-date-range
  name="from"
  end-name="to"
  start="2026-11-01"
  end="2026-11-19"
  required
></an-date-range>
```

```js
const range = document.querySelector('an-date-range');
range.addEventListener('an-date-range-change', (event) => {
  console.log(event.detail.start, event.detail.end);   // 'YYYY-MM-DD' 或 ''
});
```

### 两个提交字段

- `name` 对应开始日期，`end-name` 对应结束日期；二者都非空时 `FormData` 出现两条记录。
- 只选了一端时：两个隐藏 input 都 `disabled`，`setFormValue(null)`，不提交、`required` 报 `valueMissing`。
- 用原生 `<form>` 时不要再给隐藏 input 额外的 `name`；它们由组件管理。

### 开合契约

- `open` 只做布尔 attribute；方法 `show()` / `close()` / `toggle()`，只读 `isOpen`；**没有 `open()` 方法**（CONTRACT 附录 D.2）。
- Esc、点击外部、范围完成会关闭面板并派发 `an-date-range-close`。

### 浮层与定位

- 面板留在 shadow 内，优先 `popover="manual"` 进 top-layer，回退 `position: fixed`；视口坐标 + flip/shift，不依赖 `offsetParent`。
- 滚动/resize 重新定位；关闭后解绑监听。

### 日期与时区

- `start` / `end` 统一 `YYYY-MM-DD`，内部只用 `new Date(y, m-1, d)` 本地字段。
- **禁止** `toISOString()` / `Date.parse('YYYY-MM-DD')` / UTC 换算。
- 排序在组件内部完成；`detail.start <= detail.end`，不要假设「第二次点的就是 end」。

### 反例 → 正例

```html
<!-- ❌ 只写 name，结束日期不会提交 -->
<an-date-range name="range"></an-date-range>

<!-- ✅ 两个字段分别命名 -->
<an-date-range name="from" end-name="to"></an-date-range>

<!-- ❌ 解析 form 值后假设 start 一定来自 name、end 一定来自 end-name（写反了） -->
<!-- ✅ 用 detail.start / detail.end，或按属性名读两条 FormData 记录 -->
```
