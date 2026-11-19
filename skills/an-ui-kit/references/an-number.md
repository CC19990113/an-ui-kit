# an-number

> 由 `packages/mcp/manifest.json`（仓库根 `custom-elements-manifest.json` 的拷贝）派生，表里的类型原文、事件名、CSS 变量、part 与 CEM 一致。
> 改组件 JSDoc 后重新生成：仓库根 `pnpm cem`，再 `pnpm --filter @an-ui-kit/mcp build`。

`<an-number>`：数字输入框。内部是真实的原生 `<input type="text" inputmode="decimal" role="spinbutton">`，所以输入、选区、IME 与移动端数字键盘都来自平台；解析、范围归一、步进与 `setValidity()` 由组件实现。

为什么不用 `<input type="number">`：浏览器对 `type=number` 的滚轮改值、非法中间态和本地化显示不可控，这里用文本框 + `inputmode="decimal"` 拿平台输入能力，数字语义自己管。

## 导入与注册

```js
import '@an-ui-kit/elements';            // 注册全部 16 个组件
import '@an-ui-kit/tokens/tokens.css';   // 主题/配色（颜色全部来自 --an-color-*）
```

`@an-ui-kit/elements` 注册全部组件（根入口）。React 还要 `import type {} from '@an-ui-kit/elements/react';`；Vue 3 还要配 `isCustomElement`（见 [../SKILL.md](../SKILL.md) 规则 9）。

## Attributes

| 名称 | 类型（CEM 原文） | 默认值 | 说明 |
| --- | --- | --- | --- |
| `value` | `string` | `""` | 初始数字文本；只作 seed，property 改动不回写 attribute。property `value` 接受 `number \| string \| null` |
| `min` | `number` | — | 最小值；低于它的输入会被归一到 `min`，归一前报 `rangeUnderflow` |
| `max` | `number` | — | 最大值；高于它的输入会被归一到 `max`，归一前报 `rangeOverflow` |
| `step` | `number` | `1` | 方向键 / 步进按钮 / `stepUp()` / `stepDown()` 的步长 |
| `precision` | `number` | — | 提交文本时保留的小数位；多余位数四舍五入，末尾 0 总是去掉 |
| `disabled` | `boolean` | `false` | 禁用；不进 `FormData`、不参与校验、不派发事件 |
| `readonly` | `boolean` | `false` | 只读：仍提交值，但跳过约束校验与步进 |
| `required` | `boolean` | `false` | 空值 → `valueMissing` |
| `placeholder` | `string` | `""` | 转发给内部 input 的占位文本 |
| `name` | `string` | `""` | 提交到 `FormData` 的字段名 |
| `size` | `'sm' \| 'md' \| 'lg'` | `md` | 控件尺寸 |
| `stepper` | `boolean` | `false` | 渲染上/下步进按钮（按住会连续步进） |

补充：

- `value` 的读写面不同：attribute 是**初始文本**；`element.value` 返回解析后的 `number | null`（空或非法 → `null`），setter 只改显示、**不派发** `an-number-change`。
- property `value` 接受 `number | string | null`；字符串会 `trim` 后解析，非数字/非有限值清空，便于 React/Vue 模板直传 `value="3"`。
- 没有 `label` attribute：可访问名用外部 `<label>` / `aria-label` / `aria-labelledby`。`aria-label` 与 `aria-labelledby` 会转发给内部 input。
- 布尔 attribute 只认「存在/不存在」。

## 事件

| 名称 | detail | 触发条件 |
| --- | --- | --- |
| `an-number-change` | `CustomEvent<{ value: number \| null, originalEvent: Event }>` | 提交（blur/Enter）、方向键/步进按钮、`stepUp()`/`stepDown()` 使解析值变化时；值没变不派发 |

- `bubbles: true`、`composed: true`，监听时 `event.target` 是 `<an-number>`。
- `stepUp()` / `stepDown()` 的 `detail.originalEvent` 是合成的 `change` 事件。
- 程序化写 `element.value` 不发事件；需要通知就自己派发业务事件。

## 方法

| 名称 | 说明 |
| --- | --- |
| `get/set value` | 读 `number \| null`；setter 接受 `number \| string \| null`（字符串 `trim` 后解析，非数字/非有限值清空），只更新显示，不发事件 |
| `stepUp(n = 1)` | 按 `step * n` 向上步进，并对齐到以 `min` 为基准的网格 |
| `stepDown(n = 1)` | 同上，向下 |
| `validity` | 平台的 `ValidityState`（只读） |
| `validationMessage` | 平台校验文案（只读），`<an-field>` 显示的就是它 |

## Slots

无。整个控件渲染在 shadow root 内。

## CSS Parts

| 名称 | 说明 |
| --- | --- |
| `base` | input 与可选 stepper 的外壳 |
| `input` | 内部文本输入框 |
| `stepper` | 步进按钮容器，仅 `stepper` 存在时渲染 |
| `spin-up` | 增加按钮 |
| `spin-down` | 减少按钮 |

## CSS 自定义属性

| 名称 | 说明 |
| --- | --- |
| `--an-number-height` | 控件高度 |
| `--an-number-bg` | 背景色 |
| `--an-number-fg` | 文本色 |
| `--an-number-border-color` | 边框色 |
| `--an-number-radius` | 圆角 |
| `--an-number-font-size` | 字号 |
| `--an-number-padding-x` | 水平内边距 |
| `--an-number-focus-ring` | 聚焦轮廓与边框色 |
| `--an-number-stepper-width` | 步进列宽度 |

## 用法与注意事项

### 读写值

```html
<an-number name="qty" min="1" max="99" step="1" value="1" stepper required></an-number>
```

```js
const qty = document.querySelector('an-number');
qty.value = 5;                // 只改显示，不发事件
console.log(qty.value);       // 5
qty.stepUp();                 // 6，并派发 an-number-change
qty.addEventListener('an-number-change', (event) => {
  console.log(event.detail.value);   // number | null
});
```

- 判断「有没有值」用 `element.value === null`，不要看 input 的文本。
- `min` / `max` 是**归一 + 校验**，不是硬拒绝：输入 `0` 到 `min=1` 的字段会先显示 `rangeUnderflow`，提交文本（blur/Enter）时归一到 `1`。要禁止越界输入请自己拦 `an-number-change` 或加业务校验。
- `precision` 只影响提交/格式化后的文本，不做输入过程中的取整。

### 步进与键盘

- `stepUp()` / `stepDown()` 在 `disabled`、`readonly`、祖先 `<fieldset disabled>` 下是 no-op。
- `step` 以 `min` 为基准网格；没写 `min` 时以 `0` 为基准。
- 步进按钮按住会连续步进，松开/移出停止。

### 表单与可访问性

- form-associated：`name` 有值时进 `FormData`；空值不提交。
- `required` 只校验「有没有值」，不校验范围；范围错误是 `rangeUnderflow` / `rangeOverflow` / `stepMismatch`。
- 内部 input 是 `role="spinbutton"`，方向键语义由组件自己处理；不要给它再包一层自定义键盘逻辑。

### 反例 → 正例

```html
<!-- ❌ 把 attribute 当受控值回写 -->
<an-number id="n" value="1"></an-number>
<script>
  document.querySelector('#n').addEventListener('an-number-change', (e) => {
    document.querySelector('#n').setAttribute('value', String(e.detail.value));  // 每次回写都会重置文本
  });
</script>

<!-- ✅ 只读 property，需要展示就写自己的状态 -->
<an-number id="n2" value="1"></an-number>

<!-- ❌ 用 label attribute（不存在） -->
<an-number label="数量"></an-number>

<!-- ✅ 用原生 label 或 aria-label -->
<label for="qty">数量</label><an-number id="qty" name="qty"></an-number>
```
