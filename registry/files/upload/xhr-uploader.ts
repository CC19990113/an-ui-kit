import type { AnUploader } from './an-upload';

/** Options accepted by `createXhrUploader`. */
export interface XhrUploaderOptions {
  /** Endpoint that receives the multipart body. */
  url: string;
  /** HTTP method; defaults to `POST`. */
  method?: string;
  /** Extra request headers sent with the request. */
  headers?: Record<string, string>;
  /** Multipart field that carries the file; defaults to `file`. */
  fieldName?: string;
}

/** `AbortError`-shaped rejection; `DOMException` is not available everywhere. */
function abortError(): Error {
  const error = new Error('上传已取消');
  error.name = 'AbortError';
  return error;
}

/** JSON when the response body parses as JSON, the raw text otherwise. */
function parseResponse(xhr: XMLHttpRequest): unknown {
  const text = typeof xhr.responseText === 'string' ? xhr.responseText : '';
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/**
 * Builds the default `uploader` transport on top of `XMLHttpRequest`.
 *
 * `XMLHttpRequest` is used instead of `fetch` on purpose: only XHR exposes
 * `upload.onprogress`, which the progress bar and `an-upload-progress` need.
 * The returned function sends one file per request as `multipart/form-data`,
 * resolves with the parsed response body for a 2xx status and rejects for
 * everything else. Aborting `context.signal` cancels the request and rejects
 * with an `AbortError`.
 *
 * @param options - Endpoint, HTTP method, headers and multipart field name.
 * @returns An `AnUploader` usable as the `uploader` property or standalone.
 */
export function createXhrUploader(options: XhrUploaderOptions): AnUploader {
  const url = options.url;
  const method = options.method || 'POST';
  const fieldName = options.fieldName || 'file';
  const headers = options.headers ?? {};

  return (file, context) =>
    new Promise<unknown>((resolve, reject) => {
      if (context.signal.aborted) {
        reject(abortError());
        return;
      }

      const xhr = new XMLHttpRequest();
      let settled = false;

      const cleanup = (): void => {
        context.signal.removeEventListener('abort', onAbort);
      };
      const settle = (action: () => void): void => {
        if (settled) return;
        settled = true;
        cleanup();
        action();
      };
      const onAbort = (): void => {
        // `abort()` synchronously fires `onabort`; settle() keeps the outcome
        // single even when the platform also reports a load/error afterwards.
        try {
          xhr.abort();
        } catch {
          // The request may already have finished; the rejection below wins.
        }
        settle(() => reject(abortError()));
      };

      context.signal.addEventListener('abort', onAbort, { once: true });

      xhr.open(method, url, true);
      for (const [name, value] of Object.entries(headers)) {
        xhr.setRequestHeader(name, value);
      }

      xhr.upload.onprogress = (event: ProgressEvent): void => {
        if (settled) return;
        const total = event.total > 0 ? event.total : file.size;
        context.onProgress(event.loaded, total);
      };

      xhr.onload = (): void => {
        settle(() => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(parseResponse(xhr));
          else reject(new Error(`上传失败（HTTP ${xhr.status}）`));
        });
      };

      xhr.onerror = (): void => {
        settle(() => reject(new Error('上传失败：网络错误')));
      };

      xhr.onabort = (): void => {
        settle(() => reject(abortError()));
      };

      const body = new FormData();
      body.append(fieldName, file);
      xhr.send(body);
    });
}
