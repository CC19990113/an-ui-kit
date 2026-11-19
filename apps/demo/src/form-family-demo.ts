/**
 * 表单族（7 个新增组件）在四个 demo 页面上的共用行为。
 *
 * 页面本身只负责同构的 `data-testid` 契约；这里统一做三件事：
 * 1. 把 DOM 上真实发生的组件事件记录进 `window.__familyState`（e2e 的稳定读口）
 * 2. 把 `an-form-submit` 的 FormData / values 回显到 `[data-testid="family-output"]`
 * 3. 把 `an-form-invalid` 的字段错误渲染到 `[data-testid="family-errors"]`
 *
 * 事件都在 document 级监听（组件事件都是 composed + bubbles），
 * 所以 React / Vue 页面还没挂载时调用 `installFormFamilyDemo()` 也安全。
 */
import '@an-ui-kit/elements';

/** 一条组件事件记录（只留 e2e 需要的字段）。 */
export interface FamilyEventRecord {
  type: string;
  id: string | null;
  value?: string | string[] | number | null;
  values?: string[];
  start?: string;
  end?: string;
  added?: string[];
  removed?: string[];
  file?: string;
  reason?: string;
}

/** 一个提交条目的 JSON 快照；File 只留元数据。 */
export interface FamilyEntryRecord {
  name: string;
  value: string | string[];
  file?: { name: string; size: number; type: string };
}

/** `window.__familyState`：事件 + 最近一次提交/校验结果。 */
export interface FamilyDemoState {
  submit: number;
  invalid: number;
  reset: number;
  events: FamilyEventRecord[];
  values: Record<string, string | string[]>;
  entries: FamilyEntryRecord[];
  errors: Array<{ name: string; message: string }>;
  validation: { valid: boolean; fields: string[] } | null;
}

declare global {
  interface Window {
    /** 表单族 demo 的事件与提交状态。 */
    __familyState: FamilyDemoState;
  }
}

/** 事件数组上限，避免长会话把内存吃光。 */
const MAX_EVENTS = 200;

/** 读事件 target 上的 data-testid；Shadow DOM 内的 target 走 composedPath 找宿主。 */
function testIdOf(event: Event): string | null {
  const path = event.composedPath();
  for (const node of path) {
    if (node instanceof Element) {
      const id = node.getAttribute('data-testid');
      if (id !== null) return id;
    }
  }
  return null;
}

/** File 的 JSON 快照。 */
function fileSummary(file: File): { name: string; size: number; type: string } {
  return { name: file.name, size: file.size, type: file.type };
}

/** 把 FormData 拍平成 e2e 好断言的条目数组。 */
function entriesOf(data: FormData): FamilyEntryRecord[] {
  const entries: FamilyEntryRecord[] = [];
  for (const [name, value] of data.entries()) {
    if (typeof value === 'string') {
      entries.push({ name, value });
    } else {
      entries.push({ name, value: fileSummary(value).name, file: fileSummary(value) });
    }
  }
  return entries;
}

/** 把 values 合并成 JSON-safe 结构（重复 name 变数组）。 */
function valuesOf(data: FormData): Record<string, string | string[]> {
  const values: Record<string, string | string[]> = {};
  for (const [name, entry] of data.entries()) {
    const value = typeof entry === 'string' ? entry : entry.name;
    const current = values[name];
    if (current === undefined) values[name] = value;
    else if (Array.isArray(current)) current.push(value);
    else values[name] = [current, value];
  }
  return values;
}

/** 找到页面上的回显节点（挂载顺序无关）。 */
function outputOf(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-testid="family-output"]');
}

/** 找到错误列表容器。 */
function errorsOf(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-testid="family-errors"]');
}

/** 渲染提交回显。 */
function renderOutput(state: FamilyDemoState): void {
  const output = outputOf();
  if (output === null) return;
  output.textContent = JSON.stringify({ values: state.values, entries: state.entries }, null, 2);
}

/** 渲染校验错误列表。 */
function renderErrors(state: FamilyDemoState): void {
  const box = errorsOf();
  if (box === null) return;
  box.replaceChildren();
  if (state.errors.length === 0) return;
  const list = document.createElement('ul');
  for (const error of state.errors) {
    const item = document.createElement('li');
    item.setAttribute('data-testid', 'family-error-item');
    item.textContent = `${error.name || '(未命名控件)'}: ${error.message}`;
    list.append(item);
  }
  box.append(list);
}

/** 往事件数组里追加一条记录（保留最近 MAX_EVENTS 条）。 */
function pushEvent(state: FamilyDemoState, record: FamilyEventRecord): void {
  state.events.push(record);
  if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS);
}

/**
 * 安装表单族 demo 的行为。重复调用是安全的（只装一次）。
 * 返回是否真的安装了。
 */
export function installFormFamilyDemo(): boolean {
  if (window.__familyState !== undefined) return false;

  const state: FamilyDemoState = {
    submit: 0,
    invalid: 0,
    reset: 0,
    events: [],
    values: {},
    entries: [],
    errors: [],
    validation: null,
  };
  window.__familyState = state;

  const listen = <T extends Event>(type: string, normalize: (event: T) => FamilyEventRecord) => {
    document.addEventListener(type, (event) => {
      const detail = (event as CustomEvent).detail;
      if (detail === undefined || detail === null) return;
      pushEvent(state, normalize(event as T));
    });
  };

  listen<CustomEvent<{ value: string; values: string[] }>>('an-select-change', (event) => ({
    type: 'an-select-change',
    id: testIdOf(event),
    value: event.detail.value,
    values: [...event.detail.values],
  }));

  listen<CustomEvent<{ added: File[]; removed: File[] }>>('an-upload-change', (event) => ({
    type: 'an-upload-change',
    id: testIdOf(event),
    added: event.detail.added.map((file) => file.name),
    removed: event.detail.removed.map((file) => file.name),
  }));

  listen<CustomEvent<{ file: File; reason: string }>>('an-upload-reject', (event) => ({
    type: 'an-upload-reject',
    id: testIdOf(event),
    file: event.detail.file.name,
    reason: event.detail.reason,
  }));

  listen<CustomEvent<{ value: number | null }>>('an-number-change', (event) => ({
    type: 'an-number-change',
    id: testIdOf(event),
    value: event.detail.value,
  }));

  listen<CustomEvent<{ value: string }>>('an-date-change', (event) => ({
    type: 'an-date-change',
    id: testIdOf(event),
    value: event.detail.value,
  }));

  listen<CustomEvent<{ start: string; end: string }>>('an-date-range-change', (event) => ({
    type: 'an-date-range-change',
    id: testIdOf(event),
    start: event.detail.start,
    end: event.detail.end,
  }));

  listen<CustomEvent<{ value: string[] }>>('an-checkbox-group-change', (event) => ({
    type: 'an-checkbox-group-change',
    id: testIdOf(event),
    values: [...event.detail.value],
  }));

  document.addEventListener('an-form-submit', (event) => {
    const detail = (event as CustomEvent<{ formData: FormData; values: Record<string, string> }>)
      .detail;
    if (detail === undefined) return;
    state.submit += 1;
    state.errors = [];
    state.values = valuesOf(detail.formData);
    state.entries = entriesOf(detail.formData);
    pushEvent(state, {
      type: 'an-form-submit',
      id: testIdOf(event),
      values: [...new Set(detail.formData.keys())],
    });
    renderErrors(state);
    renderOutput(state);
  });

  document.addEventListener('an-form-invalid', (event) => {
    const detail = (event as CustomEvent<{ fields: Array<{ name: string; message: string }> }>)
      .detail;
    if (detail === undefined) return;
    state.invalid += 1;
    state.errors = detail.fields.map((field) => ({ name: field.name, message: field.message }));
    pushEvent(state, {
      type: 'an-form-invalid',
      id: testIdOf(event),
      values: state.errors.map((error) => error.name),
    });
    renderErrors(state);
  });

  document.addEventListener('an-form-reset', (event) => {
    state.reset += 1;
    state.values = {};
    state.entries = [];
    state.errors = [];
    pushEvent(state, { type: 'an-form-reset', id: testIdOf(event) });
    renderErrors(state);
    renderOutput(state);
  });

  return true;
}
