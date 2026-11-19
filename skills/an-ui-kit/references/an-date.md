# an-date

> 由 `packages/mcp/manifest.json`（仓库根 `custom-elements-manifest.json` 的拷贝）派生，表里的类型原文、事件名、CSS 变量、part 与 CEM 一致。
> 改组件 JSDoc 后重新生成：仓库根 `pnpm cem`，再 `pnpm --filter @an-ui-kit/mcp build`。

`<an-date>`：单日期选择器，form-associated，值是 `YYYY-MM-DD` 字符串。触发器内部是原生 `<input role="combobox" readonly>`，面板在 shadow 内的日历 dialog 里；打字、选择、清除、键盘日历导航都由组件处理，提交/校验/`reset` 走平台的 `ElementInternals`。

日期只按**本地日期字段**处理（`new Date(y, m-1, d)`），不做 UTC 换算 —— 东八区不会出现「差一天」。

## 导入与注册

```js
import '@an-ui-kit/elements';            // 注册全部 17 个组件
import '@an-ui-kit/tokens/tokens.css';   // 主题/配色（颜色全部来自 --an-color-*）
```

`@an-ui-kit/elements` 注册全部组件（根入口）。React 还要 `import type {} from '@an-ui-kit/elements/react';`；Vue 3 还要配 `isCustomElement`（见 [../SKILL.md](../SKILL.md) 规则 9）。

## Attributes

| 名称 | 类型（CEM 原文） | 说明 |
| --- | --- | --- |
| `value` | `string` | 选中的 `YYYY-MM-DD`；只作 seed，property 改动不回写 attribute |
| `min` | `string` | 最早可选日期（`YYYY-MM-DD`） |
| `max` | `string` | 最晚可选日期（`YYYY-MM-DD`） |
| `open` | `boolean` | 受控开合状态；与 `open` property 双向反射 |
| `inline` | `boolean` | 面板留在文档流内，不渲染触发器 |
| `disabled` | `boolean` | 阻止一切交互与提交 |
| `readonly` | `boolean` | 显示值，但禁止选择与键入；仍提交、跳过约束校验 |
| `required` | `boolean` | 没有选中日期时报 `valueMissing` |
| `placeholder` | `string` | 输入框占位文本，默认 `请选择日期` |
| `name` | `string` | 提交到 `FormData` 的字段名 |
| `size` | `'sm' \| 'md' \| 'lg'` | 控件尺寸，默认 `md` |
| `first-day` | `number` | 星期列起点：`0` = 周日，`1` = 周一（默认） |
| `format` | `string` | 显示格式；支持 `YYYY`、`MM`、`M`、`DD`、`D`，默认 `YYYY-MM-DD` |

补充：

- `value` 只作初始值：选日期**不回写** attribute；受控场景读 property 或监听 `an-date-change`。
- 没有 `label` attribute；可访问名用 `<an-date>` 的 `label` slot、外部 `<label>` 或 `aria-label` / `aria-labelledby`。
- 布尔 attribute 只认「存在/不存在」；`inline` 与 `open` 同时存在时以布局为准（`inline` 不渲染触发器）。
- `min` / `max` 之外的日期不可选，也不在键盘导航里停靠。

## 事件

| 名称 | detail | 触发条件 |
| --- | --- | --- |
| `an-date-change` | `CustomEvent<{ value: string, originalEvent: Event }>` | 选择、键入、清除或 `reset()` 导致值变化；`value` 为 `''` 表示清空 |
| `an-date-open` | — | 浮层面板打开 |
| `an-date-close` | — | 浮层面板关闭（Esc、外部点击、选择完成、`close()`） |

- `bubbles: true`、`composed: true`，监听时 `event.target` 是 `<an-date>`。
- 只在值**真的变化**时派发 `an-date-change`。
- 程序化写 `element.value` 不发事件；程序化 `open = true` 会派发 open/close。

## 方法

| 名称 | 说明 |
| --- | --- |
| `get/set value` | 读/写 `YYYY-MM-DD`；setter 不回写 attribute |
| `get isOpen` | 只读，面板实际是否打开 |
| `show()` | 打开面板；`inline` / `disabled` / `readonly` 时 no-op |
| `close()` | 关闭面板 |
| `toggle()` | 打开时关闭，关闭时打开 |

## Slots

| 名称 | 说明 |
| --- | --- |
| `label` | 触发器上方的可选标签；非空时渲染 `part="label"` |

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
| `day-selected` | 选中日附加 |
| `day-today` | 今天附加 |
| `day-outside` | 相邻月份的日期附加 |
| `footer` | 底栏（清除 + 今天） |
| `clear` | 清除选择 |
| `today` | 选择今天 |

## CSS 自定义属性

| 名称 | 说明 |
| --- | --- |
| `--an-date-height` | 触发器高度；默认随 `size` 取 `--an-space-9/11/12` |
| `--an-date-bg` | 触发器背景，默认 `--an-color-bg-1` |
| `--an-date-fg` | 触发器文本色，默认 `--an-color-fg-1` |
| `--an-date-border-color` | 触发器边框，默认 `--an-color-border-1` |
| `--an-date-radius` | 触发器圆角，默认 `--an-radius-md` |
| `--an-date-font-size` | 触发器字号；默认随 `size` 取 `--an-font-size-sm/md/lg` |
| `--an-date-padding-x` | 触发器水平内边距，默认 `--an-space-3` |
| `--an-date-focus-ring` | 聚焦轮廓色 |
| `--an-date-muted-fg` | 弱化文本（星期、非本月日期） |
| `--an-date-panel-bg` | 面板背景，默认 `--an-color-bg-1` |
| `--an-date-panel-fg` | 面板文本色，默认 `--an-color-fg-1` |
| `--an-date-panel-border-color` | 面板边框，默认 `--an-color-border-1` |
| `--an-date-panel-radius` | 面板圆角，默认 `--an-radius-lg` |
| `--an-date-panel-shadow` | 面板阴影 |
| `--an-date-day-size` | 日按钮尺寸，默认 `2.25rem` |
| `--an-date-day-hover-bg` | 日按钮悬停背景，默认 `--an-color-gray-2` |
| `--an-date-day-selected-bg` | 选中日背景，默认 `--an-color-accent-9` |
| `--an-date-day-selected-fg` | 选中日文本色，默认 `#ffffff` |
| `--an-date-today-ring` | 今天的外圈颜色，默认 `--an-color-accent-9` |

## 用法与注意事项

### 基本用法

```html
<an-date name="day" value="2026-11-19" min="2026-01-01" max="2026-12-31" required>
  <span slot="label">入住日期</span>
</an-date>
```

```js
const date = document.querySelector('an-date');
date.addEventListener('an-date-change', (event) => {
  console.log(event.detail.value);   // 'YYYY-MM-DD' 或 ''
});
date.show();                          // 等价于 date.open = true
```

### 开合契约

- `open` 只做**布尔 attribute**；方法只有 `show()` / `close()` / `toggle()`，查询用只读 `isOpen`。
- **没有 `open()` 方法**：它与 `open` 属性同名，调用会被属性遮蔽（见 CONTRACT 附录 D.2）。
- Esc、点击面板外部、选中日期后会由组件自己关闭并派发 `an-date-close`；不要把 `open` 当成「用户意图」的唯一状态，以事件为准。

### 浮层与定位

- 面板留在组件 shadow 内（`::part(panel)`），有 Popover API 时用 `popover="manual"` 进 top-layer，否则回退 `position: fixed`；定位基于视口坐标 + flip/shift，不依赖 `offsetParent`。
- 祖先的 `overflow: hidden` / `transform` 不应裁掉面板；若被裁，先确认没有覆盖 `panel` 的定位样式。
- 滚动/resize 时面板会重新定位；关闭后监听解绑。

### 日期与时区

- 值统一 `YYYY-MM-DD`；内部只用 `new Date(y, m-1, d)` 的本地字段。
- **禁止** `toISOString()`、`Date.parse('YYYY-MM-DD')`（按 UTC 解析）、`getUTC*()`：这些会让本地午夜变成前一天。
- `format` 只影响显示，不改变提交值；提交始终是 ISO 的 `YYYY-MM-DD`。

### 表单与可访问性

- form-associated：`name` 有值时进 `FormData`；`disabled`（含祖先 `<fieldset disabled>`）时不提交、不校验。
- `required` 只看「有没有选中日期」，不看 `min` / `max`。
- `readonly` 仍提交值，但跳过约束校验并禁止选择/键入。
- 内部输入是 `role="combobox"`，面板是 `role="dialog"` + `role="grid"`；不要自己给内部节点加 `tabindex`，键盘导航已实现。

### 反例 → 正例

```html
<!-- ❌ 用 UTC 换算日期 -->
<script>
  const d = new Date(document.querySelector('an-date').value);
  console.log(d.toISOString().slice(0, 10));   // 东八区可能差一天
</script>

<!-- ✅ 直接使用 ISO 字符串，或按本地字段构造 -->
<script>
  const [y, m, d] = document.querySelector('an-date').value.split('-').map(Number);
  console.log(new Date(y, m - 1, d).getDate());
</script>

<!-- ❌ 把 open 当方法调用 -->
<script>document.querySelector('an-date').open();</script>

<!-- ✅ 用 show()/close()/toggle() -->
<script>document.querySelector('an-date').toggle();</script>
```
