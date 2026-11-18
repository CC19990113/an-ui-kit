/**
 * 类型层回归测试：`<x-button>` 的事件 prop 必须写成 `onx-button-click`。
 *
 * React 19 对自定义元素的事件 prop 是 `on` + **事件名原样**（`addEventListener(key.slice(2))`），
 * 不做 camelCase 转换。`x-button-click` 本身全小写，所以正确的 prop 就是 `onx-button-click`。
 *
 * 这个文件只做类型检查、不参与构建；`pnpm --filter demo typecheck` 会跑到它。
 */
import type {} from '@x/elements/react';

const handleButtonClick = (event: CustomEvent<{ originalEvent: MouseEvent }>): void => {
  console.log(event.detail.originalEvent);
};

/** 正例：事件名原样 —— React 会 addEventListener('x-button-click')。 */
export const correctEventProp = (
  <x-button variant="primary" onx-button-click={handleButtonClick}>
    Primary
  </x-button>
);

/**
 * 反例：`onXButtonClick` 会被 React 当成 `XButtonClick` 事件（0 命中），
 * 类型层也应该没有这个 prop —— 下面这行必须继续报错，`@ts-expect-error` 才成立。
 */
export const wrongEventProp =
  // @ts-expect-error onXButtonClick 不是 <x-button> 的 prop（React 19 事件名原样匹配）
  <x-button variant="primary" onXButtonClick={handleButtonClick} />;
