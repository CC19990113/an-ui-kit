import '@an-ui-kit/tokens/tokens.css';
import '@an-ui-kit/elements';

import { createApp, ref } from 'vue';

import { installClickLog } from './src/click-log';
import { installFormFamilyDemo } from './src/form-family-demo';
import { installInputLog } from './src/input-log';
import { installThemeToggle } from './src/theme-toggle';

// 明暗开关：只改文档根上的 data-theme，组件 CSS 从 tokens 继承新颜色。
installThemeToggle();
// 页面级监听器：e2e 用它数 DOM 上真实发生的 an-button-click 次数。
installClickLog('vue');
// 同一套思路记录 `an-input` / `an-change`，e2e 用它核对 detail.value。
installInputLog('vue');
// 表单族（7 个新增组件）的事件记录与 an-form 回显，四个页面共用。
installFormFamilyDemo();
window.__vueHandlerCalls = [];

const rootElement = document.getElementById('app');
if (!rootElement) throw new Error('vue.html: #app not found');

// 运行时模板：这样 `app.config.compilerOptions.isCustomElement` 才是真正生效的那个开关
// （SFC 是编译期处理，运行时配置对它无效）。
const template = /* html */ `
  <div class="row" data-testid="button-row">
    <an-button data-testid="btn-default" variant="default" @an-button-click="onButtonClick">Default</an-button>
    <an-button data-testid="btn-primary" variant="primary" @an-button-click="onButtonClick">Primary</an-button>
    <an-button data-testid="btn-danger" variant="danger" @an-button-click="onButtonClick">Danger</an-button>
    <an-button data-testid="btn-ghost" variant="ghost" @an-button-click="onButtonClick">Ghost</an-button>
    <an-button data-testid="btn-disabled" disabled @an-button-click="onButtonClick">Disabled</an-button>
    <an-button data-testid="btn-loading" loading @an-button-click="onButtonClick">Loading</an-button>
  </div>

  <h2>&lt;an-input&gt;</h2>
  <p class="hint">
    模板里写 <code>@an-input="onInput"</code>（Vue 对自定义元素直接
    <code>addEventListener('an-input')</code>）。<code>value</code> 只做初始值（Vue 对自定义元素
    会把它写成 <strong>property</strong> 而不是 attribute）：<code>ref</code> 只用于「回显」，
    不把 value 绑回去。表单语义（<code>FormData</code> / <code>required</code> /
    <code>reset()</code>）由组件的 <code>ElementInternals</code> 负责。
  </p>

  <!-- 与 native.html / tailwind.html / react 页的 fixture 逐项一致：data-testid 是 e2e 契约。 -->
  <form class="stack" id="input-form" data-testid="input-form" @submit.prevent="onSubmit">
    <an-input
      data-testid="inp-name"
      name="name"
      label="姓名"
      placeholder="请输入姓名"
      value="初始值"
      @an-input="onInput"
    ></an-input>
    <an-input
      data-testid="inp-email"
      name="email"
      type="email"
      label="邮箱"
      placeholder="you@example.com"
      value="a@b.com"
      @an-input="onInput"
    ></an-input>
    <an-input
      data-testid="inp-search"
      name="keyword"
      size="lg"
      aria-label="搜索"
      placeholder="搜索…"
      @an-input="onInput"
    ></an-input>
    <an-button data-testid="btn-submit" type="submit" variant="primary">提交</an-button>
    <p class="hint" data-testid="input-form-result">{{ formResult }}</p>

    <!-- 禁用的 fieldset 让 formDisabledCallback 生效，且该字段不进 FormData。 -->
    <fieldset class="stack" id="input-disabled-fieldset" data-testid="input-fieldset" disabled>
      <legend>禁用的 &lt;fieldset&gt;：内部输入框跟着禁用</legend>
      <an-input data-testid="inp-fieldset" name="locked" label="字段集内输入框" value="locked"></an-input>
    </fieldset>
  </form>

  <p class="hint">
    键入回显：<span data-testid="input-echo">{{ inputEcho }}</span>
    （Vue 的 <code>onInput</code> 收到原生 <code>CustomEvent</code>，读 <code>detail.value</code>）
  </p>

  <form class="stack" id="input-required-form" data-testid="input-required-form" @submit.prevent="onRequiredSubmit">
    <an-input data-testid="inp-required" name="nickname" label="昵称（必填）" required></an-input>
    <an-button type="submit" variant="primary">提交必填</an-button>
    <p class="hint" data-testid="input-required-result">{{ requiredResult }}</p>
  </form>

  <h2>完整表单 · Vue 3 绑定 + 原生 &lt;form&gt;</h2>
  <p class="hint">
    Vue 只绑 <code>@submit.prevent</code> / <code>@reset</code> 读值回显；校验、<code>FormData</code>、
    <code>reset()</code> 全交给 form-associated 控件与原生 <code>&lt;form&gt;</code>。
  </p>

  <form
    class="stack"
    id="demo-form"
    data-testid="form-root"
    @submit.prevent="onDemoSubmit"
    @reset="onDemoReset"
  >
    <an-field data-testid="field-name" label="姓名" required>
      <an-input data-testid="form-name" name="name" required placeholder="请输入"></an-input>
    </an-field>

    <an-field data-testid="field-bio" label="简介" hint="最多 200 字">
      <an-textarea data-testid="form-bio" name="bio" rows="3" maxlength="200"></an-textarea>
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
      <an-checkbox data-testid="form-terms" name="terms" required>同意条款</an-checkbox>
      <an-switch data-testid="form-notify" name="notify">接收通知</an-switch>
    </an-field>

    <fieldset class="stack" disabled data-testid="form-fieldset">
      <legend>禁用的 &lt;fieldset&gt;</legend>
      <an-field label="锁定字段">
        <an-input data-testid="form-locked" name="locked" value="locked"></an-input>
      </an-field>
    </fieldset>

    <div class="row">
      <an-button data-testid="form-submit" type="submit" variant="primary">提交</an-button>
      <an-button data-testid="form-reset" type="reset">重置</an-button>
    </div>
    <pre data-testid="form-output">{{ demoFormOutput }}</pre>
  </form>

  <h2>表单族（新增 7 个组件）</h2>
  <p class="hint">
    7 个新增组件全部包在 <code>&lt;an-form&gt;</code> 里：提交时读
    <code>an-form-submit</code> 的 <code>detail.formData</code>，校验失败时读
    <code>an-form-invalid</code> 并在下方显示错误。事件同时写入
    <code>window.__familyState</code> 供 e2e 断言。
  </p>

  <an-form class="stack" data-testid="family-form">
    <an-field label="单选（城市）">
      <an-select data-testid="family-select-single" name="single" placeholder="请选择城市">
        <an-option value="bj">北京</an-option>
        <an-option value="sh">上海</an-option>
        <an-option value="gz">广州</an-option>
        <an-option value="sz" disabled>深圳（已满）</an-option>
      </an-select>
    </an-field>

    <an-field label="多选（可搜索，option 里放 HTML）">
      <an-select
        data-testid="family-select-multi"
        name="tags"
        multiple
        searchable
        max-tags="2"
        placeholder="搜索标签（可多选）"
      >
        <an-option value="react"><b>React</b><small>组件化 UI</small></an-option>
        <an-option value="vue"><b>Vue</b><small>渐进式框架</small></an-option>
        <an-option value="wc"><b>Web Component</b><small>浏览器原生</small></an-option>
        <an-option value="ts"><b>TypeScript</b><small>类型系统</small></an-option>
        <an-option value="a11y"><b>Accessibility</b><small>可访问性</small></an-option>
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
      ></an-upload>
    </an-field>

    <an-field label="数字（1~10，步长 2，stepper）">
      <an-number
        data-testid="family-number"
        name="quantity"
        :value="3"
        min="1"
        max="10"
        step="2"
        stepper
        required
      ></an-number>
    </an-field>

    <an-field label="日期（普通 + inline）">
      <div class="row">
        <an-date
          data-testid="family-date"
          name="day"
          value="2026-11-10"
          min="2026-11-05"
          max="2026-11-25"
        ></an-date>
        <an-date data-testid="family-date-inline" inline value="2026-11-12"></an-date>
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
      ></an-date-range>
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
        <an-checkbox value="a11y" checked>可访问性</an-checkbox>
        <an-checkbox value="perf">性能</an-checkbox>
        <an-checkbox value="docs">文档</an-checkbox>
        <an-checkbox value="tests">测试</an-checkbox>
      </an-checkbox-group>
    </an-field>

    <div class="row">
      <an-button data-testid="family-submit" type="submit" variant="primary">提交表单族</an-button>
      <an-button data-testid="family-reset" type="reset">重置</an-button>
    </div>
    <div data-testid="family-errors"></div>
    <pre data-testid="family-output"></pre>
  </an-form>
`;

const app = createApp({
  template,
  setup() {
    // `<an-input>` 的 value 是「初始值」语义：ref 只做事件回显，不把 value 绑回去。
    const inputEcho = ref('');
    const formResult = ref('未提交');
    const requiredResult = ref('未提交');
    // 完整表单：只做「提交时读 FormData 回显」，不接管表单语义。
    const demoFormOutput = ref('');

    const onInput = (
      event: CustomEvent<{ value: string; originalEvent: InputEvent | Event }>,
    ): void => {
      inputEcho.value = event.detail.value;
    };

    const onSubmit = (event: Event): void => {
      event.preventDefault();
      const entries = [...new FormData(event.target as HTMLFormElement).entries()];
      formResult.value = entries.map(([key, value]) => `${key}=${value}`).join(' · ');
    };

    const onRequiredSubmit = (event: Event): void => {
      event.preventDefault();
      requiredResult.value = 'required 表单被提交了（应当先被拦下）';
    };

    /**
     * 完整表单：约束校验通过后浏览器才触发 submit，这里把 `FormData` 转成 JSON 回显。
     * 控件 form-associated，`name` / `bio` / `city` / `hobby` / `terms` / `notify` 都进 FormData。
     */
    const onDemoSubmit = (event: Event): void => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const data = Object.fromEntries(new FormData(form).entries());
      demoFormOutput.value = JSON.stringify(data, null, 2);
    };

    const onDemoReset = (): void => {
      demoFormOutput.value = '';
    };

    return {
      inputEcho,
      formResult,
      requiredResult,
      demoFormOutput,
      onInput,
      onSubmit,
      onRequiredSubmit,
      onDemoSubmit,
      onDemoReset,
    };
  },
  methods: {
    onButtonClick(event: Event): void {
      const custom = event as CustomEvent<{ originalEvent: MouseEvent }>;
      const id = (custom.target as Element | null)?.getAttribute('data-testid') ?? 'unknown';
      window.__vueHandlerCalls.push(id);
      console.log('[vue] an-button-click handler', id, custom.detail?.originalEvent);
    },
  },
});

// 关键：告诉 Vue 编译器 an-* 是原生自定义元素，别当组件去解析。
app.config.compilerOptions.isCustomElement = (tag: string) => tag.startsWith('an-');

app.mount(rootElement);
