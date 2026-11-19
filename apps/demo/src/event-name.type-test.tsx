/**
 * 类型层回归测试：自定义元素的事件 prop 必须写成 `on` + **事件名原样**
 * （`onan-button-click`、`onan-checkbox-change` ……）。
 *
 * React 19 对自定义元素的事件 prop 是 `on` + 事件名原样（`addEventListener(key.slice(2))`），
 * 不做 camelCase 转换。事件名本身全小写，所以正确的 prop 就是 `onan-<事件名>`。
 *
 * 这个文件只做类型检查、不参与构建；`pnpm --filter demo typecheck` 会跑到它。
 */
import type {} from '@an-ui-kit/elements/react';

const handleButtonClick = (event: CustomEvent<{ originalEvent: MouseEvent }>): void => {
  console.log(event.detail.originalEvent);
};

/** 正例：事件名原样 —— React 会 addEventListener('an-button-click')。 */
export const correctEventProp = (
  <an-button variant="primary" onan-button-click={handleButtonClick}>
    Primary
  </an-button>
);

/**
 * 反例：`onAnButtonClick` 会被 React 当成 `AnButtonClick` 事件（0 命中），
 * 类型层也应该没有这个 prop —— 下面这行必须继续报错，`@ts-expect-error` 才成立。
 */
export const wrongEventProp =
  // @ts-expect-error onAnButtonClick 不是 <an-button> 的 prop（React 19 事件名原样匹配）
  <an-button variant="primary" onAnButtonClick={handleButtonClick} />;

/**
 * 表单组件的同一规则：每个事件 prop 都必须能在 `react.d.ts` 里找到对应 key，
 * 找不到这里就编译失败（等同于给 7 个新组件的 attributes / 事件类型做了回归）。
 * 同时顺带覆盖 `<an-field>` 的插槽与 `<an-select>` 的 `<option>` 子元素类型。
 */
export const formControlEventProps = (
  <an-field label="表单字段" hint="类型回归夹具" required>
    <an-input name="name" required onan-input={(event) => console.log(event.detail.value)} />
    <an-textarea
      name="bio"
      rows={3}
      maxlength={200}
      onan-textarea-input={(event) => console.log(event.detail.value)}
    />
    <an-select name="city" placeholder="请选择" onan-select-change={(event) => console.log(event.detail.value)}>
      <option value="bj">北京</option>
    </an-select>
    <an-checkbox name="terms" onan-checkbox-change={(event) => console.log(event.detail.checked)}>
      同意条款
    </an-checkbox>
    <an-switch name="notify" onan-switch-change={(event) => console.log(event.detail.checked)} />
    <an-radio-group name="hobby" onan-radio-change={(event) => console.log(event.detail.value)}>
      <an-radio value="code" onan-radio-select={(event) => console.log(event.detail.value)}>
        写代码
      </an-radio>
    </an-radio-group>
  </an-field>
);

/** 反例：`onAnCheckboxChange` 同样不存在（正确写法是 `onan-checkbox-change`）。 */
export const wrongCheckboxEventProp =
  // @ts-expect-error onAnCheckboxChange 不是 <an-checkbox> 的 prop（事件名原样匹配）
  <an-checkbox onAnCheckboxChange={handleButtonClick} />;
