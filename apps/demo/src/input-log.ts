/**
 * 三个框架页共用的 `<an-input>` 事件记录器。
 *
 * e2e 用 `window.__anInputLog` 证明 DOM 上真的发生了 `an-input` / `an-change`，
 * 并核对 `detail.value`（happy-dom 没有 FACE 与真实事件链，这部分只有真浏览器能验）。
 */
export interface InputEventRecord {
  /** 触发事件的 `<an-input>` 上的 data-testid。 */
  id: string | null;
  /** 事件 target 的标签名，应为 `an-input`（不是 Shadow DOM 内部 input）。 */
  tag: string;
  /** 事件名。 */
  kind: 'an-input' | 'an-change';
  /** 事件 `detail.value` —— 组件派发时带上的当前值。 */
  value: string;
  bubbles: boolean;
  composed: boolean;
}

declare global {
  interface Window {
    __anInputLog: InputEventRecord[];
  }
}

export function installInputLog(owner: string): InputEventRecord[] {
  const log: InputEventRecord[] = (window.__anInputLog = []);

  const record = (kind: InputEventRecord['kind']) => (event: Event): void => {
    const target = event.target as Element | null;
    const detail = (event as CustomEvent<{ value?: string; originalEvent?: unknown }>).detail;
    const entry: InputEventRecord = {
      id: target?.getAttribute?.('data-testid') ?? null,
      tag: target?.tagName?.toLowerCase() ?? 'unknown',
      kind,
      value: detail?.value ?? '',
      bubbles: event.bubbles,
      composed: event.composed,
    };
    log.push(entry);
    console.log(`[${owner}] ${kind}`, entry, detail?.originalEvent);
  };

  document.addEventListener('an-input', record('an-input'));
  document.addEventListener('an-change', record('an-change'));

  return log;
}
