/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * happy-dom 21 implements neither `HTMLElement.attachInternals()` nor
 * form-associated custom elements, so the platform slice `<an-upload>` builds on
 * is shimmed here:
 *
 * - `attachInternals()` returns the subset `AnElement` touches (`form`,
 *   `setFormValue`, `setValidity`, `validity`, `validationMessage`,
 *   `checkValidity`, `reportValidity`).
 * - `new FormData(form)` picks the registered value up, like the real entry
 *   list, including `FormData` payloads (the component registers one entry per
 *   file).
 *
 * The shims live in this file (not `test/helpers/`) because the upload task is
 * scoped to `src/upload/**` + `test/an-upload.test.ts`: `helpers/form-internals`
 * only models string values, and FormData registration is the whole point here.
 */

interface ShimRecord {
  element: HTMLElement;
  value: FormData | File | string | null;
  flags: Record<string, boolean>;
  message: string;
}

const internalsRecords: ShimRecord[] = [];

/** The platform `FormData`, captured before the test shim replaces it. */
const NativeFormData = globalThis.FormData;

function createInternals(element: HTMLElement): ElementInternals {
  const record: ShimRecord = { element, value: null, flags: {}, message: '' };
  internalsRecords.push(record);
  const touched = (): boolean => Object.values(record.flags).some(Boolean);
  const internals = {
    get form(): HTMLFormElement | null {
      return element.closest('form');
    },
    setFormValue(value: FormData | File | string | null): void {
      record.value = value;
    },
    setValidity(flags: Record<string, boolean>, message?: string): void {
      record.flags = { ...flags };
      record.message = message ?? '';
    },
    get validity(): Record<string, boolean> {
      return {
        valid: !touched(),
        valueMissing: false,
        typeMismatch: false,
        patternMismatch: false,
        tooLong: false,
        tooShort: false,
        rangeUnderflow: false,
        rangeOverflow: false,
        stepMismatch: false,
        badInput: false,
        customError: false,
        ...record.flags,
      };
    },
    get validationMessage(): string {
      return touched() ? record.message : '';
    },
    checkValidity(): boolean {
      return !touched();
    },
    reportValidity(): boolean {
      return !touched();
    },
  };
  return internals as unknown as ElementInternals;
}

Object.defineProperty(HTMLElement.prototype, 'attachInternals', {
  configurable: true,
  writable: true,
  value: function attachInternals(this: HTMLElement): ElementInternals {
    return createInternals(this);
  },
});

/** `FormData` that also merges the value each form-associated element registered. */
class ShimFormData extends NativeFormData {
  constructor(form?: HTMLFormElement) {
    if (form) super(form);
    else super();
    if (!form) return;
    for (const record of internalsRecords) {
      if (record.value === null) continue;
      if (record.element.closest('form') !== form) continue;
      if (record.value instanceof NativeFormData) {
        for (const [key, value] of record.value.entries()) this.append(key, value);
      } else {
        const name = record.element.getAttribute('name');
        if (name) this.append(name, record.value);
      }
    }
  }
}

Object.defineProperty(globalThis, 'FormData', {
  configurable: true,
  writable: true,
  value: ShimFormData,
});

import { AnUpload, createXhrUploader } from '../src/upload/an-upload';
import type {
  AnUploadAbortDetail,
  AnUploadChangeDetail,
  AnUploadContext,
  AnUploadErrorDetail,
  AnUploadProgressDetail,
  AnUploadRejectDetail,
  AnUploadSuccessDetail,
  AnUploader,
} from '../src/upload/an-upload';
import uploadCssSource from '../src/upload/an-upload.css?inline';
import { componentSuite } from './helpers/harness';

// The test file defines the element itself (never `src/index`) so a second
// registration elsewhere cannot throw "already defined".
if (typeof customElements !== 'undefined' && !customElements.get('an-upload')) {
  customElements.define('an-upload', AnUpload);
}

const CSS_VARS = [
  '--an-upload-bg',
  '--an-upload-border-color',
  '--an-upload-button-bg',
  '--an-upload-button-border-color',
  '--an-upload-button-color',
  '--an-upload-button-font-size',
  '--an-upload-button-radius',
  '--an-upload-dragover-border-color',
  '--an-upload-dropzone-gap',
  '--an-upload-dropzone-padding',
  '--an-upload-empty-color',
  '--an-upload-error-color',
  '--an-upload-error-font-size',
  '--an-upload-fg',
  '--an-upload-focus-ring',
  '--an-upload-font-size',
  '--an-upload-gap',
  '--an-upload-hint-color',
  '--an-upload-hint-font-size',
  '--an-upload-item-bg',
  '--an-upload-item-border-color',
  '--an-upload-item-gap',
  '--an-upload-item-padding',
  '--an-upload-item-radius',
  '--an-upload-list-gap',
  '--an-upload-name-font-size',
  '--an-upload-preview-bg',
  '--an-upload-preview-radius',
  '--an-upload-preview-size',
  '--an-upload-progress-color',
  '--an-upload-progress-height',
  '--an-upload-progress-track',
  '--an-upload-radius',
  '--an-upload-size-color',
  '--an-upload-size-font-size',
  '--an-upload-trigger-bg',
  '--an-upload-trigger-fg',
  '--an-upload-trigger-font-size',
  '--an-upload-trigger-height',
  '--an-upload-trigger-padding-x',
  '--an-upload-trigger-radius',
];

componentSuite({
  tag: 'an-upload',
  ctor: AnUpload,
  defaults: {
    name: '',
    accept: '',
    multiple: false,
    maxFiles: 0,
    maxSize: 0,
    disabled: false,
    required: false,
    action: '',
    method: 'POST',
    fieldName: '',
    size: 'md',
  },
  events: [
    'an-upload-change',
    'an-upload-reject',
    'an-upload-progress',
    'an-upload-success',
    'an-upload-error',
    'an-upload-abort',
  ],
  cssVars: CSS_VARS,
  parts: ['base', 'dropzone', 'trigger', 'list', 'empty'],
});

type AttributeMap = Record<string, string | number | boolean>;

/** Mounts an `<an-upload>` with attributes already applied. */
function mount(attributes: AttributeMap = {}, parent: HTMLElement = document.body): AnUpload {
  const element = document.createElement('an-upload') as AnUpload;
  for (const [name, value] of Object.entries(attributes)) {
    if (value === false) continue;
    element.setAttribute(name, value === true ? '' : String(value));
  }
  parent.append(element);
  return element;
}

/** Shadow-DOM query with a readable failure instead of `null`. */
function inner<T extends Element>(element: AnUpload, selector: string): T {
  const found = element.shadowRoot!.querySelector<T>(selector);
  if (!found) throw new Error(`missing shadow element: ${selector}`);
  return found;
}

/** Builds a `File` of an exact byte size without allocating real content. */
function file(name: string, type = 'text/plain', size = 10): File {
  return new File([new Uint8Array(size)], name, { type });
}

/** Simulates the native picker: sets `input.files` then fires `change`. */
function select(element: AnUpload, files: File[]): void {
  const input = inner<HTMLInputElement>(element, 'input[type="file"]');
  Object.defineProperty(input, 'files', { configurable: true, value: files });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** A bubbling drag event carrying a `dataTransfer` mock. */
function dragEvent(type: string, files: File[] = []): Event {
  const event = new Event(type, { bubbles: true, composed: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { files, dropEffect: 'none' } });
  return event;
}

/** Collects every event of `name` as it is dispatched. */
function capture<T>(element: Element, name: string): T[] {
  const events: T[] = [];
  element.addEventListener(name, (event) => events.push(event as T));
  return events;
}

/** Lets queued promise continuations (upload success/error) run. */
function tick(): Promise<void> {
  return Promise.resolve();
}

interface FakeCall {
  file: File;
  context: AnUploadContext;
  resolve: (value?: unknown) => void;
  reject: (error: unknown) => void;
}

/** An uploader whose promises the test settles by hand, recording each call. */
function createFakeUploader(): { uploader: AnUploader; calls: FakeCall[] } {
  const calls: FakeCall[] = [];
  const uploader: AnUploader = (calledFile, context) =>
    new Promise((resolve, reject) => {
      calls.push({ file: calledFile, context, resolve, reject });
    });
  return { uploader, calls };
}

/** Minimal `XMLHttpRequest` that never touches the network. */
class MockXhr {
  static instances: MockXhr[] = [];

  method = '';
  url = '';
  status = 200;
  responseText = '';
  body: unknown = null;
  aborted = false;
  requestHeaders: Record<string, string> = {};
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor() {
    MockXhr.instances.push(this);
  }

  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string): void {
    this.requestHeaders[name] = value;
  }

  send(body: unknown): void {
    this.body = body;
  }

  abort(): void {
    this.aborted = true;
    this.onabort?.();
  }

  /** Reports upload progress. */
  progress(loaded: number, total: number): void {
    this.upload.onprogress?.({ loaded, total, lengthComputable: total > 0 } as ProgressEvent);
  }

  /** Completes the request with a status and body. */
  respond(status: number, responseText = ''): void {
    this.status = status;
    this.responseText = responseText;
    this.onload?.();
  }
}

let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;

beforeEach(() => {
  MockXhr.instances = [];
  createObjectURL = vi.fn(() => 'blob:preview');
  revokeObjectURL = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: createObjectURL,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: revokeObjectURL,
  });
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('an-upload rendering', () => {
  it('renders a keyboard-focusable dropzone, a hidden file input and the empty state', () => {
    const element = mount();
    const dropzone = inner<HTMLElement>(element, '.dropzone');
    expect(dropzone.getAttribute('role')).toBe('button');
    expect(dropzone.getAttribute('tabindex')).toBe('0');
    expect(dropzone.getAttribute('aria-label')).toBe('选择文件');

    const input = inner<HTMLInputElement>(element, 'input[type="file"]');
    expect(input.type).toBe('file');
    expect(input.hidden).toBe(true);

    expect(inner(element, '[part~="trigger"]').textContent).toContain('选择文件');
    expect(inner(element, '[part~="empty"]').textContent).toContain('未选择文件');
  });

  it('forwards accept, multiple and disabled to the inner input', () => {
    const element = mount({ accept: 'image/*,.pdf', multiple: true, disabled: true });
    const input = inner<HTMLInputElement>(element, 'input[type="file"]');
    expect(input.getAttribute('accept')).toBe('image/*,.pdf');
    expect(input.hasAttribute('multiple')).toBe(true);
    expect(input.hasAttribute('disabled')).toBe(true);
    expect(inner<HTMLElement>(element, '.dropzone').getAttribute('tabindex')).toBe('-1');
  });

  it('renders one list item per accepted file with name, size and progress', () => {
    const element = mount({ multiple: true });
    select(element, [file('a.txt', 'text/plain', 512), file('b.txt', 'text/plain', 2048)]);
    const items = element.shadowRoot!.querySelectorAll('[part~="item"]');
    expect(items).toHaveLength(2);
    expect(items[0].querySelector('[part~="item-name"]')!.textContent).toBe('a.txt');
    expect(items[0].querySelector('[part~="item-size"]')!.textContent).toBe('512 B');
    expect(items[1].querySelector('[part~="item-size"]')!.textContent).toBe('2 KB');
    expect(items[0].querySelector('[part~="item-progress"]')).not.toBeNull();
    expect(items[0].querySelector('[part~="item-remove"]')).not.toBeNull();
  });

  it('formats sizes in B, KB and MB', () => {
    const element = mount({ multiple: true });
    select(element, [
      file('b.bin', 'application/octet-stream', 512),
      file('kb.bin', 'application/octet-stream', 1536),
      file('mb.bin', 'application/octet-stream', 2 * 1024 * 1024),
    ]);
    const sizes = [...element.shadowRoot!.querySelectorAll('[part~="item-size"]')].map(
      (node) => node.textContent,
    );
    expect(sizes).toEqual(['512 B', '1.5 KB', '2 MB']);
  });

  it('renders a thumbnail only for images', () => {
    const element = mount({ multiple: true });
    select(element, [file('photo.png', 'image/png'), file('doc.txt', 'text/plain')]);
    const previews = element.shadowRoot!.querySelectorAll('[part~="item-preview"]');
    expect(previews[0].querySelector('img')?.getAttribute('src')).toBe('blob:preview');
    expect(previews[1].querySelector('img')).toBeNull();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('shows the cancel button only while a file is uploading', () => {
    const element = mount();
    const { uploader } = createFakeUploader();
    element.uploader = uploader;
    select(element, [file('a.txt')]);
    expect(element.shadowRoot!.querySelector('[part~="item-cancel"]')).not.toBeNull();
    element.abort(0);
    expect(element.shadowRoot!.querySelector('[part~="item-cancel"]')).toBeNull();
  });
});

describe('an-upload opening the picker', () => {
  it('opens the picker when the dropzone is clicked', () => {
    const element = mount();
    const input = inner<HTMLInputElement>(element, 'input[type="file"]');
    const click = vi.spyOn(input, 'click').mockImplementation(() => {});
    inner<HTMLElement>(element, '.dropzone').dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true }),
    );
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('opens the picker with Enter and Space but not with other keys', () => {
    const element = mount();
    const input = inner<HTMLInputElement>(element, 'input[type="file"]');
    const click = vi.spyOn(input, 'click').mockImplementation(() => {});
    const dropzone = inner<HTMLElement>(element, '.dropzone');

    dropzone.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true }));
    expect(click).not.toHaveBeenCalled();
    dropzone.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }),
    );
    expect(click).toHaveBeenCalledTimes(1);
    dropzone.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, composed: true }));
    expect(click).toHaveBeenCalledTimes(2);
  });

  it('does not open the picker while disabled', () => {
    const element = mount({ disabled: true });
    const input = inner<HTMLInputElement>(element, 'input[type="file"]');
    const click = vi.spyOn(input, 'click').mockImplementation(() => {});
    expect(element.open).toBeTypeOf('function');
    element.open();
    inner<HTMLElement>(element, '.dropzone').dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true }),
    );
    expect(click).not.toHaveBeenCalled();
  });

  it('does not open the picker when an item button is clicked', () => {
    const element = mount();
    select(element, [file('a.txt')]);
    const input = inner<HTMLInputElement>(element, 'input[type="file"]');
    const click = vi.spyOn(input, 'click').mockImplementation(() => {});
    inner<HTMLElement>(element, '[part~="item-remove"]').dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true }),
    );
    expect(click).not.toHaveBeenCalled();
    expect(element.files).toHaveLength(0);
  });
});

describe('an-upload validation', () => {
  it('adds accepted files and reports them through an-upload-change', () => {
    const element = mount();
    const changes = capture<CustomEvent<AnUploadChangeDetail>>(element, 'an-upload-change');
    select(element, [file('a.txt')]);
    expect(element.files.map((item) => item.name)).toEqual(['a.txt']);
    expect(changes).toHaveLength(1);
    expect(changes[0].detail.added.map((item) => item.name)).toEqual(['a.txt']);
    expect(changes[0].detail.removed).toEqual([]);
    expect(changes[0].detail.files.map((item) => item.name)).toEqual(['a.txt']);
  });

  it('adds several files in one selection', () => {
    const element = mount({ multiple: true });
    select(element, [file('a.txt'), file('b.txt'), file('c.txt')]);
    expect(element.files.map((item) => item.name)).toEqual(['a.txt', 'b.txt', 'c.txt']);
    expect(element.shadowRoot!.querySelectorAll('[part~="item"]')).toHaveLength(3);
  });

  it('rejects a MIME type outside accept', () => {
    const element = mount({ accept: 'image/*' });
    const rejects = capture<CustomEvent<AnUploadRejectDetail>>(element, 'an-upload-reject');
    select(element, [file('a.txt', 'text/plain')]);
    expect(element.files).toHaveLength(0);
    expect(rejects).toHaveLength(1);
    expect(rejects[0].detail.reason).toBe('type');
    expect(rejects[0].detail.file.name).toBe('a.txt');
  });

  it('accepts image/* wildcards and exact MIME types', () => {
    const element = mount({ accept: 'image/*,application/pdf' });
    select(element, [file('a.png', 'image/png'), file('b.pdf', 'application/pdf')]);
    expect(element.files.map((item) => item.name)).toEqual(['a.png', 'b.pdf']);
  });

  it('accepts extension tokens such as .png', () => {
    const element = mount({ accept: '.png' });
    select(element, [file('a.png', 'image/png'), file('b.txt', 'text/plain')]);
    expect(element.files.map((item) => item.name)).toEqual(['a.png']);
  });

  it('rejects files above max-size', () => {
    const element = mount({ 'max-size': 100 });
    const rejects = capture<CustomEvent<AnUploadRejectDetail>>(element, 'an-upload-reject');
    select(element, [file('big.bin', 'application/octet-stream', 101), file('ok.bin', 'application/octet-stream', 100)]);
    expect(element.files.map((item) => item.name)).toEqual(['ok.bin']);
    expect(rejects).toHaveLength(1);
    expect(rejects[0].detail.reason).toBe('size');
  });

  it('rejects files beyond max-files and keeps the earlier ones', () => {
    const element = mount({ 'max-files': 2 });
    const rejects = capture<CustomEvent<AnUploadRejectDetail>>(element, 'an-upload-reject');
    select(element, [file('a.txt'), file('b.txt'), file('c.txt')]);
    expect(element.files.map((item) => item.name)).toEqual(['a.txt', 'b.txt']);
    expect(rejects).toHaveLength(1);
    expect(rejects[0].detail.reason).toBe('max-files');
  });

  it('rejects everything when accept matches nothing', () => {
    const element = mount({ accept: 'image/png' });
    const rejects = capture<CustomEvent<AnUploadRejectDetail>>(element, 'an-upload-reject');
    select(element, [file('a.txt', 'text/plain'), file('b.png', 'image/png')]);
    expect(element.files.map((item) => item.name)).toEqual(['b.png']);
    expect(rejects).toHaveLength(1);
  });

  it('exposes a read-only snapshot of files', () => {
    const element = mount();
    select(element, [file('a.txt')]);
    const snapshot = element.files;
    snapshot.push(file('b.txt'));
    expect(element.files).toHaveLength(1);
  });
});

describe('an-upload drag and drop', () => {
  it('adds dropped files', () => {
    const element = mount();
    const dropped = dragEvent('drop', [file('a.txt'), file('b.txt')]);
    inner<HTMLElement>(element, '.dropzone').dispatchEvent(dropped);
    expect(element.files).toHaveLength(2);
    expect(dropped.defaultPrevented).toBe(true);
  });

  it('tracks dragenter/dragleave with a counter so children do not flicker', () => {
    const element = mount();
    const dropzone = inner<HTMLElement>(element, '.dropzone');
    const trigger = inner<HTMLElement>(element, '[part~="trigger"]');

    dropzone.dispatchEvent(dragEvent('dragenter'));
    expect(dropzone.hasAttribute('data-dragover')).toBe(true);
    trigger.dispatchEvent(dragEvent('dragenter'));
    dropzone.dispatchEvent(dragEvent('dragleave'));
    expect(dropzone.hasAttribute('data-dragover')).toBe(true);
    dropzone.dispatchEvent(dragEvent('dragleave'));
    expect(dropzone.hasAttribute('data-dragover')).toBe(false);
  });

  it('prevents the default dragover behaviour and clears drag state on drop', () => {
    const element = mount();
    const dropzone = inner<HTMLElement>(element, '.dropzone');
    dropzone.dispatchEvent(dragEvent('dragenter'));
    const over = dragEvent('dragover');
    dropzone.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
    dropzone.dispatchEvent(dragEvent('drop', [file('a.txt')]));
    expect(dropzone.hasAttribute('data-dragover')).toBe(false);
  });

  it('ignores drops while disabled', () => {
    const element = mount({ disabled: true });
    const dropped = dragEvent('drop', [file('a.txt')]);
    inner<HTMLElement>(element, '.dropzone').dispatchEvent(dropped);
    expect(element.files).toHaveLength(0);
    expect(dropped.defaultPrevented).toBe(true);
  });
});

describe('an-upload list actions', () => {
  it('removes a file by index and reports it', () => {
    const element = mount({ multiple: true });
    select(element, [file('a.txt'), file('b.txt')]);
    const changes = capture<CustomEvent<AnUploadChangeDetail>>(element, 'an-upload-change');
    element.remove(0);
    expect(element.files.map((item) => item.name)).toEqual(['b.txt']);
    expect(changes).toHaveLength(1);
    expect(changes[0].detail.removed.map((item) => item.name)).toEqual(['a.txt']);
  });

  it('removes a file by reference', () => {
    const element = mount({ multiple: true });
    const target = file('b.txt');
    select(element, [file('a.txt'), target]);
    element.remove(target);
    expect(element.files.map((item) => item.name)).toEqual(['a.txt']);
  });

  it('ignores an unknown file reference and a negative index', () => {
    const element = mount();
    select(element, [file('a.txt')]);
    element.remove(file('other.txt'));
    element.remove(-1);
    expect(element.files).toHaveLength(1);
  });

  it('clears every file and reports the removed snapshot', () => {
    const element = mount({ multiple: true });
    select(element, [file('a.txt'), file('b.txt')]);
    const changes = capture<CustomEvent<AnUploadChangeDetail>>(element, 'an-upload-change');
    element.clear();
    expect(element.files).toHaveLength(0);
    expect(element.shadowRoot!.querySelectorAll('[part~="item"]')).toHaveLength(0);
    expect(inner(element, '[part~="empty"]')).not.toBeNull();
    expect(changes[0].detail.files).toEqual([]);
    expect(changes[0].detail.removed.map((item) => item.name)).toEqual(['a.txt', 'b.txt']);
  });

  it('revokes the object URL when a file is removed', () => {
    const element = mount();
    select(element, [file('a.png', 'image/png')]);
    element.remove(0);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });

  it('revokes every object URL when the element is disconnected', () => {
    const element = mount({ multiple: true });
    select(element, [file('a.png', 'image/png'), file('b.png', 'image/png')]);
    element.parentElement!.removeChild(element);
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it('aborts a running upload when its file is removed', () => {
    const element = mount();
    const { uploader, calls } = createFakeUploader();
    element.uploader = uploader;
    const aborts = capture<CustomEvent<AnUploadAbortDetail>>(element, 'an-upload-abort');
    select(element, [file('a.txt')]);
    element.remove(0);
    expect(calls[0].context.signal.aborted).toBe(true);
    expect(aborts).toHaveLength(1);
    expect(element.files).toHaveLength(0);
  });

  it('aborts all running uploads on clear', () => {
    const element = mount({ multiple: true });
    const { uploader, calls } = createFakeUploader();
    element.uploader = uploader;
    const aborts = capture<CustomEvent<AnUploadAbortDetail>>(element, 'an-upload-abort');
    select(element, [file('a.txt'), file('b.txt')]);
    element.clear();
    expect(calls.every((call) => call.context.signal.aborted)).toBe(true);
    expect(aborts).toHaveLength(2);
  });
});

describe('an-upload lifecycle and disabled state', () => {
  it('ignores selected files while disabled', () => {
    const element = mount({ disabled: true });
    select(element, [file('a.txt')]);
    expect(element.files).toHaveLength(0);
  });

  it('stops accepting dropped files once the property is disabled', () => {
    const element = mount();
    select(element, [file('a.txt')]);
    element.disabled = true;
    select(element, [file('b.txt')]);
    expect(element.files).toHaveLength(1);
    element.disabled = false;
    select(element, [file('b.txt')]);
    expect(element.files).toHaveLength(2);
  });
});

describe('an-upload uploading', () => {
  it('auto-uploads with a custom uploader by default', () => {
    const element = mount();
    const { uploader, calls } = createFakeUploader();
    element.uploader = uploader;
    select(element, [file('a.txt')]);
    expect(calls).toHaveLength(1);
    expect(calls[0].file.name).toBe('a.txt');
    expect(calls[0].context.signal).toBeInstanceOf(AbortSignal);
  });

  it('does not auto-upload when auto-upload is false, then start() queues it', () => {
    const element = mount({ 'auto-upload': 'false' });
    const { uploader, calls } = createFakeUploader();
    element.uploader = uploader;
    select(element, [file('a.txt')]);
    expect(calls).toHaveLength(0);
    element.start();
    expect(calls).toHaveLength(1);
  });

  it('treats autoUpload as a default-true property that reflects to the attribute', () => {
    const element = mount();
    expect(element.autoUpload).toBe(true);
    element.autoUpload = false;
    expect(element.autoUpload).toBe(false);
    expect(element.hasAttribute('auto-upload')).toBe(false);
    element.autoUpload = true;
    expect(element.hasAttribute('auto-upload')).toBe(true);
    element.setAttribute('auto-upload', 'false');
    expect(element.autoUpload).toBe(false);
  });

  it('does nothing on start() without a transport', () => {
    const element = mount();
    select(element, [file('a.txt')]);
    expect(() => element.start()).not.toThrow();
    expect(inner(element, '.item').getAttribute('data-status')).toBe('idle');
  });

  it('reports progress with bytes and percent, and renders the bar', () => {
    const element = mount();
    const { uploader, calls } = createFakeUploader();
    element.uploader = uploader;
    const progress = capture<CustomEvent<AnUploadProgressDetail>>(element, 'an-upload-progress');
    select(element, [file('a.txt', 'text/plain', 200)]);
    calls[0].context.onProgress(50, 200);
    expect(progress).toHaveLength(1);
    expect(progress[0].detail).toMatchObject({ loaded: 50, total: 200, percent: 25 });
    expect(progress[0].detail.file.name).toBe('a.txt');
    expect(inner<HTMLElement>(element, '.item-progress .bar').style.width).toBe('25%');
    expect(inner(element, '.item-progress').getAttribute('aria-valuenow')).toBe('25');
  });

  it('falls back to the file size when the uploader reports total 0', () => {
    const element = mount();
    const { uploader, calls } = createFakeUploader();
    element.uploader = uploader;
    const progress = capture<CustomEvent<AnUploadProgressDetail>>(element, 'an-upload-progress');
    select(element, [file('a.bin', 'application/octet-stream', 100)]);
    calls[0].context.onProgress(25, 0);
    expect(progress[0].detail.total).toBe(100);
    expect(progress[0].detail.percent).toBe(25);
  });

  it('reports success with the uploader response', async () => {
    const element = mount();
    const { uploader, calls } = createFakeUploader();
    element.uploader = uploader;
    const success = capture<CustomEvent<AnUploadSuccessDetail>>(element, 'an-upload-success');
    select(element, [file('a.txt')]);
    calls[0].resolve({ id: 7 });
    await tick();
    expect(success).toHaveLength(1);
    expect(success[0].detail.file.name).toBe('a.txt');
    expect(success[0].detail.response).toEqual({ id: 7 });
    expect(inner(element, '.item').getAttribute('data-status')).toBe('success');
    expect(inner<HTMLElement>(element, '.item-progress .bar').style.width).toBe('100%');
  });

  it('reports errors with the rejection message and an alert row', async () => {
    const element = mount();
    const { uploader, calls } = createFakeUploader();
    element.uploader = uploader;
    const errors = capture<CustomEvent<AnUploadErrorDetail>>(element, 'an-upload-error');
    select(element, [file('a.txt')]);
    calls[0].reject(new Error('boom'));
    await tick();
    expect(errors).toHaveLength(1);
    expect((errors[0].detail.error as Error).message).toBe('boom');
    expect(inner(element, '.item').getAttribute('data-status')).toBe('error');
    const error = inner<HTMLElement>(element, '[part~="item-error"]');
    expect(error.getAttribute('role')).toBe('alert');
    expect(error.textContent).toBe('boom');
  });

  it('limits in-flight uploads to concurrency (default 3)', () => {
    const element = mount({ multiple: true });
    const started: File[] = [];
    element.uploader = (calledFile) => {
      started.push(calledFile);
      return new Promise(() => {});
    };
    select(element, [file('a.txt'), file('b.txt'), file('c.txt'), file('d.txt'), file('e.txt')]);
    expect(started).toHaveLength(3);
    expect(
      [...element.shadowRoot!.querySelectorAll('[part~="item"]')].filter(
        (item) => item.getAttribute('data-status') === 'uploading',
      ),
    ).toHaveLength(3);
  });

  it('honours a custom concurrency limit', () => {
    const element = mount({ multiple: true });
    element.concurrency = 1;
    const started: File[] = [];
    element.uploader = (calledFile) => {
      started.push(calledFile);
      return new Promise(() => {});
    };
    select(element, [file('a.txt'), file('b.txt')]);
    expect(started).toHaveLength(1);
  });

  it('starts the next queued file when one finishes', async () => {
    const element = mount({ multiple: true });
    element.concurrency = 1;
    const { uploader, calls } = createFakeUploader();
    element.uploader = uploader;
    select(element, [file('a.txt'), file('b.txt')]);
    expect(calls).toHaveLength(1);
    calls[0].resolve('done');
    await tick();
    expect(calls).toHaveLength(2);
  });

  it('retries a failed file on an explicit start()', async () => {
    const element = mount();
    const { uploader, calls } = createFakeUploader();
    element.uploader = uploader;
    select(element, [file('a.txt')]);
    calls[0].reject(new Error('boom'));
    await tick();
    expect(calls).toHaveLength(1);
    expect(inner(element, '.item').getAttribute('data-status')).toBe('error');
    element.start();
    expect(calls).toHaveLength(2);
  });

  it('aborts one upload and leaves the others running', () => {
    const element = mount({ multiple: true });
    const { uploader, calls } = createFakeUploader();
    element.uploader = uploader;
    const aborts = capture<CustomEvent<AnUploadAbortDetail>>(element, 'an-upload-abort');
    select(element, [file('a.txt'), file('b.txt')]);
    element.abort(0);
    expect(aborts).toHaveLength(1);
    expect(calls[0].context.signal.aborted).toBe(true);
    expect(calls[1].context.signal.aborted).toBe(false);
    expect(element.files).toHaveLength(2);
  });

  it('ignores abort() for a file that is not uploading', () => {
    const element = mount({ 'auto-upload': 'false' });
    const aborts = capture<CustomEvent<AnUploadAbortDetail>>(element, 'an-upload-abort');
    select(element, [file('a.txt')]);
    element.abort(0);
    expect(aborts).toHaveLength(0);
  });

  it('uses the built-in XHR uploader when action is set', async () => {
    vi.stubGlobal('XMLHttpRequest', MockXhr);
    const element = mount({ action: '/api/upload', 'field-name': 'asset' });
    element.headers = { 'X-Token': 'secret' };
    const success = capture<CustomEvent<AnUploadSuccessDetail>>(element, 'an-upload-success');
    const progress = capture<CustomEvent<AnUploadProgressDetail>>(element, 'an-upload-progress');
    const picked = file('a.txt');
    select(element, [picked]);

    expect(MockXhr.instances).toHaveLength(1);
    const xhr = MockXhr.instances[0];
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe('/api/upload');
    expect(xhr.requestHeaders['X-Token']).toBe('secret');
    expect((xhr.body as FormData).get('asset')).toBe(picked);

    xhr.progress(40, 80);
    expect(progress[0].detail.percent).toBe(50);

    xhr.respond(200, '{"id":9}');
    await tick();
    expect(success[0].detail.response).toEqual({ id: 9 });
  });

  it('prefers a custom uploader over action', () => {
    vi.stubGlobal('XMLHttpRequest', MockXhr);
    const element = mount({ action: '/api/upload' });
    const { uploader, calls } = createFakeUploader();
    element.uploader = uploader;
    select(element, [file('a.txt')]);
    expect(calls).toHaveLength(1);
    expect(MockXhr.instances).toHaveLength(0);
  });
});

describe('an-upload form association', () => {
  function mountInForm(attributes: AttributeMap = {}): { form: HTMLFormElement; element: AnUpload } {
    const form = document.createElement('form');
    document.body.append(form);
    return { form, element: mount(attributes, form) };
  }

  it('registers every file in FormData under name', () => {
    const { form, element } = mountInForm({ name: 'docs', multiple: true });
    select(element, [file('a.txt'), file('b.txt')]);
    const data = new FormData(form);
    expect(data.getAll('docs')).toHaveLength(2);
    expect((data.getAll('docs')[0] as File).name).toBe('a.txt');
  });

  it('prefers field-name over name', () => {
    const { form, element } = mountInForm({ name: 'docs', 'field-name': 'files' });
    select(element, [file('a.txt')]);
    const data = new FormData(form);
    expect(data.getAll('files')).toHaveLength(1);
    expect(data.getAll('docs')).toHaveLength(0);
  });

  it('registers nothing without a name', () => {
    const { form, element } = mountInForm();
    select(element, [file('a.txt')]);
    expect([...new FormData(form).keys()]).toEqual([]);
  });

  it('drops the entry again when the last file is removed', () => {
    const { form, element } = mountInForm({ name: 'docs' });
    select(element, [file('a.txt')]);
    expect(new FormData(form).getAll('docs')).toHaveLength(1);
    element.remove(0);
    expect(new FormData(form).getAll('docs')).toHaveLength(0);
  });

  it('is invalid while required and empty, and valid once a file is added', () => {
    const { element } = mountInForm({ name: 'docs', required: true });
    expect(element.checkValidity()).toBe(false);
    expect(element.validity?.valueMissing).toBe(true);
    expect(element.validationMessage).toBe('此字段为必填项。');
    expect(inner(element, '.dropzone').getAttribute('aria-invalid')).toBe('true');

    select(element, [file('a.txt')]);
    expect(element.checkValidity()).toBe(true);
    expect(element.validity?.valueMissing).toBe(false);
    expect(element.validationMessage).toBe('');
    expect(inner(element, '.dropzone').hasAttribute('aria-invalid')).toBe(false);
  });

  it('is always valid when not required', () => {
    const { element } = mountInForm({ name: 'docs' });
    expect(element.checkValidity()).toBe(true);
    expect(element.validity?.valueMissing).toBe(false);
  });

  it('excludes a disabled control from FormData and from validation', () => {
    const { form, element } = mountInForm({ name: 'docs', required: true, disabled: true });
    expect(new FormData(form).getAll('docs')).toHaveLength(0);
    expect(element.checkValidity()).toBe(true);
    expect(element.getFormData()).toBeNull();
  });

  it('honours a platform-level disable (disabled fieldset)', () => {
    const { form, element } = mountInForm({ name: 'docs', required: true });
    element.formDisabledCallback(true);
    expect(new FormData(form).getAll('docs')).toHaveLength(0);
    expect(element.checkValidity()).toBe(true);
    select(element, [file('a.txt')]);
    expect(element.files).toHaveLength(0);

    element.formDisabledCallback(false);
    select(element, [file('a.txt')]);
    expect(new FormData(form).getAll('docs')).toHaveLength(1);
    expect(element.checkValidity()).toBe(true);
  });

  it('serializes through getFormData()', () => {
    const { element } = mountInForm({ name: 'docs', multiple: true });
    select(element, [file('a.txt'), file('b.txt')]);
    const data = element.getFormData()!;
    expect(data.getAll('docs')).toHaveLength(2);
    element.clear();
    expect(element.getFormData()).toBeNull();
  });

  it('clears the queue and the form value on reset()', () => {
    const { form, element } = mountInForm({ name: 'docs' });
    select(element, [file('a.png', 'image/png')]);
    element.reset();
    expect(element.files).toHaveLength(0);
    expect(new FormData(form).getAll('docs')).toHaveLength(0);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });
});

describe('createXhrUploader', () => {
  const signal = (): AbortSignal => new AbortController().signal;

  it('POSTs one multipart file to the url by default', () => {
    vi.stubGlobal('XMLHttpRequest', MockXhr);
    const picked = file('a.txt');
    const uploader = createXhrUploader({ url: '/upload' });
    void uploader(picked, { signal: signal(), onProgress: vi.fn() });
    const xhr = MockXhr.instances[0];
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe('/upload');
    expect((xhr.body as FormData).get('file')).toBe(picked);
  });

  it('forwards method, headers and fieldName', () => {
    vi.stubGlobal('XMLHttpRequest', MockXhr);
    const uploader = createXhrUploader({
      url: '/upload',
      method: 'PUT',
      headers: { Authorization: 'Bearer t' },
      fieldName: 'asset',
    });
    const picked = file('a.txt');
    void uploader(picked, { signal: signal(), onProgress: vi.fn() });
    const xhr = MockXhr.instances[0];
    expect(xhr.method).toBe('PUT');
    expect(xhr.requestHeaders.Authorization).toBe('Bearer t');
    expect((xhr.body as FormData).get('asset')).toBe(picked);
  });

  it('resolves with the parsed JSON body on 2xx', async () => {
    vi.stubGlobal('XMLHttpRequest', MockXhr);
    const uploader = createXhrUploader({ url: '/upload' });
    const promise = uploader(file('a.txt'), { signal: signal(), onProgress: vi.fn() });
    MockXhr.instances[0].respond(201, '{"id":1}');
    await expect(promise).resolves.toEqual({ id: 1 });
  });

  it('resolves with raw text for a non-JSON body and null for an empty body', async () => {
    vi.stubGlobal('XMLHttpRequest', MockXhr);
    const uploader = createXhrUploader({ url: '/upload' });

    const textPromise = uploader(file('a.txt'), { signal: signal(), onProgress: vi.fn() });
    MockXhr.instances[0].respond(200, 'ok');
    await expect(textPromise).resolves.toBe('ok');

    const emptyPromise = uploader(file('b.txt'), { signal: signal(), onProgress: vi.fn() });
    MockXhr.instances[1].respond(204, '');
    await expect(emptyPromise).resolves.toBeNull();
  });

  it('rejects non-2xx responses with the status in the message', async () => {
    vi.stubGlobal('XMLHttpRequest', MockXhr);
    const uploader = createXhrUploader({ url: '/upload' });
    const promise = uploader(file('a.txt'), { signal: signal(), onProgress: vi.fn() });
    MockXhr.instances[0].respond(500, 'nope');
    await expect(promise).rejects.toThrow('HTTP 500');
  });

  it('rejects on a network error', async () => {
    vi.stubGlobal('XMLHttpRequest', MockXhr);
    const uploader = createXhrUploader({ url: '/upload' });
    const promise = uploader(file('a.txt'), { signal: signal(), onProgress: vi.fn() });
    MockXhr.instances[0].onerror?.();
    await expect(promise).rejects.toThrow('网络错误');
  });

  it('reports upload progress, falling back to the file size', () => {
    vi.stubGlobal('XMLHttpRequest', MockXhr);
    const onProgress = vi.fn();
    const picked = file('a.bin', 'application/octet-stream', 80);
    const uploader = createXhrUploader({ url: '/upload' });
    void uploader(picked, { signal: signal(), onProgress });
    MockXhr.instances[0].progress(20, 80);
    expect(onProgress).toHaveBeenLastCalledWith(20, 80);
    MockXhr.instances[0].progress(40, 0);
    expect(onProgress).toHaveBeenLastCalledWith(40, 80);
  });

  it('aborts the request and rejects with AbortError when the signal fires', async () => {
    vi.stubGlobal('XMLHttpRequest', MockXhr);
    const controller = new AbortController();
    const uploader = createXhrUploader({ url: '/upload' });
    const promise = uploader(file('a.txt'), {
      signal: controller.signal,
      onProgress: vi.fn(),
    });
    controller.abort();
    expect(MockXhr.instances[0].aborted).toBe(true);
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects immediately for an already aborted signal', async () => {
    vi.stubGlobal('XMLHttpRequest', MockXhr);
    const controller = new AbortController();
    controller.abort();
    const uploader = createXhrUploader({ url: '/upload' });
    await expect(
      uploader(file('a.txt'), { signal: controller.signal, onProgress: vi.fn() }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(MockXhr.instances).toHaveLength(0);
  });
});

describe('an-upload stylesheet contract', () => {
  it('uses every documented hook with a fallback and both theme entry points', () => {
    for (const hook of CSS_VARS) {
      expect(uploadCssSource, hook).toContain(`var(${hook},`);
    }
    expect(uploadCssSource).toContain('color-scheme: light dark');
    expect(uploadCssSource).toContain(":host([data-theme='dark'])");
    expect(uploadCssSource).toContain(":host([data-theme='light'])");
    expect(uploadCssSource).toContain('--an-color-fg-1');
    expect(uploadCssSource).toContain('--an-color-bg-1');
    expect(uploadCssSource).toContain('--an-color-border-1');
    expect(uploadCssSource).toContain('--an-color-accent-9');
    expect(uploadCssSource).toContain('--an-color-danger-9');
  });
});
