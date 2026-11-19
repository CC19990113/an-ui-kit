import uploadStyles from './an-upload.css?inline';
import { AnElement } from '../internal/base';
import { createXhrUploader } from './xhr-uploader';

/** Sizes of `<an-upload>` and its dropzone. */
export type AnUploadSize = 'sm' | 'md' | 'lg';

/** Presentation of the queued files: rows of text, or a thumbnail grid. */
export type AnUploadListType = 'text' | 'picture';

/** Why the component refused a file. */
export type AnUploadRejectReason = 'size' | 'type' | 'max-files';

/** Lifecycle of one queued file. */
export type AnUploadStatus = 'idle' | 'uploading' | 'success' | 'error' | 'aborted';

/** Context handed to a custom `uploader`. */
export interface AnUploadContext {
  /** Aborted by `abort()`, `remove()` or `clear()` while the transfer runs. */
  signal: AbortSignal;
  /** Reports bytes transferred so the row can render a progress bar. */
  onProgress: (loaded: number, total: number) => void;
}

/** Transport that pushes one file; `createXhrUploader` builds the default one. */
export type AnUploader = (file: File, context: AnUploadContext) => Promise<unknown>;

/** Payload of `an-upload-change`. */
export interface AnUploadChangeDetail {
  /** Every file currently queued, in display order. */
  files: File[];
  /** Files added by this change. */
  added: File[];
  /** Files removed by this change. */
  removed: File[];
}

/** Payload of `an-upload-reject`. */
export interface AnUploadRejectDetail {
  /** The file that was refused. */
  file: File;
  /** Which rule refused it. */
  reason: AnUploadRejectReason;
}

/** Payload of `an-upload-progress`. */
export interface AnUploadProgressDetail {
  /** The file being transferred. */
  file: File;
  /** Bytes transferred so far. */
  loaded: number;
  /** Total bytes expected. */
  total: number;
  /** `loaded / total` as a whole percentage, clamped to 0..100. */
  percent: number;
}

/** Payload of `an-upload-success`. */
export interface AnUploadSuccessDetail {
  /** The file that finished. */
  file: File;
  /** Whatever the uploader resolved with (the parsed response by default). */
  response: unknown;
}

/** Payload of `an-upload-error`. */
export interface AnUploadErrorDetail {
  /** The file that failed. */
  file: File;
  /** The rejection value from the uploader. */
  error: unknown;
}

/** Payload of `an-upload-abort`. */
export interface AnUploadAbortDetail {
  /** The file whose transfer was cancelled. */
  file: File;
}

/** One queued file plus the upload state that is not part of the public API. */
interface UploadItem {
  /** The selected file. */
  file: File;
  /** Current lifecycle state. */
  status: AnUploadStatus;
  /** Bytes transferred so far. */
  loaded: number;
  /** Total bytes expected. */
  total: number;
  /** Cached percentage, so a re-render never recomputes it. */
  percent: number;
  /** Value the uploader resolved with. */
  response?: unknown;
  /** Human-readable failure text. */
  error?: string;
  /** Object URL of the image thumbnail; `null` for non-images. */
  previewUrl: string | null;
  /** Controller of the in-flight request, if any. */
  controller?: AbortController;
}

/** Shown to the owning form when `required` is set and the queue is empty. */
const REQUIRED_MESSAGE = '此字段为必填项。';

/** Fallback multipart field when neither `field-name` nor `name` is set. */
const DEFAULT_FIELD_NAME = 'file';

/** Escapes text used inside an attribute value or element content. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** `2048` -> `2 KB`; bytes below 1 KB keep the `B` unit. */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${trimZero(kb)} KB`;
  return `${trimZero(kb / 1024)} MB`;
}

/** `2.0` -> `2`; keeps `1.5` as is. */
function trimZero(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '');
}

/** A human-readable message for any rejection value. */
function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.length > 0) return error;
  return '上传失败';
}

/** Splits `accept` into normalised tokens; empty means "anything". */
function parseAccept(accept: string): string[] {
  return accept
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);
}

/**
 * Short uppercase extension shown by `list-type="picture"` when the file has no
 * thumbnail: `report.pdf` -> `PDF`, `Makefile` -> `FILE`.
 */
function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  const extension = dot > 0 && dot < name.length - 1 ? name.slice(dot + 1) : '';
  return extension ? extension.toUpperCase().slice(0, 4) : 'FILE';
}

/**
 * `<an-upload>` — file picker, drop target and upload queue in one control.
 *
 * The component never sends anything unless `action` or the `uploader` property
 * provides a transport. Files are validated locally first (`accept`,
 * `max-size`, `max-files`), then queued and uploaded with a concurrency limit.
 * It is form associated: every accepted file is appended to `FormData` under
 * `field-name` (falling back to `name`).
 *
 * @attr name - Form field name and the default multipart field name.
 * @attr accept - Comma-separated MIME types, `image/*` wildcards or `.ext` names.
 * @attr multiple - Lets the picker and drop target accept more than one file.
 * @attr max-files - Upper bound of queued files; `0` means unlimited.
 * @attr max-size - Per-file upper bound in bytes; `0` means unlimited.
 * @attr disabled - Disables picking, dropping and uploading.
 * @attr required - Marks the control invalid while the queue is empty.
 * @attr action - Upload endpoint; enables the built-in XHR uploader.
 * @attr method - HTTP method for `action`; defaults to `POST`.
 * @attr field-name - Multipart field name; defaults to `name`.
 * @attr auto-upload - Starts uploading as soon as files are added; defaults to `true`.
 * @attr size - Control size: `sm`, `md` or `lg`.
 * @attr list-type - Queue presentation: `text` (rows) or `picture` (thumbnail grid whose non-image files show a file icon with their extension). Defaults to `text`.
 * @attr sortable - Lets the queue be reordered by dragging a row onto another one; the new order drives `files` and `FormData`. Defaults to `false`.
 *
 * Pasting while the control has focus adds the clipboard's files through the same validation path as the picker.
 *
 * @fires an-upload-change - Files were added, removed, cleared or reordered; detail is `AnUploadChangeDetail`.
 * @fires an-upload-reject - A file failed validation; detail is `AnUploadRejectDetail`.
 * @fires an-upload-progress - Bytes were transferred; detail is `AnUploadProgressDetail`.
 * @fires an-upload-success - A file finished; detail is `AnUploadSuccessDetail`.
 * @fires an-upload-error - A file failed; detail is `AnUploadErrorDetail`.
 * @fires an-upload-abort - A running upload was cancelled; detail is `AnUploadAbortDetail`.
 *
 * @slot trigger - Replaces the default button and hint inside the dropzone.
 * @csspart base - Root wrapper.
 * @csspart dropzone - Clickable, keyboard-activatable drop area.
 * @csspart trigger - Default "choose file" button (absent when `trigger` is slotted).
 * @csspart list - `<ul>` that holds the queued files; a grid with `list-type="picture"`.
 * @csspart item - One `<li>` per queued file; `draggable` with `sortable`.
 * @csspart item-preview - Thumbnail slot of an item in `list-type="text"` mode.
 * @csspart item-thumb - Thumbnail / file-icon tile of an item in `list-type="picture"` mode.
 * @csspart item-ext - Uppercase file extension shown when a `picture` item has no image preview.
 * @csspart item-name - File name of an item.
 * @csspart item-size - Human-readable file size of an item.
 * @csspart item-progress - Progress bar track of an item.
 * @csspart item-error - Error text of an item.
 * @csspart item-remove - Remove button of an item.
 * @csspart item-cancel - Cancel button, rendered only while uploading.
 * @csspart empty - Placeholder shown while the queue is empty.
 * @cssproperty --an-upload-fg - Text colour.
 * @cssproperty --an-upload-bg - Dropzone background.
 * @cssproperty --an-upload-border-color - Dropzone border.
 * @cssproperty --an-upload-radius - Dropzone corner radius.
 * @cssproperty --an-upload-gap - Gap between the dropzone and the list.
 * @cssproperty --an-upload-font-size - Base font size.
 * @cssproperty --an-upload-focus-ring - Focus ring colour.
 * @cssproperty --an-upload-dropzone-padding - Dropzone padding.
 * @cssproperty --an-upload-dropzone-gap - Gap between trigger and hint.
 * @cssproperty --an-upload-dragover-border-color - Border colour while dragging.
 * @cssproperty --an-upload-trigger-height - Trigger button height.
 * @cssproperty --an-upload-trigger-padding-x - Trigger horizontal padding.
 * @cssproperty --an-upload-trigger-radius - Trigger corner radius.
 * @cssproperty --an-upload-trigger-bg - Trigger background.
 * @cssproperty --an-upload-trigger-fg - Trigger text colour.
 * @cssproperty --an-upload-trigger-font-size - Trigger font size.
 * @cssproperty --an-upload-hint-color - Hint and secondary text colour.
 * @cssproperty --an-upload-hint-font-size - Hint font size.
 * @cssproperty --an-upload-list-gap - Gap between list rows.
 * @cssproperty --an-upload-item-bg - List row background.
 * @cssproperty --an-upload-item-border-color - List row border.
 * @cssproperty --an-upload-item-radius - List row corner radius.
 * @cssproperty --an-upload-item-padding - List row padding.
 * @cssproperty --an-upload-item-gap - Gap inside a list row.
 * @cssproperty --an-upload-preview-size - Thumbnail edge length.
 * @cssproperty --an-upload-preview-radius - Thumbnail corner radius.
 * @cssproperty --an-upload-preview-bg - Thumbnail background.
 * @cssproperty --an-upload-picture-column-width - Minimum column width of the `picture` grid.
 * @cssproperty --an-upload-thumb-height - Height of a `picture` tile.
 * @cssproperty --an-upload-thumb-radius - Corner radius of a `picture` tile.
 * @cssproperty --an-upload-thumb-bg - Background of a `picture` tile.
 * @cssproperty --an-upload-ext-color - Extension colour of a non-image `picture` tile.
 * @cssproperty --an-upload-ext-font-size - Extension font size of a non-image `picture` tile.
 * @cssproperty --an-upload-dragging-outline - Outline of the row being dragged with `sortable`.
 * @cssproperty --an-upload-name-font-size - File name font size.
 * @cssproperty --an-upload-size-color - File size colour.
 * @cssproperty --an-upload-size-font-size - File size font size.
 * @cssproperty --an-upload-progress-height - Progress bar height.
 * @cssproperty --an-upload-progress-color - Progress bar fill.
 * @cssproperty --an-upload-progress-track - Progress bar track.
 * @cssproperty --an-upload-error-color - Error text colour.
 * @cssproperty --an-upload-error-font-size - Error text size.
 * @cssproperty --an-upload-button-bg - Item button background.
 * @cssproperty --an-upload-button-color - Item button text colour.
 * @cssproperty --an-upload-button-border-color - Item button border.
 * @cssproperty --an-upload-button-radius - Item button corner radius.
 * @cssproperty --an-upload-button-font-size - Item button font size.
 * @cssproperty --an-upload-empty-color - Empty placeholder colour.
 */
export class AnUpload extends AnElement {
  static override formAssociated = true;

  static override styles = uploadStyles;

  static override defaults = {
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
    size: 'md' as AnUploadSize,
    listType: 'text' as AnUploadListType,
    sortable: false,
  };

  /** `auto-upload` is a default-true boolean, so it is handled outside `defaults`. */
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'auto-upload'];
  }

  declare name: string;
  declare accept: string;
  declare multiple: boolean;
  declare maxFiles: number;
  declare maxSize: number;
  declare disabled: boolean;
  declare required: boolean;
  declare action: string;
  declare method: string;
  declare fieldName: string;
  declare size: AnUploadSize;
  declare listType: AnUploadListType;
  declare sortable: boolean;

  /** Extra request headers forwarded to the built-in XHR uploader. */
  headers: Record<string, string> = {};

  /** Custom transport; takes precedence over `action`. */
  uploader: AnUploader | undefined;

  /** Maximum number of in-flight uploads; defaults to `3`. */
  concurrency = 3;

  #items: UploadItem[] = [];
  /** Auto-start flag, default `true` and not representable via markup alone. */
  #autoUpload = true;
  /** Set while the property setter reflects itself, so the attribute does not loop. */
  #reflectingAutoUpload = false;
  /** Set by `formDisabledCallback` (e.g. a disabled ancestor `<fieldset>`). */
  #formDisabled = false;
  /** Nesting depth of `dragenter` / `dragleave`, so children cannot flicker the state. */
  #dragDepth = 0;
  /** Guards the recursive `dropzone -> input.click() -> dropzone` click path. */
  #opening = false;
  /** Index of the queue row being dragged for `sortable`; `null` when idle. */
  #dragFrom: number | null = null;

  constructor() {
    super();
    // Delegation on the shadow root survives every innerHTML re-render.
    this.shadowRoot!.addEventListener('click', this.#onClick as EventListener);
    this.shadowRoot!.addEventListener('keydown', this.#onKeyDown as EventListener);
    this.shadowRoot!.addEventListener('change', this.#onChange as EventListener);
    this.shadowRoot!.addEventListener('dragenter', this.#onDragEnter as EventListener);
    this.shadowRoot!.addEventListener('dragover', this.#onDragOver as EventListener);
    this.shadowRoot!.addEventListener('dragleave', this.#onDragLeave as EventListener);
    this.shadowRoot!.addEventListener('drop', this.#onDrop as EventListener);
    this.shadowRoot!.addEventListener('dragstart', this.#onDragStart as EventListener);
    this.shadowRoot!.addEventListener('dragend', this.#onDragEnd as EventListener);
    // `paste` targets the focused element (the dropzone inside the shadow root),
    // so listening on the host catches it wherever focus sits inside the control.
    this.addEventListener('paste', this.#onPaste as EventListener);
  }

  /** Snapshot of the queued files; mutating it never changes the queue. */
  get files(): File[] {
    return this.#items.map((item) => item.file);
  }

  /** Whether files start uploading as soon as they are accepted. */
  get autoUpload(): boolean {
    return this.#autoUpload;
  }

  set autoUpload(next: boolean) {
    const value = Boolean(next);
    if (value === this.#autoUpload) return;
    this.#autoUpload = value;
    this.#reflectingAutoUpload = true;
    try {
      this.toggleAttribute('auto-upload', value);
    } finally {
      this.#reflectingAutoUpload = false;
    }
    this.requestUpdate();
  }

  /** Platform constraint state; `undefined` when the element has no internals. */
  get validity(): ValidityState | undefined {
    return this.internals?.validity;
  }

  /** Message the owning form shows for the current constraint state. */
  get validationMessage(): string {
    return this.internals?.validationMessage ?? '';
  }

  /** Opens the native file picker; a no-op while disabled. */
  open(): void {
    if (this.#isDisabled) return;
    const input = this.#input;
    if (!input) return;
    this.#opening = true;
    try {
      input.click();
    } finally {
      this.#opening = false;
    }
  }

  /** Cancels running uploads, drops every queued file and revokes previews. */
  clear(): void {
    if (this.#items.length === 0) return;
    const removed = this.#items.map((item) => item.file);
    this.#cancelAll(true);
    this.#revokePreviews();
    this.#items = [];
    this.#syncFormValue();
    this.emit('an-upload-change', { files: [], added: [], removed } satisfies AnUploadChangeDetail);
    this.requestUpdate();
  }

  /**
   * Removes one file by index or reference; a running upload is aborted first.
   * The argument is optional only so the signature stays compatible with the
   * inherited `Element.remove()`; calling it without a file is a no-op.
   */
  override remove(fileOrIndex?: File | number): void {
    if (fileOrIndex === undefined) return;
    const index = this.#indexOf(fileOrIndex);
    if (index < 0) return;
    const [item] = this.#items.splice(index, 1);
    this.#cancel(item, true);
    this.#revokeItem(item);
    this.#syncFormValue();
    this.emit('an-upload-change', {
      files: this.files,
      added: [],
      removed: [item.file],
    } satisfies AnUploadChangeDetail);
    this.requestUpdate();
  }

  /** Starts the queue manually; requires `action` or `uploader`. */
  start(): void {
    if (this.#isDisabled || !this.#hasTransport) return;
    // Manual starts may retry files that failed; automatic ones never do.
    this.#pump(true);
  }

  /** Cancels the upload of one file; files that are not uploading are ignored. */
  abort(fileOrIndex: File | number): void {
    const index = this.#indexOf(fileOrIndex);
    if (index < 0) return;
    const item = this.#items[index];
    if (!this.#cancel(item, true)) return;
    this.requestUpdate();
    this.#pump();
  }

  /** One row per queued file, registered with the owning form. */
  protected override formEntries(): Array<[string, string | File]> {
    if (this.#isDisabled) return [];
    const name = this.fieldName || this.name;
    if (!name) return [];
    return this.#items.map((item) => [name, item.file] as [string, File]);
  }

  protected override onConnect(): void {
    // A disconnect revoked the previews; recreate them when reattached.
    let changed = false;
    for (const item of this.#items) {
      if (item.previewUrl === null) {
        item.previewUrl = this.#createPreview(item.file);
        changed = changed || item.previewUrl !== null;
      }
    }
    this.#syncFormValue();
    if (changed) this.requestUpdate();
  }

  protected override onDisconnect(): void {
    this.#dragDepth = 0;
    this.#revokePreviews();
  }

  protected override onFormReset(): void {
    this.#cancelAll(false);
    this.#revokePreviews();
    this.#items = [];
    this.#syncFormValue();
  }

  protected override onFormDisabled(disabled: boolean): void {
    if (this.#formDisabled === disabled) return;
    this.#formDisabled = disabled;
    this.#syncFormValue();
    this.requestUpdate();
  }

  override attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {
    if (name === 'auto-upload' && !this.#reflectingAutoUpload) {
      // Default-true boolean: absence keeps auto upload on, and the explicit
      // `auto-upload="false"` spelling is the declarative way to turn it off.
      this.#autoUpload = value === null ? true : value !== 'false';
    }
    super.attributeChangedCallback(name, oldValue, value);
    if (oldValue === value) return;
    if (name === 'disabled' || name === 'required' || name === 'name' || name === 'field-name') {
      this.#syncFormValue();
    }
  }

  protected render(): string {
    const disabled = this.#isDisabled;
    const accept = this.accept ? ` accept="${escapeHtml(this.accept)}"` : '';
    const multiple = this.multiple ? ' multiple' : '';
    const inputDisabled = disabled ? ' disabled' : '';
    const ariaDisabled = disabled ? ' aria-disabled="true"' : '';
    const tabindex = disabled ? '-1' : '0';
    const invalid = this.required && !disabled && this.#items.length === 0 ? ' aria-invalid="true"' : '';
    const dragover = this.#dragDepth > 0 ? ' data-dragover="true"' : '';
    const rows = this.#items.map((item, index) => this.#renderItem(item, index)).join('');
    const empty = this.#items.length === 0 ? '<p class="empty" part="empty">未选择文件</p>' : '';
    const listClass = this.listType === 'picture' ? 'list list-picture' : 'list';

    return `<div class="base" part="base">
  <div class="dropzone" part="dropzone" role="button" tabindex="${tabindex}"${ariaDisabled}${invalid}${dragover}>
    <slot name="trigger">
      <span class="trigger" part="trigger">选择文件</span>
      <span class="hint">${escapeHtml(this.#hintText())}</span>
    </slot>
    <input class="input" type="file" hidden${accept}${multiple}${inputDisabled} aria-hidden="true" tabindex="-1">
  </div>
  <ul class="${listClass}" part="list">${rows}</ul>
  ${empty}
</div>`;
  }

  /** Markup of one queue row, including its buttons and progress bar. */
  #renderItem(item: UploadItem, index: number): string {
    const name = escapeHtml(item.file.name);
    const percent = item.status === 'success' ? 100 : item.percent;
    const picture = this.listType === 'picture';
    // In `picture` mode the thumbnail grid shows the image itself, and a file
    // icon with the extension for everything else; `text` mode keeps the row.
    const thumb = picture
      ? item.previewUrl
        ? `<span class="item-thumb" part="item-thumb" aria-hidden="true"><img src="${escapeHtml(item.previewUrl)}" alt=""></span>`
        : `<span class="item-thumb" part="item-thumb" aria-hidden="true"><span class="item-ext" part="item-ext">${escapeHtml(fileExtension(item.file.name))}</span></span>`
      : `<span class="item-preview" part="item-preview" aria-hidden="true">${
          item.previewUrl ? `<img src="${escapeHtml(item.previewUrl)}" alt="">` : ''
        }</span>`;
    const draggable = this.sortable && !this.#isDisabled ? ' draggable="true"' : '';
    const error =
      item.status === 'error'
        ? `<span class="item-error" part="item-error" role="alert">${escapeHtml(item.error ?? '上传失败')}</span>`
        : item.status === 'aborted'
          ? '<span class="item-error" part="item-error" role="alert">已取消</span>'
          : '';
    const cancel =
      item.status === 'uploading'
        ? `<button type="button" class="item-cancel" part="item-cancel" data-action="cancel" data-index="${index}" aria-label="取消 ${name}">取消</button>`
        : '';

    return `<li class="item" part="item" data-index="${index}" data-status="${item.status}"${draggable}>
  ${thumb}
  <span class="item-body">
    <span class="item-head">
      <span class="item-name" part="item-name" title="${name}">${name}</span>
      <span class="item-size" part="item-size">${formatBytes(item.file.size)}</span>
    </span>
    <span class="item-progress" part="item-progress" role="progressbar" aria-label="上传进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span class="bar" style="width: ${percent}%"></span></span>
    ${error}
  </span>
  <span class="item-actions">
    ${cancel}
    <button type="button" class="item-remove" part="item-remove" data-action="remove" data-index="${index}" aria-label="移除 ${name}">移除</button>
  </span>
</li>`;
  }

  /** Hint under the default trigger, extended with the limits when set. */
  #hintText(): string {
    const parts = ['点击选择文件，或将文件拖拽到此处'];
    if (this.multiple) parts.push('可多选');
    if (this.maxSize > 0) parts.push(`单个文件不超过 ${formatBytes(this.maxSize)}`);
    return parts.join('，');
  }

  #addFiles(incoming: File[]): void {
    if (this.#isDisabled || incoming.length === 0) return;

    const accepted: File[] = [];
    for (const file of incoming) {
      if (!this.#accepts(file)) {
        this.emit('an-upload-reject', { file, reason: 'type' } satisfies AnUploadRejectDetail);
        continue;
      }
      if (this.maxSize > 0 && file.size > this.maxSize) {
        this.emit('an-upload-reject', { file, reason: 'size' } satisfies AnUploadRejectDetail);
        continue;
      }
      if (this.maxFiles > 0 && this.#items.length + accepted.length >= this.maxFiles) {
        this.emit('an-upload-reject', { file, reason: 'max-files' } satisfies AnUploadRejectDetail);
        continue;
      }
      accepted.push(file);
    }

    if (accepted.length === 0) return;

    for (const file of accepted) {
      this.#items.push({
        file,
        status: 'idle',
        loaded: 0,
        total: file.size,
        percent: 0,
        previewUrl: this.#createPreview(file),
      });
    }

    this.emit('an-upload-change', {
      files: this.files,
      added: accepted,
      removed: [],
    } satisfies AnUploadChangeDetail);
    this.#syncFormValue();
    this.requestUpdate();
    if (this.autoUpload) this.start();
  }

  /** Starts as many idle files as `concurrency` allows. */
  #pump(retry = false): void {
    if (this.#isDisabled || !this.#hasTransport) return;
    const limit = Math.max(1, Math.floor(this.concurrency) || 1);
    let active = this.#items.filter((item) => item.status === 'uploading').length;
    for (const item of this.#items) {
      if (active >= limit) break;
      if (item.status !== 'idle' && !(retry && item.status === 'error')) continue;
      active += 1;
      void this.#upload(item);
    }
  }

  /** Runs one file through the resolved transport, reporting into the queue item. */
  async #upload(item: UploadItem): Promise<void> {
    const uploader = this.#resolveUploader();
    if (!uploader) return;

    const controller = new AbortController();
    item.controller = controller;
    item.status = 'uploading';
    item.loaded = 0;
    item.total = item.file.size;
    item.percent = 0;
    item.error = undefined;
    item.response = undefined;
    this.requestUpdate();

    try {
      const response = await uploader(item.file, {
        signal: controller.signal,
        onProgress: (loaded, total) => this.#trackProgress(item, loaded, total),
      });
      if (controller.signal.aborted || item.status !== 'uploading') return;
      item.status = 'success';
      item.loaded = item.total;
      item.percent = 100;
      item.response = response;
      this.emit('an-upload-success', { file: item.file, response } satisfies AnUploadSuccessDetail);
    } catch (error) {
      // `abort()`, `remove()` and `clear()` all abort the controller first.
      if (controller.signal.aborted) return;
      item.status = 'error';
      item.error = messageOf(error);
      this.emit('an-upload-error', { file: item.file, error } satisfies AnUploadErrorDetail);
    } finally {
      if (item.controller === controller) item.controller = undefined;
      this.requestUpdate();
      this.#pump();
    }
  }

  #trackProgress(item: UploadItem, loaded: number, total: number): void {
    if (item.status !== 'uploading') return;
    const size = total > 0 ? total : item.file.size;
    item.total = size;
    item.loaded = size > 0 ? Math.max(0, Math.min(loaded, size)) : 0;
    item.percent = size > 0 ? Math.min(100, Math.round((item.loaded / size) * 100)) : 0;
    this.emit('an-upload-progress', {
      file: item.file,
      loaded: item.loaded,
      total: item.total,
      percent: item.percent,
    } satisfies AnUploadProgressDetail);
    this.requestUpdate();
  }

  /** Cancels the in-flight request of one item; returns whether one was running. */
  #cancel(item: UploadItem, notify: boolean): boolean {
    const controller = item.controller;
    if (!controller) return false;
    item.controller = undefined;
    item.status = 'aborted';
    item.error = undefined;
    controller.abort();
    if (notify) this.emit('an-upload-abort', { file: item.file } satisfies AnUploadAbortDetail);
    return true;
  }

  #cancelAll(notify: boolean): void {
    for (const item of this.#items) this.#cancel(item, notify);
  }

  /** Uploads nothing without a transport; `uploader` wins over `action`. */
  get #hasTransport(): boolean {
    return this.uploader !== undefined || this.action.length > 0;
  }

  #resolveUploader(): AnUploader | null {
    if (this.uploader) return this.uploader;
    if (!this.action) return null;
    return createXhrUploader({
      url: this.action,
      method: this.method,
      headers: this.headers,
      fieldName: this.fieldName || this.name || DEFAULT_FIELD_NAME,
    });
  }

  #syncFormValue(): void {
    const internals = this.internals;
    if (!internals) return;
    const entries = this.formEntries();
    if (entries.length === 0) {
      internals.setFormValue(null);
    } else {
      const data = new FormData();
      for (const [name, value] of entries) data.append(name, value);
      internals.setFormValue(data);
    }
    this.#syncValidity();
  }

  #syncValidity(): void {
    const internals = this.internals;
    if (!internals || typeof internals.setValidity !== 'function') return;
    const missing = this.required && !this.#isDisabled && this.#items.length === 0;
    if (missing) internals.setValidity({ valueMissing: true }, REQUIRED_MESSAGE);
    else internals.setValidity({});
  }

  /** Matches a file against `accept`: MIME, `type/*` wildcard or `.ext`. */
  #accepts(file: File): boolean {
    const tokens = parseAccept(this.accept);
    if (tokens.length === 0) return true;
    const type = (file.type || '').toLowerCase();
    const name = file.name.toLowerCase();
    return tokens.some((token) => {
      if (token === '*' || token === '*/*') return true;
      if (token.startsWith('.')) return name.endsWith(token);
      if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1));
      return type === token;
    });
  }

  #createPreview(file: File): string | null {
    if (!file.type.startsWith('image/')) return null;
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
    try {
      return URL.createObjectURL(file);
    } catch {
      return null;
    }
  }

  #revokeItem(item: UploadItem): void {
    if (item.previewUrl === null) return;
    try {
      URL.revokeObjectURL(item.previewUrl);
    } catch {
      // Revoking a URL the platform already dropped is harmless.
    }
    item.previewUrl = null;
  }

  #revokePreviews(): void {
    for (const item of this.#items) this.#revokeItem(item);
  }

  #indexOf(fileOrIndex: File | number): number {
    if (typeof fileOrIndex === 'number') {
      return Number.isInteger(fileOrIndex) && fileOrIndex >= 0 && fileOrIndex < this.#items.length
        ? fileOrIndex
        : -1;
    }
    return this.#items.findIndex((item) => item.file === fileOrIndex);
  }

  /** True when the composed path of the event runs through the dropzone. */
  #inDropzone(event: Event): boolean {
    const dropzone = this.shadowRoot?.querySelector('.dropzone');
    return dropzone !== null && dropzone !== undefined && event.composedPath().includes(dropzone);
  }

  #setDragover(active: boolean): void {
    const dropzone = this.shadowRoot?.querySelector('.dropzone');
    if (!dropzone) return;
    if (active) dropzone.setAttribute('data-dragover', 'true');
    else dropzone.removeAttribute('data-dragover');
  }

  get #isDisabled(): boolean {
    return this.disabled || this.#formDisabled;
  }

  get #input(): HTMLInputElement | null {
    return this.shadowRoot?.querySelector<HTMLInputElement>('input[type="file"]') ?? null;
  }

  #onClick = (event: MouseEvent): void => {
    const target = event.composedPath()[0] as Element | null;
    const actionElement = target && 'closest' in target ? target.closest<HTMLElement>('[data-action]') : null;
    if (actionElement) {
      const index = Number(actionElement.dataset.index);
      if (actionElement.dataset.action === 'remove') this.remove(index);
      else if (actionElement.dataset.action === 'cancel') this.abort(index);
      return;
    }
    if (this.#opening) return;
    if (!this.#inDropzone(event)) return;
    if (target === this.#input) return;
    this.open();
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    if (!this.#inDropzone(event)) return;
    const target = event.composedPath()[0] as Element | null;
    if (target === this.#input) return;
    event.preventDefault();
    this.open();
  };

  #onChange = (event: Event): void => {
    const input = event.composedPath()[0] as HTMLInputElement | null;
    if (!input || input.type !== 'file') return;
    const files = input.files ? Array.from(input.files) : [];
    // Clearing lets the same file be picked again; browsers may forbid it.
    try {
      input.value = '';
    } catch {
      // Ignore: the FileList snapshot above is already copied.
    }
    this.#addFiles(files);
  };

  #onDragEnter = (event: DragEvent): void => {
    // A row dragged inside the list must not light up the dropzone.
    if (this.#dragFrom !== null) return;
    if (!this.#inDropzone(event)) return;
    event.preventDefault();
    if (this.#isDisabled) return;
    this.#dragDepth += 1;
    this.#setDragover(true);
  };

  #onDragOver = (event: DragEvent): void => {
    if (this.#dragFrom !== null) {
      if (this.#isDisabled || this.#itemIndexOf(event) < 0) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      return;
    }
    if (!this.#inDropzone(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = this.#isDisabled ? 'none' : 'copy';
  };

  #onDragLeave = (event: DragEvent): void => {
    if (this.#dragFrom !== null) return;
    if (!this.#inDropzone(event)) return;
    if (this.#isDisabled) return;
    this.#dragDepth = Math.max(0, this.#dragDepth - 1);
    if (this.#dragDepth === 0) this.#setDragover(false);
  };

  #onDrop = (event: DragEvent): void => {
    if (this.#dragFrom !== null) {
      event.preventDefault();
      const from = this.#dragFrom;
      this.#dragFrom = null;
      const to = this.#itemIndexOf(event);
      this.#clearDragging();
      if (to >= 0) this.#moveItem(from, to);
      return;
    }
    if (!this.#inDropzone(event)) return;
    event.preventDefault();
    this.#dragDepth = 0;
    this.#setDragover(false);
    if (this.#isDisabled) return;
    const dropped = event.dataTransfer ? Array.from(event.dataTransfer.files) : [];
    this.#addFiles(dropped);
  };

  /** Starts an internal reorder; only rows of a `sortable` list are draggable. */
  #onDragStart = (event: DragEvent): void => {
    if (!this.sortable || this.#isDisabled) return;
    const index = this.#itemIndexOf(event);
    if (index < 0) return;
    this.#dragFrom = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      // Firefox requires payload data before a drag can start.
      event.dataTransfer.setData('text/plain', String(index));
    }
    this.#rowOf(event)?.setAttribute('data-dragging', 'true');
  };

  /** Clears the drag state; `drop` already did it, so this only catches cancels. */
  #onDragEnd = (): void => {
    this.#dragFrom = null;
    this.#clearDragging();
  };

  /**
   * Adds files pasted while the control has focus: the clipboard files go
   * through the same `#addFiles` validation as a picker selection.
   */
  #onPaste = (event: ClipboardEvent): void => {
    if (this.#isDisabled) return;
    const clipboard = event.clipboardData;
    if (!clipboard) return;
    const files = Array.from(clipboard.files ?? []);
    if (files.length === 0) return;
    event.preventDefault();
    this.#addFiles(files);
  };

  /** Queue index of the row an event targets, or `-1`. */
  #itemIndexOf(event: Event): number {
    const row = this.#rowOf(event);
    if (!row) return -1;
    const index = Number(row.getAttribute('data-index'));
    return Number.isInteger(index) && index >= 0 ? index : -1;
  }

  /** The `<li part="item">` inside an event's path, or `null`. */
  #rowOf(event: Event): Element | null {
    for (const node of event.composedPath()) {
      if (node instanceof Element && node.classList.contains('item')) return node;
    }
    return null;
  }

  /** Removes the drag highlight from every row. */
  #clearDragging(): void {
    for (const row of this.shadowRoot?.querySelectorAll('[data-dragging]') ?? []) {
      row.removeAttribute('data-dragging');
    }
  }

  /**
   * Moves one queued file to another position. The queue order is what `files`
   * and `FormData` report, so both follow immediately; the reorder emits
   * `an-upload-change` with empty `added` / `removed` lists.
   */
  #moveItem(from: number, to: number): void {
    const length = this.#items.length;
    if (from === to || from < 0 || to < 0 || from >= length || to >= length) return;
    const [moved] = this.#items.splice(from, 1);
    this.#items.splice(to, 0, moved);
    this.emit('an-upload-change', {
      files: this.files,
      added: [],
      removed: [],
    } satisfies AnUploadChangeDetail);
    this.#syncFormValue();
    this.requestUpdate();
  }
}

export { createXhrUploader } from './xhr-uploader';
export type { XhrUploaderOptions } from './xhr-uploader';
