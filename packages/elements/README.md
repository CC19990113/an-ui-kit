# @an-ui-kit/elements

AN UI Kit 的 Web Components 包。组件用原生 Custom Elements 实现，**零运行时依赖**，同一份产物可直接用在原生 HTML、React 19、Vue 3（Angular / jQuery 为 planned）。

当前包含：`<an-button>`。

## 安装

```bash
npm i @an-ui-kit/elements
```

## 最小用法

```html
<script type="module">
  import '@an-ui-kit/elements'; // 注册全部元素
</script>

<an-button variant="primary">保存</an-button>
```

导入即注册 `customElements`。也可以直接用类：

```ts
import { AnButton } from '@an-ui-kit/elements';

const btn = new AnButton();
btn.variant = 'primary';
```

## `<an-button>`

| 项 | 值 |
| --- | --- |
| 属性 | `variant` (`default`\|`primary`\|`danger`\|`ghost`)、`size` (`sm`\|`md`\|`lg`)、`disabled`、`loading`、`type` (`button`\|`submit`\|`reset`) |
| 事件 | `an-button-click`，冒泡 + composed；`detail.originalEvent` 是原生 `MouseEvent` |
| CSS 变量 | `--an-button-height`、`--an-button-radius`、`--an-button-font-size` |
| CSS Part | `part="base"`（shadow 内部的原生 `<button>`） |
| 插槽 | 默认插槽：按钮文案 |

内部是真实原生 `<button>`，焦点、键盘激活与无障碍来自平台。宿主是 form-associated 元素：`type="submit"` 走 `form.requestSubmit()`（约束校验照常执行），`type="reset"` 走 `form.reset()`。

```ts
button.addEventListener('an-button-click', (e) => {
  console.log((e as CustomEvent).detail.originalEvent);
});
```

## 类型

- `react.d.ts`：React 19 的 JSX 类型（`import type {} from '@an-ui-kit/elements/react'`，纯类型文件，无运行时）。
- `vue.d.ts`：Vue 3 的模板/组件类型（`import type {} from '@an-ui-kit/elements/vue'`，同样是纯类型文件）。

## 契约

标签名、属性、事件、CSS 变量、parts、主题、reset 等硬规则见仓库 [CONTRACT.md](https://github.com/CC19990113/an-ui-kit/blob/main/CONTRACT.md)。AI agent 可读 `@an-ui-kit/mcp` 暴露的 Custom Elements Manifest 拿真实契约。

## License

MIT
