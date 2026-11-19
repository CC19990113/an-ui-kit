/**
 * 用 esbuild 在**用户机器上**把选中的组件打成单文件 ESM。
 *
 * 入口是 stdin 虚拟文件（不落盘），`resolveDir` 指向已安装包的 `src/`，所以
 * 组件源里的相对 import（`../internal/base`、`./x.css?inline`）都能解析；
 * `.css` 走 text loader，CSS 以字符串内联进 JS —— 这正是单文件产物的前提。
 */
import { gzipSync } from 'node:zlib';
import { CliError } from './errors.js';
import { renderEntry } from './elements.js';

/**
 * @param {{ srcDir: string, components: import('./elements.js').Component[], minify: boolean }} options
 * @returns {Promise<{ contents: Buffer, rawBytes: number, gzipBytes: number }>}
 */
export async function bundleComponents({ srcDir, components, minify }) {
  const esbuild = await loadEsbuild();

  let result;
  try {
    result = await esbuild.build({
      stdin: {
        contents: renderEntry(components),
        resolveDir: srcDir,
        sourcefile: 'an-ui-kit.entry.ts',
        loader: 'ts',
      },
      bundle: true,
      format: 'esm',
      minify,
      loader: { '.css': 'text' },
      write: false,
      logLevel: 'silent',
    });
  } catch (error) {
    throw new CliError(`esbuild 打包失败：${error instanceof Error ? error.message : String(error)}`);
  }

  const output = result.outputFiles?.[0];
  if (!output) throw new CliError('esbuild 没有返回产物，这通常是版本不兼容导致的');

  const contents = Buffer.from(output.contents);
  return {
    contents,
    rawBytes: contents.byteLength,
    gzipBytes: gzipSync(contents, { level: 9 }).byteLength,
  };
}

/** esbuild 是 CLI 唯一的运行时依赖；装丢了也要给一句人话。 */
async function loadEsbuild() {
  try {
    return await import('esbuild');
  } catch (cause) {
    throw new CliError(
      [
        `无法加载 esbuild（CLI 唯一的运行时依赖）：${cause instanceof Error ? cause.message : String(cause)}`,
        '请重新安装 CLI（npm i -D @an-ui-kit/cli），或在项目里补装 esbuild。',
      ].join('\n'),
    );
  }
}

/** 与仓库日志同款的大小描述：`1234 B（1.2 KB）`。 */
export function describeBytes(bytes) {
  return `${bytes} B（${(bytes / 1024).toFixed(1)} KB）`;
}
