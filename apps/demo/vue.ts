import '@an-ui-kit/tokens/tokens.css';
import '@an-ui-kit/elements';

import { createApp } from 'vue';

import { installClickLog } from './src/click-log';

// 页面级监听器：e2e 用它数 DOM 上真实发生的 an-button-click 次数。
installClickLog('vue');
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
`;

const app = createApp({
  template,
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
