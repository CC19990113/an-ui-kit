# an-option

> 由 `packages/mcp/manifest.json`（仓库根 `custom-elements-manifest.json` 的拷贝）派生，表里的类型原文、事件名、CSS 变量、part 与 CEM 一致。
> 改组件 JSDoc 后重新生成：仓库根 `pnpm cem`，再 `pnpm --filter @an-ui-kit/mcp build`。

`<an-option>`：`<an-select>` 的一个选项，**不自带表单值**（值由 select 的 `value` / `values` 提交）。它只是 light DOM 里的声明，渲染、选中与键盘交互全部由 `<an-select>` 负责。

## 导入与注册

```js
import '@an-ui-kit/elements';            // 注册全部 16 个组件
import '@an-ui-kit/tokens/tokens.css';   // 主题/配色（颜色全部来自 --an-color-*）
```

`@an-ui-kit/elements` 注册全部组件（根入口）。React 还要 `import type {} from '@an-ui-kit/elements/react';`；Vue 3 还要配 `isCustomElement`（见 [../SKILL.md](../SKILL.md) 规则 9）。

## Attributes

| 名称 | 类型（CEM 原文） | 说明 |
| --- | --- | --- |
| `value` | `string` | 选中时提交的值；缺省取去空白后的文本内容 |
| `label` | `string` | 可访问名称；缺省取去空白后的文本内容（`value` 也缺省时） |
| `disabled` | `boolean` | 禁止选中；布尔属性只认存在/不存在 |

补充：

- `value` / `label` 是**读取时求值**：写了 attribute 用它，否则取当前 `textContent`；所以改文本会改变值，但显式写 `value` / `label` 更稳。`label` 为空字符串时回退到文本内容。
- `<an-option>` 自身不渲染（宿主 `display:none`，`render()` 返回空串）；`<an-select>` 把子项的 `innerHTML` 镜像进自己的 listbox，所以选项里可以放图标等标记。
- 选项必须直接写在 `<an-select>` 的 light DOM 里；select 只遍历 `this.children`，嵌套一层就读不到。

## 事件

无。选项被选中时由 `<an-select>` 派发 `an-select-change`，不要监听 option。

## 方法

| 名称 | 说明 |
| --- | --- |
| `get/set value` | 读写选项值（`label` 同理）；property 改动不回写 attribute |

## Slots

| 名称 | 说明 |
| --- | --- |
| （默认） | 选项文本；`label` 与 `value` 都没有时用它 |

## CSS Parts / CSS 变量

无。选项的样式通过 `<an-select>` 的 `::part(option)` 系列暴露，见 [`an-select.md`](an-select.md)。

## 用法与注意事项

### 声明式写法

```html
<an-select name="city" placeholder="请选择城市">
  <an-option value="bj">北京</an-option>
  <an-option value="sh">上海</an-option>
  <an-option value="gz" disabled>广州（暂不可选）</an-option>
</an-select>
```

### 只读、禁用与动态更新

- 选项的 `disabled` 不影响 select 的 `required`：禁用项不计入可选项，但仍然算「没有有效选择」，`required` 下照样 `valueMissing`。
- 动态增删 `<an-option>` 时 select 会重新同步；已选值失效时不构成选中（不进 `FormData`）。列表变化由 select 侧的 `MutationObserver` 监听，不需要手动通知。

### 反例 → 正例

```html
<!-- ❌ option 自己带 name，指望它独立提交 -->
<an-option name="city" value="bj">北京</an-option>

<!-- ✅ 字段名属于 select，选项只提供值 -->
<an-select name="city"><an-option value="bj">北京</an-option></an-select>

<!-- ❌ 值里带逗号又依赖 attribute 往返 -->
<an-select multiple values="a,b,c"></an-select>

<!-- ✅ 多值走 property -->
<script>
  document.querySelector('an-select').values = ['a,b', 'c'];
</script>
```
