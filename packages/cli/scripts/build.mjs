#!/usr/bin/env node
/**
 * 把 `src/cli.js` 打成 `dist/cli.js`（单文件、平台 node、ESM）。
 *
 * 两个细节：
 *   1. `esbuild` 必须 external —— CLI 在用户机器上运行时才 `import('esbuild')`，
 *      它自带原生二进制，不能也不该被塞进我们的产物。
 *   2. 产物是 bin：打 banner 加 shebang，再 chmod 755，`npm i -g` / npx 才能直接跑。
 */
import { chmod, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const outfile = join(root, 'dist', 'cli.js');

await build({
  absWorkingDir: root,
  entryPoints: ['src/cli.js'],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external: ['esbuild'],
  // 源文件不带 shebang（否则 esbuild 会保留它，与 banner 叠成两行）；这里统一加。
  banner: { js: '#!/usr/bin/env node' },
  define: { __CLI_VERSION__: JSON.stringify(manifest.version) },
  legalComments: 'none',
  logLevel: 'info',
});

await chmod(outfile, 0o755);
