/**
 * 类型层装配：把 `@an-ui-kit/elements` 的框架类型收进 demo 的 program。
 *
 * - `@an-ui-kit/elements/react`：给 JSX 补 `<an-button>` / `<an-input>` intrinsics
 *   （事件名是 `'onan-button-click'` / `'onan-input'` / `'onan-change'`，React 对
 *   自定义元素不做 camelCase 转换）。
 * - `@an-ui-kit/elements/vue`：`declare module 'vue'` 的 GlobalComponents augmentation。
 *   它要求 `vue` 能从该声明文件的位置解析到；demo 装了 vue 3.5.45，并在 tsconfig
 *   `paths` 里把 `vue` 指到 demo 的副本，避免依赖包管理器/软链的解析细节。
 *   解析不到时 augmentation 会静默失效（有 skipLibCheck 兜着，不会报错）。
 *
 * demo 不再本地重复声明 `<an-input>`：包内 `react.d.ts` / `vue.d.ts` 已按 CEM
 * 给出契约，这里只留编译期断言，确认 augmentation 真的进了 demo 的 program。
 */
import type {} from '@an-ui-kit/elements/react';
import type {} from '@an-ui-kit/elements/vue';

import type { GlobalComponents } from 'vue';

/**
 * 编译期断言：如果 vue.d.ts 的 augmentation 没生效，
 * `GlobalComponents['AnButton']` / `GlobalComponents['AnInput']` 会报 TS2339，
 * typecheck 直接红。
 */
export type AnButtonVueComponent = GlobalComponents['AnButton'];
export type AnInputVueComponent = GlobalComponents['AnInput'];
