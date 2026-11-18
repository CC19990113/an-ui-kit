import '@x/tokens/tokens.css';
import '@x/elements';

import { createApp } from 'vue';

import { installClickLog } from './src/click-log';

// 页面级监听器：e2e 用它数 DOM 上真实发生的 x-button-click 次数。
installClickLog('vue');
window.__vueHandlerCalls = [];

const rootElement = document.getElementById('app');
if (!rootElement) throw new Error('vue.html: #app not found');

// 运行时模板：这样 `app.config.compilerOptions.isCustomElement` 才是真正生效的那个开关
// （SFC 是编译期处理，运行时配置对它无效）。
const template = /* html */ `
  <div class="row" data-testid="button-row">
    <x-button data-testid="btn-default" variant="default" @x-button-click="onButtonClick">Default</x-button>
    <x-button data-testid="btn-primary" variant="primary" @x-button-click="onButtonClick">Primary</x-button>
    <x-button data-testid="btn-danger" variant="danger" @x-button-click="onButtonClick">Danger</x-button>
    <x-button data-testid="btn-ghost" variant="ghost" @x-button-click="onButtonClick">Ghost</x-button>
    <x-button data-testid="btn-disabled" disabled @x-button-click="onButtonClick">Disabled</x-button>
    <x-button data-testid="btn-loading" loading @x-button-click="onButtonClick">Loading</x-button>
  </div>
`;

const app = createApp({
  template,
  methods: {
    onButtonClick(event: Event): void {
      const custom = event as CustomEvent<{ originalEvent: MouseEvent }>;
      const id = (custom.target as Element | null)?.getAttribute('data-testid') ?? 'unknown';
      window.__vueHandlerCalls.push(id);
      console.log('[vue] x-button-click handler', id, custom.detail?.originalEvent);
    },
  },
});

// 关键：告诉 Vue 编译器 x-* 是原生自定义元素，别当组件去解析。
app.config.compilerOptions.isCustomElement = (tag: string) => tag.startsWith('x-');

app.mount(rootElement);
