# an-upload

> 由 `packages/mcp/manifest.json`（仓库根 `custom-elements-manifest.json` 的拷贝）派生，表里的类型原文、事件名、CSS 变量、part 与 CEM 一致。
> 改组件 JSDoc 后重新生成：仓库根 `pnpm cem`，再 `pnpm --filter @an-ui-kit/mcp build`。

`<an-upload>`：文件选择器 + 拖放区 + 上传队列三合一，form-associated。未配置 `action` / `uploader` 时只做选择与管理队列，不发任何请求；配置后内置 XHR 传输把队列逐个发出去。

**安全边界**：`accept` / `max-size` / `max-files` 只是前端 UX 校验，可被绕过；服务端必须重新校验 MIME、大小与内容。

## 导入与注册

```js
import '@an-ui-kit/elements';            // 注册全部 16 个组件
import '@an-ui-kit/tokens/tokens.css';   // 主题/配色（颜色全部来自 --an-color-*）
```

`@an-ui-kit/elements` 注册全部组件（根入口）。React 还要 `import type {} from '@an-ui-kit/elements/react';`；Vue 3 还要配 `isCustomElement`（见 [../SKILL.md](../SKILL.md) 规则 9）。

## Attributes

| 名称 | 类型（CEM 原文） | 默认值 | 说明 |
| --- | --- | --- | --- |
| `name` | `string` | `""` | 表单字段名，也是默认 multipart 字段名 |
| `accept` | `string` | `""` | 逗号分隔的 MIME、`image/*` 通配或 `.ext` 扩展名 |
| `multiple` | `boolean` | `false` | 允许选择/拖入多个文件 |
| `max-files` | `number` | `0` | 队列文件数上限；`0` 不限 |
| `max-size` | `number` | `0` | 单文件字节上限；`0` 不限 |
| `disabled` | `boolean` | `false` | 禁用选择、拖放与上传 |
| `required` | `boolean` | `false` | 队列为空时 `valueMissing` |
| `action` | `string` | `""` | 上传端点；与内置 XHR 上传器一起启用 |
| `method` | `string` | `POST` | `action` 的 HTTP 方法 |
| `field-name` | `string` | `""` | multipart 字段名；空时回退 `name` |
| `auto-upload` | `boolean` | `true` | 添加文件后立即上传；**默认 true**，用 `auto-upload="false"` 关闭 |
| `size` | `'sm' \| 'md' \| 'lg'` | `md` | 控件尺寸 |

补充：

- `auto-upload` 是**默认 true 的布尔 attribute**，语义与其它布尔属性不同：不写 = 开；写 `auto-upload` 或 `auto-upload="true"` = 开；只有 `auto-upload="false"` = 关。
- `max-files` / `max-size` / `field-name` 在 property 上分别是 `maxFiles` / `maxSize` / `fieldName`。
- **`accept` / `max-size` 只是 UX 校验**，不构成安全边界。

## 事件

| 名称 | detail | 触发条件 |
| --- | --- | --- |
| `an-upload-change` | `{ files: File[], added: File[], removed: File[] }` | 添加、移除、清空队列 |
| `an-upload-reject` | `{ file: File, reason: 'size' \| 'type' \| 'max-files' }` | 文件被前端规则拒绝 |
| `an-upload-progress` | `{ file: File, loaded: number, total: number, percent: number }` | 传输进度；`percent` 为 0–100 整数 |
| `an-upload-success` | `{ file: File, response: unknown }` | 单个文件上传成功；`response` 是上传器解析结果 |
| `an-upload-error` | `{ file: File, error: unknown }` | 单个文件上传失败 |
| `an-upload-abort` | `{ file: File }` | 单个文件的传输被取消 |

- 全部 `bubbles: true`、`composed: true`，`event.target` 是 `<an-upload>`。
- 进度事件按传输节奏派发，可能很频繁；回调里不要做重活。

## 方法 / 公开 property

| 名称 | 说明 |
| --- | --- |
| `get files` | 当前队列（`File[]`，只读） |
| `get/set autoUpload` | 对应 `auto-upload`；setter 会反射 attribute |
| `open()` | 打开原生文件选择器；`disabled` 时 no-op。**与浮层 `open` 无关** |
| `start()` | 手动启动队列；需要 `action` 或 `uploader`；可重试 `error` 状态的文件 |
| `abort(fileOrIndex)` | 取消单个正在上传的文件；非上传中忽略 |
| `remove(fileOrIndex)` | 移除单个文件；上传中会先 abort；无参数是 no-op（继承 `Element.remove()` 的签名） |
| `clear()` | 取消全部上传、清空队列并 revoke 预览 |
| `get validity` | 平台 `ValidityState`（只读） |
| `get validationMessage` | 平台校验文案（只读），`<an-field>` 显示它 |
| `headers: Record<string,string>` | 内置 XHR 上传器附加请求头；不是 attribute |
| `uploader: AnUploader` | 自定义传输，优先于 `action`；`(file, { signal, onProgress }) => Promise<unknown>` |
| `concurrency: number` | 最大并发上传数，默认 `3`；不是 attribute |

## Slots

| 名称 | 说明 |
| --- | --- |
| `trigger` | 替换 dropzone 内的默认按钮与提示文本 |

## CSS Parts

| 名称 | 说明 |
| --- | --- |
| `base` | 根容器 |
| `dropzone` | 可点击、可键盘激活的拖放区 |
| `trigger` | 默认「选择文件」按钮（slot 覆盖时不渲染） |
| `list` | 队列 `<ul>` |
| `item` | 每个文件一行 |
| `item-preview` | 缩略图区域 |
| `item-name` | 文件名 |
| `item-size` | 人类可读大小 |
| `item-progress` | 进度条轨道 |
| `item-error` | 错误文本 |
| `item-remove` | 移除按钮 |
| `item-cancel` | 取消按钮，仅上传中渲染 |
| `empty` | 队列为空时的占位 |

## CSS 自定义属性

| 名称 | 说明 |
| --- | --- |
| `--an-upload-fg` | 文本色 |
| `--an-upload-bg` | 背景色 |
| `--an-upload-border-color` | 边框色 |
| `--an-upload-radius` | 圆角 |
| `--an-upload-gap` | 区块间距 |
| `--an-upload-font-size` | 字号 |
| `--an-upload-focus-ring` | 聚焦轮廓色 |
| `--an-upload-dropzone-padding` | 拖放区内边距 |
| `--an-upload-dropzone-gap` | 拖放区内部间距 |
| `--an-upload-dragover-border-color` | 拖入时的边框色 |
| `--an-upload-trigger-height` | 默认按钮高度 |
| `--an-upload-trigger-padding-x` | 默认按钮水平内边距 |
| `--an-upload-trigger-radius` | 默认按钮圆角 |
| `--an-upload-trigger-bg` | 默认按钮背景 |
| `--an-upload-trigger-fg` | 默认按钮文本色 |
| `--an-upload-trigger-font-size` | 默认按钮字号 |
| `--an-upload-hint-color` | 提示文本颜色 |
| `--an-upload-hint-font-size` | 提示文本字号 |
| `--an-upload-list-gap` | 队列行间距 |
| `--an-upload-item-bg` | 队列行背景 |
| `--an-upload-item-border-color` | 队列行边框 |
| `--an-upload-item-radius` | 队列行圆角 |
| `--an-upload-item-padding` | 队列行内边距 |
| `--an-upload-item-gap` | 队列行内部间距 |
| `--an-upload-preview-size` | 缩略图尺寸 |
| `--an-upload-preview-radius` | 缩略图圆角 |
| `--an-upload-preview-bg` | 缩略图背景 |
| `--an-upload-name-font-size` | 文件名号 |
| `--an-upload-size-color` | 大小文本色 |
| `--an-upload-size-font-size` | 大小文本字号 |
| `--an-upload-progress-height` | 进度条高度 |
| `--an-upload-progress-color` | 进度条前景色 |
| `--an-upload-progress-track` | 进度条轨道色 |
| `--an-upload-error-color` | 错误文本色 |
| `--an-upload-error-font-size` | 错误文本字号 |
| `--an-upload-button-bg` | 行内按钮背景 |
| `--an-upload-button-color` | 行内按钮文本色 |
| `--an-upload-button-border-color` | 行内按钮边框 |
| `--an-upload-button-radius` | 行内按钮圆角 |
| `--an-upload-button-font-size` | 行内按钮字号 |
| `--an-upload-empty-color` | 空态文本色 |

## 用法与注意事项

### 基本用法

```html
<an-upload
  name="attachments"
  accept="image/*,.pdf"
  multiple
  max-files="5"
  max-size="10485760"
  action="/api/upload"
  field-name="file"
></an-upload>
```

```js
const upload = document.querySelector('an-upload');
upload.addEventListener('an-upload-success', (event) => {
  console.log(event.detail.file.name, event.detail.response);
});
upload.addEventListener('an-upload-reject', (event) => {
  console.warn(event.detail.reason, event.detail.file.name);
});
```

### 上传安全（重要）

- `accept` / `max-size` / `max-files` 只用于**前端提示与提前拒绝**：用户可以改 DOM、直接调接口绕过。服务端必须重新校验 MIME、扩展名、大小与文件内容。
- 内置上传器只负责发请求：**不注入业务鉴权头、不处理登录态/CSRF/签名、不做自动重试与退避**。需要鉴权时用 `headers` 或 `uploader` 自己接；自动流程不会重试失败项（手动 `start()` 会重试 `error` 项）。
- `action` / `field-name` / `method` 由使用方给定，组件不推测后端协议。

### 预览 URL 的生命周期

- 图片预览用 `URL.createObjectURL()` 生成；在文件移除、`clear()`、元素断开时都会 `revokeObjectURL()`，重新连接后按需重建。
- 不要把 `item-preview` 里的 URL 缓存到组件外面长期使用 —— 它随时可能被 revoke。
- 如果自定义 `uploader` 自己创建了 objectURL，也必须在对应文件移除/断开时自行 revoke。

### 自动上传与手动上传

- 默认 `auto-upload` 开：文件一进队列就按 `concurrency` 并发上传。
- `auto-upload="false"` 时只入队；用户操作后调 `start()`。
- `start()` 需要 `action` 或 `uploader`，否则 no-op。
- 传输中移除文件会先 abort；`abort()` 只对上传中的文件有效。

### 表单

- form-associated：队列里每个文件以 `[fieldName || name, File]` 提交，`FormData.getAll(name)` 拿到所有 `File`；`disabled` 或没有字段名时不提交。
- `required` 只看队列是否为空。
- 队列里的文件不会自动压缩/裁剪；要做图片处理请在上传前自行处理。

### 反例 → 正例

```html
<!-- ❌ 把前端限制当安全校验 -->
<an-upload accept="image/*" max-size="1048576" action="/api/upload"></an-upload>
<!-- 服务端仍必须校验类型与大小 -->

<!-- ❌ 用 <an-form> 替代真实上传逻辑 -->
<!-- ✅ 监听 an-upload-success，或监听 an-form-submit 自己发请求 -->

<!-- ❌ 关自动上传写成 auto-upload="true" 以为和布尔属性一样 -->
<an-upload auto-upload="true"></an-upload>

<!-- ✅ 关闭用 false；开启可以省略或写 true -->
<an-upload auto-upload="false"></an-upload>
```
