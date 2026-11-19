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

/**
 * 新增 7 个表单组件的 JSX intrinsics。
 *
 * 包内 `@an-ui-kit/elements/react` 目前只生成了 9 个旧标签的声明（在
 * `packages/**`，本任务不改）。这里用 demo 本地 augmentation 补齐，避免
 * `<an-form>` 等标签在 demo 的 typecheck 里报 TS2339；等包内类型跟上后
 * 可以删掉这一段（改动只在 demo 侧，不影响运行时代码）。
 */
type FamilyElementAttributes = {
  'data-testid'?: string;
  class?: string;
  className?: string;
  name?: string;
  label?: string;
  value?: string | string[] | number;
  values?: string;
  placeholder?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  precision?: string | number;
  accept?: string;
  action?: string;
  method?: string;
  'field-name'?: string;
  'max-size'?: string | number;
  'max-files'?: string | number;
  'max-tags'?: string | number;
  'auto-upload'?: string | boolean;
  'end-name'?: string;
  'first-day'?: string | number;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  multiple?: boolean;
  searchable?: boolean;
  loading?: boolean;
  stepper?: boolean;
  inline?: boolean;
  open?: boolean;
  novalidate?: boolean;
  virtual?: 'auto' | 'on' | 'off';
  orientation?: 'vertical' | 'horizontal';
  size?: 'sm' | 'md' | 'lg';
  format?: string;
  start?: string;
  end?: string;
  children?: import('react').ReactNode;
};

declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        'an-option': FamilyElementAttributes;
        'an-upload': FamilyElementAttributes & {
          'onan-upload-change'?: (event: CustomEvent) => void;
          'onan-upload-reject'?: (event: CustomEvent) => void;
        };
        'an-number': FamilyElementAttributes & {
          'onan-number-change'?: (event: CustomEvent) => void;
        };
        'an-date': FamilyElementAttributes & {
          'onan-date-change'?: (event: CustomEvent) => void;
        };
        'an-date-range': FamilyElementAttributes & {
          'onan-date-range-change'?: (event: CustomEvent) => void;
        };
        'an-checkbox-group': FamilyElementAttributes & {
          'onan-checkbox-group-change'?: (event: CustomEvent) => void;
        };
        'an-form': FamilyElementAttributes & {
          'onan-form-submit'?: (event: CustomEvent) => void;
          'onan-form-invalid'?: (event: CustomEvent) => void;
          'onan-form-reset'?: (event: CustomEvent) => void;
        };
      }
    }
  }
}
