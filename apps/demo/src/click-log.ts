/**
 * 三个框架页共用的「点击事件记录器」。
 *
 * e2e 用 `window.__anButtonClickLog` 数 DOM 上真正发生了多少次 `an-button-click`，
 * 用 `window.__reactHandlerCalls` / `window.__vueHandlerCalls` 证明框架自己的
 * 监听器也收到了事件 —— 两者独立，才不是自说自话的假绿。
 */
export interface ClickRecord {
  /** 触发事件的 `<an-button>` 上的 data-testid。 */
  id: string | null;
  /** 事件 target 的标签名，应为 `an-button`（不是内部 button）。 */
  tag: string;
  bubbles: boolean;
  composed: boolean;
  hasOriginalEvent: boolean;
}

declare global {
  interface Window {
    __anButtonClickLog: ClickRecord[];
    __reactHandlerCalls: string[];
    __vueHandlerCalls: string[];
  }
}

export function installClickLog(owner: string): ClickRecord[] {
  const log: ClickRecord[] = (window.__anButtonClickLog = []);

  document.addEventListener('an-button-click', (event) => {
    const target = event.target as Element | null;
    const detail = (event as CustomEvent<{ originalEvent?: unknown }>).detail;
    const record: ClickRecord = {
      id: target?.getAttribute?.('data-testid') ?? null,
      tag: target?.tagName?.toLowerCase() ?? 'unknown',
      bubbles: event.bubbles,
      composed: event.composed,
      hasOriginalEvent: detail?.originalEvent instanceof MouseEvent,
    };
    log.push(record);
    console.log(`[${owner}] an-button-click`, record, detail?.originalEvent);
  });

  return log;
}
