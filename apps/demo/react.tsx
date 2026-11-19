import '@an-ui-kit/tokens/tokens.css';
import '@an-ui-kit/elements';

import { useState } from 'react';
import { createRoot } from 'react-dom/client';

import { installClickLog } from './src/click-log';

// 页面级监听器：e2e 用它数 DOM 上真实发生的 an-button-click 次数。
installClickLog('react');
window.__reactHandlerCalls = [];

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('react.html: #root not found');

function App(): React.JSX.Element {
  const [handlerCalls, setHandlerCalls] = useState(0);

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
    </>
  );
}

createRoot(rootElement).render(<App />);
