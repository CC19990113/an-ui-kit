import '@an-ui-kit/tokens/tokens.css';
import '@an-ui-kit/elements';

import { useState } from 'react';
import { createRoot } from 'react-dom/client';

import { installClickLog } from './src/click-log';
import { installFormFamilyDemo } from './src/form-family-demo';
import { installInputLog } from './src/input-log';

// 页面级监听器：e2e 用它数 DOM 上真实发生的 an-button-click 次数。
installClickLog('react');
// 同一套思路记录 `<an-input>` / `<an-change>`，e2e 用它核对 detail.value。
installInputLog('react');
// 表单族（7 个新增组件）的事件记录与 an-form 回显，四个页面共用。
installFormFamilyDemo();
window.__reactHandlerCalls = [];

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('react.html: #root not found');

/**
 * 包内 `@an-ui-kit/elements/react` 的 `<an-select>` 类型还是旧的 9 标签版本
 * （`packages/**` 本任务不改），没有 `multiple` / `searchable` / `max-tags`。
 * 用一个精确类型别名去 spread，既保留 JSX 结构又不需要 `any`；
 * 包内类型补齐后删掉这段即可。
 */
const multiSelectAttrs = {
  multiple: true,
  searchable: true,
  'max-tags': '2',
} as unknown as React.JSX.IntrinsicElements['an-select'];

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
          <an-select data-testid="form-city" name="city" label="城市" placeholder="请选择">
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

      <h2>表单族（新增 7 个组件）</h2>
      <p className="hint">
        7 个新增组件全部包在 <code>&lt;an-form&gt;</code> 里：提交时读
        <code>an-form-submit</code> 的 <code>detail.formData</code>，校验失败时读
        <code>an-form-invalid</code> 并在下方显示错误。事件同时写入
        <code>window.__familyState</code> 供 e2e 断言。
      </p>

      <an-form className="stack" data-testid="family-form">
        <an-field label="单选（城市）">
          <an-select data-testid="family-select-single" name="single" placeholder="请选择城市">
            <an-option value="bj">北京</an-option>
            <an-option value="sh">上海</an-option>
            <an-option value="gz">广州</an-option>
            <an-option value="sz" disabled>
              深圳（已满）
            </an-option>
          </an-select>
        </an-field>

        <an-field label="多选（可搜索，option 里放 HTML）">
          <an-select
            data-testid="family-select-multi"
            name="tags"
            placeholder="搜索标签（可多选）"
            {...multiSelectAttrs}
          >
            <an-option value="react">
              <b>React</b>
              <small>组件化 UI</small>
            </an-option>
            <an-option value="vue">
              <b>Vue</b>
              <small>渐进式框架</small>
            </an-option>
            <an-option value="wc">
              <b>Web Component</b>
              <small>浏览器原生</small>
            </an-option>
            <an-option value="ts">
              <b>TypeScript</b>
              <small>类型系统</small>
            </an-option>
            <an-option value="a11y">
              <b>Accessibility</b>
              <small>可访问性</small>
            </an-option>
          </an-select>
        </an-field>

        <an-field
          label="上传（图片 ≤ 2 KB，最多 2 个）"
          hint="auto-upload 关闭，文件留在队列里，提交时作为 File 进 FormData"
        >
          <an-upload
            data-testid="family-upload"
            name="attachment"
            accept="image/*"
            max-size="2048"
            max-files="2"
            multiple
            auto-upload="false"
          />
        </an-field>

        <an-field label="数字（1~10，步长 2，stepper）">
          <an-number
            data-testid="family-number"
            name="quantity"
            value={3}
            min="1"
            max="10"
            step="2"
            stepper
            required
          />
        </an-field>

        <an-field label="日期（普通 + inline）">
          <div className="row">
            <an-date
              data-testid="family-date"
              name="day"
              value="2026-11-10"
              min="2026-11-05"
              max="2026-11-25"
            />
            <an-date data-testid="family-date-inline" inline value="2026-11-12" />
          </div>
        </an-field>

        <an-field label="日期区间（提交 from / to 两个字段）">
          <an-date-range
            data-testid="family-range"
            name="from"
            end-name="to"
            start="2026-11-05"
            end="2026-11-09"
            min="2026-11-01"
            max="2026-11-30"
          />
        </an-field>

        <an-field label="方向键多选（checkbox-group）">
          <an-checkbox-group
            data-testid="family-checkbox-group"
            name="topics"
            label="关注方向"
            min="1"
            max="3"
            orientation="horizontal"
          >
            <an-checkbox value="a11y" checked>
              可访问性
            </an-checkbox>
            <an-checkbox value="perf">性能</an-checkbox>
            <an-checkbox value="docs">文档</an-checkbox>
            <an-checkbox value="tests">测试</an-checkbox>
          </an-checkbox-group>
        </an-field>

        <div className="row">
          <an-button data-testid="family-submit" type="submit" variant="primary">
            提交表单族
          </an-button>
          <an-button data-testid="family-reset" type="reset">
            重置
          </an-button>
        </div>
        <div data-testid="family-errors"></div>
        <pre data-testid="family-output"></pre>
      </an-form>
    </>
  );
}

createRoot(rootElement).render(<App />);
