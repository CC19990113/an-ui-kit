# an-checkbox-group

> 由 `packages/mcp/manifest.json`（仓库根 `custom-elements-manifest.json` 的拷贝）派生，表里的类型原文、事件名、CSS 变量、part 与 CEM 一致。
> 改组件 JSDoc 后重新生成：仓库根 `pnpm cem`，再 `pnpm --filter @an-ui-kit/mcp build`。

`<an-checkbox-group>`：一组 `<an-checkbox>` 的**表单关联半边**。值、`required`、`min` / `max`、整组 `disabled`、方向键与 roving tabindex 都由 group 实现；每个子项的原生 input 在各自 Shadow DOM 里，平台无法把它们串成一组或按组提交多值，所以这些语义必须由 group 自己接管。

`value` 是 `string[]`：attribute 为逗号分隔字符串，property 是数组。每个选中值在 `FormData` 里**各自一条**记录（同名 `name`），不是逗号拼接的一条。

## 导入与注册

```js
import '@an-ui-kit/elements';            // 注册全部 17 个组件
import '@an-ui-kit/tokens/tokens.css';   // 主题/配色（颜色全部来自 --an-color-*）
```

`@an-ui-kit/elements` 注册全部组件（根入口）。React 还要 `import type {} from '@an-ui-kit/elements/react';`；Vue 3 还要配 `isCustomElement`（见 [../SKILL.md](../SKILL.md) 规则 9）。

## Attributes

| 名称 | 类型（CEM 原文） | 默认值 | 说明 |
| --- | --- | --- | --- |
| `name` | `string` | `""` | 字段名；每个选中值都用它提交 |
| `value` | `string` | `""` | 逗号分隔的选中值（`value="a,b"`）；`.value` 是 `string[]` 并回写 attribute |
| `disabled` | `boolean` | `false` | 禁用整组，**包括每个子项** |
| `required` | `boolean` | `false` | 至少选中一项，否则 `valueMissing` |
| `label` | `string` | `""` | 可见组标签；非空时同时是 `role="group"` 的可访问名称 |
| `orientation` | `'vertical' \| 'horizontal'` | `vertical` | 选项排列方向 |
| `min` | `number` | `0` | 最少选中数；`0` 关闭检查 |
| `max` | `number` | `0` | 最多选中数；`0` 表示不限 |
| `select-all` | `boolean` | `false` | 渲染“全选”复选框；只统计、切换启用项，禁用项不参与 |

补充：

- `value` 的 attribute 是**逗号分隔**的序列化，property 是数组；元素值本身含逗号时 attribute 无法往返，必须只走 property（CONTRACT 附录 D.1）。
- 没有 `value` attribute 时，子项里带 `checked` 的 `<an-checkbox>` 会 seed 初始值。
- `value` 里包含不存在的选项值时不构成选中：不提交、不计入 `min` / `required`。
- 布尔 attribute 只认「存在/不存在」。

## 事件

| 名称 | detail | 触发条件 |
| --- | --- | --- |
| `an-checkbox-group-change` | `CustomEvent<{ value: string[], originalEvent: Event }>` | 用户勾选/取消使选中值变化时；`disabled` 时不派发 |

- `bubbles: true`、`composed: true`，监听时 `event.target` 是 `<an-checkbox-group>`。
- `detail.value` 已按 DOM 顺序去重、只保留真实选项值；重复点同一项不派发。
- 子项自己的 `an-checkbox-change` 仍会冒泡；业务层优先监听 group 的聚合事件。

## 方法

无公开方法；值直接读写 `value` property。

## Slots

| 名称 | 说明 |
| --- | --- |
| （默认） | `<an-checkbox>` 选项，只读取直接子项 |

## CSS Parts

| 名称 | 说明 |
| --- | --- |
| `base` | label 与选项的外层容器 |
| `label` | 可见组标签，`label` 为空时不渲染 |
| `group` | `role="group"` 的选项容器 |
| `select-all-label` | 可选全选复选框的 label 外壳 |
| `select-all` | 可选全选原生 checkbox；`select-all` 未开启时不渲染 |
| `select-all-text` | 全选复选框旁的可见文案 |

## CSS 自定义属性

| 名称 | 说明 |
| --- | --- |
| `--an-checkbox-group-gap` | 选项间距，默认 `--an-space-2`（0.5rem） |

## 用法与注意事项

### 基本用法

```html
<an-checkbox-group name="topics" label="订阅主题" min="1" max="2" required>
  <an-checkbox value="news">新闻</an-checkbox>
  <an-checkbox value="tech">科技</an-checkbox>
  <an-checkbox value="life">生活</an-checkbox>
</an-checkbox-group>
```

```js
const group = document.querySelector('an-checkbox-group');
group.addEventListener('an-checkbox-group-change', (event) => {
  console.log(event.detail.value);   // ['news', 'tech']
});
group.value = ['news', 'life'];      // 受控写回（property）
```

### 多值序列化

- 读值只读 `.value`（数组），**不要** `attribute.split(',')`。
- 值里含逗号时必须走 property：`group.value = ['a,b', 'c']`；写成 `value="a,b,c"` 会被解析成三个值。
- 每个选中值单独进 `FormData`：原生 `<form>` 和 `<an-form>` 都以同一 `name` 追加多条记录；`formData.getAll('topics')` 才是完整值。子 `<an-checkbox>` 不需重复设置 `name`。

### `min` / `max` / `required`

- `min` / `max` 按**有效选中数**算，超出时报 `rangeUnderflow` / `rangeOverflow`（文案分别是「至少选择 N 项」「最多选择 N 项」）。
- `required` 只要求至少一项；与 `min=2` 同时写时，`min` 更严格。
- `max` 达到后是否阻止继续勾选取决于实现：组件在校验层报错，不要假设 UI 一定禁用剩余项 —— 提交前用 `validity` / `an-form` 兜底。

### `disabled` 与可访问性

- 整组 `disabled`（含祖先 `<fieldset disabled>`）会下推给每个子项：不进 `FormData`、不参与校验、不派发事件。
- 只禁用某一项时给那个 `<an-checkbox disabled>`，其余项仍可操作。
- group 的 roving tabindex 保证 Tab 只停一次；方向键在启用项之间移动，`Home` / `End` 跳首尾，空格切换。
- 子项必须有可访问名（文本内容或 `label`），group 的 `label` 只是组名。

### 反例 → 正例

```html
<!-- ❌ 解析 attribute 当数组 -->
<script>
  const values = document.querySelector('an-checkbox-group').getAttribute('value').split(',');
</script>

<!-- ✅ 读 property -->
<script>
  const values = document.querySelector('an-checkbox-group').value;
</script>

<!-- ❌ 含逗号的值写 attribute -->
<an-checkbox-group name="tags" value="a,b"></an-checkbox-group>

<!-- ✅ 含逗号的值走 property -->
<script>
  document.querySelector('an-checkbox-group').value = ['a,b'];
</script>

<!-- ❌ 只包一半选项，剩下的散落在组外 -->
<an-checkbox-group name="x"><an-checkbox value="a">A</an-checkbox></an-checkbox-group>
<an-checkbox value="b">B</an-checkbox>

<!-- ✅ 组只管理直接子项，所有选项都放进组里 -->
```
