# an-option-group

> 由 `packages/mcp/manifest.json`（仓库根 `custom-elements-manifest.json` 的拷贝）派生，表里的类型原文、事件名、CSS 变量、part 与 CEM 一致。
> 改组件 JSDoc 后重新生成：仓库根 `pnpm cem`，再 `pnpm --filter @an-ui-kit/mcp build`。

`<an-option-group>`：一组 `<an-option>` 的**分组容器**，只对 `<an-select>` 有意义，**不自带表单值**（值仍由 select 的 `value` / `values` 提交）。它自己 `render()` 返回空串、宿主 `display:none`，所以写 markup 不会画两遍；`<an-select>` 读它的 `label` / `disabled` 和子项，把整组连同 `role="group"` 外壳画进自己的 listbox。

## 导入与注册

```js
import '@an-ui-kit/elements';            // 注册全部 17 个组件
import '@an-ui-kit/tokens/tokens.css';   // 主题/配色（颜色全部来自 --an-color-*）
```

`@an-ui-kit/elements` 注册全部组件（根入口）。React 还要 `import type {} from '@an-ui-kit/elements/react';`；Vue 3 还要配 `isCustomElement`（见 [../SKILL.md](../SKILL.md) 规则 9）。

## Attributes

| 名称 | 类型（CEM 原文） | 说明 |
| --- | --- | --- |
| `label` | `string` | 组名；`<an-select>` 把它渲染成 `role="group"` 外壳的 `aria-label`。缺省（未设置或为空串）时回退到组自身的文本节点，见下 |
| `disabled` | `boolean` | 禁用组内所有 `<an-option>`；布尔属性只认存在/不存在 |

补充：

- `label` 是**读取时求值**：写了非空 attribute 用它，否则取**组自身**的去空白文本节点。子 `<an-option>` 的文本永远算选项名，不算组名。
- `label` 为空串的 setter 会移除 attribute（`el.label = ''` 等价于不写）。
- empty group（没有任何 `<an-option>` 子项）在 select 里**不产生外壳**，`role="group"` 不会出现。
- 只支持**一层**分组：`<an-select>` 只遍历 `this.children`，组内子项直接进平铺列表；别再嵌一层 group 或把 option 包进 `<div>`。

## 事件

无。选中变化仍由 `<an-select>` 派发 `an-select-change`。

## 方法

| 名称 | 说明 |
| --- | --- |
| `get/set label` | 读写组名；`''` 会移除 attribute 并回退到文本节点 |
| `get/set disabled` | 读写禁用态（对 attribute 做布尔反射） |

## Slots

| 名称 | 说明 |
| --- | --- |
| （默认） | `<an-option>` 子项；留在 light DOM，由 `<an-select>` 读取 |

## CSS Parts / CSS 变量

无。组外壳的样式走 `<an-select>` 的 `::part(group)`，见 [`an-select.md`](an-select.md)。

## 用法与注意事项

### 声明式写法

```html
<an-select name="city" placeholder="请选择城市">
  <an-option-group label="华东">
    <an-option value="sh">上海</an-option>
    <an-option value="hz">杭州</an-option>
  </an-option-group>
  <an-option-group label="华北" disabled>
    <an-option value="bj">北京</an-option>
  </an-option-group>
</an-select>
```

组可以和平铺的 `<an-option>` 混用：未分组的选项在 select 里正常参与键盘导航与筛选。

### label 缺省回退

```html
<!-- 组名取自身文本节点「华南」，不会取子项的「广州」「深圳」 -->
<an-option-group>
  华南
  <an-option value="gz">广州</an-option>
  <an-option value="sz">深圳</an-option>
</an-option-group>
```

显式写 `label` 更稳：文本回退只扫组自身的文本节点，动态改结构时容易读不到预期值。

### disabled 级联

- 组的 `disabled` 在 select 收集选项时**一次性**下推到组内每个 option，所以组内选项都不响应点击/回车、不进入可选项集合。
- 它不影响 select 的 `required`：整组禁用后仍然算「没有有效选择」，`required` 下照样 `valueMissing`。
- 组内单个 `<an-option disabled>` 仍然可以单独禁用，两者是或关系。

### 反例 → 正例

```html
<!-- ❌ 把组当字段：它没有 name / value，不进 FormData -->
<an-option-group name="city" value="sh">华东</an-option-group>

<!-- ✅ 字段属于 select，组只负责分组和禁用级联 -->
<an-select name="city">
  <an-option-group label="华东"><an-option value="sh">上海</an-option></an-option-group>
</an-select>

<!-- ❌ 组里再套 div / 再嵌一层 group：select 只读一层的直接子项 -->
<an-option-group label="华东"><div><an-option value="sh">上海</an-option></div></an-option-group>

<!-- ✅ 选项直接写在组下 -->
<an-option-group label="华东"><an-option value="sh">上海</an-option></an-option-group>
```
