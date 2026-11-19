import '@an-ui-kit/tokens/tokens.css';
import '@an-ui-kit/elements';

import { useState } from 'react';
import { createRoot } from 'react-dom/client';

import { installClickLog } from './src/click-log';
import { installInputLog } from './src/input-log';

// 页面级监听器：e2e 用它数 DOM 上真实发生的 an-button-click 次数。
installClickLog('react');
// 同一套思路记录 `<an-input>` / `<an-change>`，e2e 用它核对 detail.value。
installInputLog('react');
window.__reactHandlerCalls = [];

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('react.html: #root not found');

function App(): React.JSX.Element {
  const [handlerCalls, setHandlerCalls] = useState(0);
  // `<an-input>` 的 value 是「初始值」语义：React 只负责把事件读出来回显，
  // 不把 value 绑回去（否则会打断 IME 组合输入，也违背组件契约）。
  const [inputEcho, setInputEcho] = useState('');
  const [formResult, setFormResult] = useState('未提交');
  const [requiredResult, setRequiredResult] = useState('未提交');
  // 完整表单：提交时把 FormData 转成 JSON 回显（React 侧只读值，不接管表单语义）。
  const [demoFormOutput, setDemoFormOutput] = useState('');

  // 注意：React 19 对自定义元素的事件 prop 走 `on` + 事件名 **原样**，
  // `an-button-click` 本身全小写，所以 prop 是 `onan-button-click`。
  const handleButtonClick = (
    event: CustomEvent<{ originalEvent: MouseEvent }>,
  ): void => {
    const id = (event.target as Element | null)?.getAttribute('data-testid') ?? 'unknown';
    window.__reactHandlerCalls.push(id);
    console.log('[react] an-button-click handler', id, event.detail?.originalEvent);
    setHandlerCalls((count) => count + 1);
  };

  /** 同理，`an-input` / `an-change` 的 prop 是 `onan-input` / `onan-change`。 */
  const handleInput = (
    event: CustomEvent<{ value: string; originalEvent: InputEvent | Event }>,
  ): void => {
    setInputEcho(event.detail.value);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const entries = [...new FormData(event.currentTarget).entries()];
    setFormResult(entries.map(([key, value]) => `${key}=${value}`).join(' · '));
  };

  const handleRequiredSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setRequiredResult('required 表单被提交了（应当先被拦下）');
  };

  /**
   * 完整表单：约束校验通过后浏览器才触发 submit，这里把 `FormData` 转成 JSON 回显。
   * 控件是 form-associated 的，所以 `name` / `bio` / `city` / `hobby` / `terms` / `notify`
   * 全部由平台写入 FormData，React 侧不接任何隐藏 input。
   */
  const handleDemoSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    setDemoFormOutput(JSON.stringify(data, null, 2));
  };

  const handleDemoReset = (): void => {
    setDemoFormOutput('');
  };

  return (
    <>
      <div className="row" data-testid="button-row">
        <an-button data-testid="btn-default" variant="default" onan-button-click={handleButtonClick}>
          Default
        </an-button>
        <an-button data-testid="btn-primary" variant="primary" onan-button-click={handleButtonClick}>
          Primary
        </an-button>
        <an-button data-testid="btn-danger" variant="danger" onan-button-click={handleButtonClick}>
          Danger
        </an-button>
        <an-button data-testid="btn-ghost" variant="ghost" onan-button-click={handleButtonClick}>
          Ghost
        </an-button>
        <an-button data-testid="btn-disabled" disabled onan-button-click={handleButtonClick}>
          Disabled
        </an-button>
        <an-button data-testid="btn-loading" loading onan-button-click={handleButtonClick}>
          Loading
        </an-button>
      </div>

      <p className="hint" data-testid="handler-count">
        React 监听器收到 {handlerCalls} 次
      </p>

      <h2>&lt;an-input&gt;</h2>
      <p className="hint">
        事件 prop 是 <code>onan-input</code> / <code>onan-change</code>（事件名<strong>原样</strong>，不做
        camelCase 转换）。<code>value</code> 只做初始值（React 对自定义元素会把它写成
        <strong>property</strong> 而不是 attribute）：这里用 React state 只做「回显」，不把
        <code>value</code> 绑回去。表单语义（<code>FormData</code> / <code>required</code> /
        <code>reset()</code>）由组件自己的 <code>ElementInternals</code> 负责，React 侧零接线。
      </p>

      {/* 与 native.html / tailwind.html / vue 页的 fixture 逐项一致：data-testid 是 e2e 契约。 */}
      <form
        className="stack"
        id="input-form"
        data-testid="input-form"
        onSubmit={handleSubmit}
      >
        <an-input
          data-testid="inp-name"
          name="name"
          label="姓名"
          placeholder="请输入姓名"
          value="初始值"
          onan-input={handleInput}
        />
        <an-input
          data-testid="inp-email"
          name="email"
          type="email"
          label="邮箱"
          placeholder="you@example.com"
          value="a@b.com"
          onan-input={handleInput}
        />
        <an-input
          data-testid="inp-search"
          name="keyword"
          size="lg"
          aria-label="搜索"
          placeholder="搜索…"
          onan-input={handleInput}
        />
        <an-button data-testid="btn-submit" type="submit" variant="primary">
          提交
        </an-button>
        <p className="hint" data-testid="input-form-result">
          {formResult}
        </p>

        {/* 禁用的 fieldset 让 formDisabledCallback 生效，且该字段不进 FormData。 */}
        <fieldset className="stack" id="input-disabled-fieldset" data-testid="input-fieldset" disabled>
          <legend>禁用的 &lt;fieldset&gt;：内部输入框跟着禁用</legend>
          <an-input data-testid="inp-fieldset" name="locked" label="字段集内输入框" value="locked" />
        </fieldset>
      </form>

      <p className="hint">
        键入回显：<span data-testid="input-echo">{inputEcho}</span>
        （React 的 <code>onan-input</code> handler 收到的是原生
        <code>CustomEvent&lt;{'{'} value, originalEvent {'}'}&gt;</code>）
      </p>

      <form
        className="stack"
        id="input-required-form"
        data-testid="input-required-form"
        onSubmit={handleRequiredSubmit}
      >
        <an-input data-testid="inp-required" name="nickname" label="昵称（必填）" required />
        <an-button type="submit" variant="primary">
          提交必填
        </an-button>
        <p className="hint" data-testid="input-required-result">
          {requiredResult}
        </p>
      </form>

      <h2>完整表单 · React 19 绑定 + 原生 &lt;form&gt;</h2>
      <p className="hint">
        React 只绑 <code>onSubmit</code> / <code>onReset</code> 读值回显；校验、<code>FormData</code>、
        <code>reset()</code> 全交给 form-associated 控件与原生 <code>&lt;form&gt;</code>。
      </p>

      <form
        className="stack"
        id="demo-form"
        data-testid="form-root"
        onSubmit={handleDemoSubmit}
        onReset={handleDemoReset}
      >
        <an-field data-testid="field-name" label="姓名" required>
          <an-input data-testid="form-name" name="name" required placeholder="请输入" />
        </an-field>

        <an-field data-testid="field-bio" label="简介" hint="最多 200 字">
          <an-textarea data-testid="form-bio" name="bio" rows={3} maxlength={200} />
        </an-field>

        <an-field data-testid="field-city" label="城市">
          <an-select data-testid="form-city" name="city" placeholder="请选择">
            <option value="bj">北京</option>
            <option value="sh">上海</option>
          </an-select>
        </an-field>

        <an-field data-testid="field-hobby" label="兴趣">
          <an-radio-group data-testid="form-hobby" name="hobby" value="code">
            <an-radio value="code">写代码</an-radio>
            <an-radio value="bike">骑车</an-radio>
          </an-radio-group>
        </an-field>

        <an-field data-testid="field-terms" label="选项">
          <an-checkbox data-testid="form-terms" name="terms" required>
            同意条款
          </an-checkbox>
          <an-switch data-testid="form-notify" name="notify">
            接收通知
          </an-switch>
        </an-field>

        <fieldset className="stack" disabled data-testid="form-fieldset">
          <legend>禁用的 &lt;fieldset&gt;</legend>
          <an-field label="锁定字段">
            <an-input data-testid="form-locked" name="locked" value="locked" />
          </an-field>
        </fieldset>

        <div className="row">
          <an-button data-testid="form-submit" type="submit" variant="primary">
            提交
          </an-button>
          <an-button data-testid="form-reset" type="reset">
            重置
          </an-button>
        </div>
        <pre data-testid="form-output">{demoFormOutput}</pre>
      </form>

    </>
  );
}

createRoot(rootElement).render(<App />);
