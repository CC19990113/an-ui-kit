import '@x/tokens/tokens.css';
import '@x/elements';

import { useState } from 'react';
import { createRoot } from 'react-dom/client';

import { installClickLog } from './src/click-log';

// 页面级监听器：e2e 用它数 DOM 上真实发生的 x-button-click 次数。
installClickLog('react');
window.__reactHandlerCalls = [];

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('react.html: #root not found');

function App(): React.JSX.Element {
  const [handlerCalls, setHandlerCalls] = useState(0);

  // 注意：React 19 对自定义元素的事件 prop 走 `on` + 事件名 **原样**，
  // `x-button-click` 本身全小写，所以 prop 是 `onx-button-click`。
  const handleButtonClick = (
    event: CustomEvent<{ originalEvent: MouseEvent }>,
  ): void => {
    const id = (event.target as Element | null)?.getAttribute('data-testid') ?? 'unknown';
    window.__reactHandlerCalls.push(id);
    console.log('[react] x-button-click handler', id, event.detail?.originalEvent);
    setHandlerCalls((count) => count + 1);
  };

  return (
    <>
      <div className="row" data-testid="button-row">
        <x-button data-testid="btn-default" variant="default" onx-button-click={handleButtonClick}>
          Default
        </x-button>
        <x-button data-testid="btn-primary" variant="primary" onx-button-click={handleButtonClick}>
          Primary
        </x-button>
        <x-button data-testid="btn-danger" variant="danger" onx-button-click={handleButtonClick}>
          Danger
        </x-button>
        <x-button data-testid="btn-ghost" variant="ghost" onx-button-click={handleButtonClick}>
          Ghost
        </x-button>
        <x-button data-testid="btn-disabled" disabled onx-button-click={handleButtonClick}>
          Disabled
        </x-button>
        <x-button data-testid="btn-loading" loading onx-button-click={handleButtonClick}>
          Loading
        </x-button>
      </div>

      <p className="hint" data-testid="handler-count">
        React 监听器收到 {handlerCalls} 次
      </p>
    </>
  );
}

createRoot(rootElement).render(<App />);
