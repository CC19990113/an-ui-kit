# an-select

> 由 `packages/mcp/manifest.json`（仓库根 `custom-elements-manifest.json` 的拷贝）派生，表里的类型原文、事件名、CSS 变量、part 与 CEM 一致。
> 改组件 JSDoc 后重新生成：仓库根 `pnpm cem`，再 `pnpm --filter @an-ui-kit/mcp build`。

`<an-select>`：自绘下拉选择器（不是原生 `<select>`）。作者把 `<an-option>`（或原生 `<option>`）写在 **light DOM**；select 通过 `MutationObserver` 读取并镜像到 shadow 内的 `role="listbox"` 面板。焦点始终留在 `role="combobox"` 的触发器上，用 `aria-activedescendant` 指向活动项，所以键盘操作能跨 shadow 重渲染存活。支持单选/多选、本地搜索、虚拟滚动与 tag 展示。

为什么不用原生 `<select>`：原生元素的选项渲染、多选交互与样式在跨浏览器/移动端不可控；这里只借平台的输入与可访问性语义，下拉本身自己画。

## 导入与注册

```js
import '@an-ui-kit/elements';            // 注册全部 16 个组件
import '@an-ui-kit/tokens/tokens.css';   // 主题/配色（颜色全部来自 --an-color-*）
```

`@an-ui-kit/elements` 注册全部组件（根入口）。React 还要 `import type {} from '@an-ui-kit/elements/react';`；Vue 3 还要配 `isCustomElement`（见 [../SKILL.md](../SKILL.md) 规则 9）。

## Attributes

| 名称 | 类型（CEM 原文） | 默认值 | 说明 |
| --- | --- | --- | --- |
| `label` | `string` | `""` | 触发器上方的可见标签 |
| `placeholder` | `string` | `""` | 未选择时的占位文本 |
| `size` | `'sm' \| 'md' \| 'lg'` | `md` | 控件尺寸 |
| `name` | `string` | `""` | 表单字段名 |
| `disabled` | `boolean` | `false` | 禁用交互与表单提交 |
| `required` | `boolean` | `false` | 无有效选择时 `valueMissing` |
| `invalid` | `boolean` | `false` | 视觉错误态 + `aria-invalid`（不参与约束校验） |
| `value` | `string` | `""` | 单选值；property setter 不回写 attribute |
| `values` | `string` | `""` | 多选值的逗号分隔 attribute；property 为 `string[]` |
| `multiple` | `boolean` | `false` | 多选模式 |
| `searchable` | `boolean` | `false` | 面板内显示本地搜索框 |
| `loading` | `boolean` | `false` | 面板显示加载行 |
| `virtual` | `'auto' \| 'on' \| 'off'` | `auto` | 长列表虚拟滚动；`auto` 在超过阈值时开启 |
| `max-tags` | `number` | — | 触发器最多展示几个 tag（多选） |
| `open` | `boolean` | `false` | 受控开合状态；与 `open` property 双向反射 |

补充：

- `value` / `values` 只作初始 seed：用户选择**不回写** attribute；读当前值用 property。
- 多选时 attribute `values="a,b"` 是逗号序列化，property 是 `string[]`；值本身含逗号时必须走 property（CONTRACT 附录 D.1）。
- 选项从 light DOM 直接子元素读取（`this.children`）；非 option 子元素忽略，嵌套列表不读。
- 布尔 attribute 只认「存在/不存在」。

## 事件

| 名称 | detail | 触发条件 |
| --- | --- | --- |
| `an-select-change` | `{ value: string, values: string[], option: { value, label, disabled } \| null, originalEvent: Event }` | 用户改变选择 |
| `an-select-open` | — | 面板打开 |
| `an-select-close` | — | 面板关闭 |
| `an-search` | `{ query: string }` | `searchable` 时输入防抖 150ms 后 |

- 全部 `bubbles: true`、`composed: true`，监听时 `event.target` 是 `<an-select>`。
- 程序化 `selectAll()` / `clear()` / property 写入不发 `an-select-change`（与原生 `select` 一致：代码改值不触发用户事件）。
- `an-search` 用本地过滤；要远程搜索就监听它并重建 `<an-option>` 列表。

## 方法 / 公开 property

| 名称 | 说明 |
| --- | --- |
| `get/set value` | 单选值；`''` 表示未选 |
| `get/set values` | 多选值 `string[]`；setter 也接受逗号字符串 |
| `get/set open` | 受控开合；布尔 attribute 反射 |
| `get isOpen` | 只读，面板实际是否打开 |
| `get options` | 当前选项快照 `{ value, label, disabled }[]` |
| `show()` / `close()` / `toggle()` | 打开 / 关闭 / 切换面板；**没有 `open()` 方法**（CONTRACT 附录 D.2） |
| `selectAll()` | 选中全部启用项；单选时只选第一个 |
| `clear()` | 清空选择 |

## Slots

| 名称 | 说明 |
| --- | --- |
| （默认） | `<an-option>` 或原生 `<option>` 子项，留在 light DOM |

## CSS Parts

| 名称 | 说明 |
| --- | --- |
| `base` | label 与控件的列容器 |
| `label` | 可见标签 |
| `trigger` | `role="combobox"` 触发器 |
| `placeholder` | 占位文本 |
| `tags` | 多选 tag 的容器 |
| `tag` | 多选 tag |
| `tag-remove` | tag 上的移除按钮 |
| `panel` | 浮层面板 |
| `search` | 搜索输入框 |
| `listbox` | `role="listbox"` 滚动容器 |
| `option` | 单个列表项 |
| `option-indicator` | 选中勾选标记 |
| `empty` | 无结果行 |
| `loading` | 加载行 |

## CSS 自定义属性

| 名称 | 说明 |
| --- | --- |
| `--an-select-height` | 触发器高度 |
| `--an-select-bg` | 触发器背景 |
| `--an-select-fg` | 触发器文本色 |
| `--an-select-border-color` | 触发器边框色 |
| `--an-select-radius` | 触发器圆角 |
| `--an-select-font-size` | 触发器字号 |
| `--an-select-padding-x` | 触发器水平内边距 |
| `--an-select-focus-ring` | 聚焦轮廓色 |
| `--an-select-panel-bg` | 面板背景 |
| `--an-select-panel-max-height` | 列表最大高度 |
| `--an-select-min-width` | 控件最小宽度 |

## 用法与注意事项

### 单选与多选

```html
<!-- 单选 -->
<an-select name="city" label="城市" placeholder="请选择" required>
  <an-option value="bj">北京</an-option>
  <an-option value="sh">上海</an-option>
</an-select>

<!-- 多选 -->
<an-select name="tags" label="标签" multiple searchable max-tags="3">
  <an-option value="a">A</an-option>
  <an-option value="b">B</an-option>
  <an-option value="c">C</an-option>
</an-select>
```

```js
const tags = document.querySelector('an-select[multiple]');
tags.values = ['a', 'b'];              // property：权威读写面
console.log(tags.values);              // ['a','b']
tags.addEventListener('an-select-change', (event) => {
  console.log(event.detail.values);
});
```

### 多值与序列化

- 读 `.values`（数组），不要 `split(',')` attribute。
- 值里含逗号时只能走 property：`select.values = ['a,b']`；`values="a,b"` 会被解析成两个值。
- `FormData` 每个选中值单独一条 `name` 记录；用 `getAll(name)` 取全部。

### 开合契约与浮层

- `open` 只做布尔 attribute；方法 `show()` / `close()` / `toggle()`；只读 `isOpen`；**没有 `open()` 方法**（CONTRACT 附录 D.2）。
- 面板留在 shadow 内，有 Popover API 时用 `popover="manual"` 进 top-layer，否则回退 `position: fixed`；视口坐标 + flip/shift，不依赖 `offsetParent`（附录 D.3）。
- Esc、点击外部、选中单项后关闭；多选模式选中后保持打开。

### 搜索与虚拟滚动

- `searchable` 的过滤是**本地**的：按选项文本匹配；`an-search` 只是把防抖后的 query 告诉你，组件不会替你请求远端。
- `virtual="auto"` 在可见项超过阈值时启用；不要自己给 `listbox` 加固定高度覆盖虚拟窗口计算。

### 表单与可访问性

- form-associated：`name` 有值时进 `FormData`；`disabled`（含祖先 `<fieldset disabled>`）时不提交、不校验。
- `invalid` 只是视觉状态；真正的校验来自 `required` + `setValidity()`。
- 触发器是 `role="combobox"`，面板是 `role="listbox"`，活动项用 `aria-activedescendant`；不要给内部节点加 `tabindex`。

### 反例 → 正例

```html
<!-- ❌ 还按原生 select 写 option.selected 并期待回写 -->
<an-select name="city"><option value="bj" selected>北京</option></an-select>

<!-- ✅ 用 an-option；初始值用 value attribute 或 property -->
<an-select name="city" value="bj"><an-option value="bj">北京</an-option></an-select>

<!-- ❌ 嵌套一层容器再放选项 -->
<an-select name="city"><div><an-option value="bj">北京</an-option></div></an-select>

<!-- ✅ 选项必须是直接子元素 -->
<an-select name="city"><an-option value="bj">北京</an-option></an-select>

<!-- ❌ 自己监听内部 option 的点击做业务 -->
<!-- ✅ 监听 an-select-change -->
```
