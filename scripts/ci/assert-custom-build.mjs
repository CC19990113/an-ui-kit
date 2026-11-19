#!/usr/bin/env node
/**
 * CI：证明「配置驱动的裁剪构建」真的把没点名的组件裁掉了。
 *
 * 做法（全程只碰临时目录，绝不写 dist/、绝不改仓库里的 an-ui-kit.config.json）：
 *   1. 在 os.tmpdir() 下建临时目录；
 *   2. 用命令行覆盖跑裁剪构建：
 *        node scripts/build-elements.mjs --mode custom \
 *          --components an-button --out <tmp>/an-ui-kit.custom.js
 *      `--components` 是配置文件 `components` 数组的等价 CLI 覆盖，专门给这类
 *      断言用，免得为了测试去改仓库配置；
 *   3. 断言产物：
 *        - 含 `an-button` 与类名 `AnButton`；
 *        - 含 `customElements.define`（裁剪产物同样负责注册元素，不能只导出类）；
 *        - 不含 `an-input`、不含 `AnInput`（没点名的组件不得混进来）；
 *   4. 打印裁剪产物的 raw / gzip，并与全量 `dist/index.js` 对比，作为
 *      「按需生成确实更小」的证据；
 *   5. finally 里删临时目录。
 *
 * 等价的配置驱动用法（人工/未来给用户在自己项目里生成时）：
 *   an-ui-kit.config.json → { "components": ["an-button"] }
 *   pnpm build:custom       → dist/an-ui-kit.custom.js
 *
 * 用法：node scripts/ci/assert-custom-build.mjs
 * 退出码：0 = 通过；1 = 构建失败或断言失败。
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

import { ROOT, describeBytes, gzipSize, relativeToRoot } from '../lib/elements.mjs';

const BUILD_SCRIPT = path.join(ROOT, 'scripts', 'build-elements.mjs');
const FULL_BUNDLE = path.join(ROOT, 'packages', 'elements', 'dist', 'index.js');

const INCLUDED = 'an-button';
const INCLUDED_CLASS = 'AnButton';
const EXCLUDED = 'an-input';
const EXCLUDED_CLASS = 'AnInput';

/** @type {string[]} */
const failures = [];
const tempDir = mkdtempSync(path.join(os.tmpdir(), 'an-ui-kit-custom-'));
const customBundle = path.join(tempDir, 'an-ui-kit.custom.js');

try {
  const result = spawnSync(
    process.execPath,
    [BUILD_SCRIPT, '--mode', 'custom', '--components', INCLUDED, '--out', customBundle],
    { cwd: ROOT, encoding: 'utf8' },
  );

  if (result.error) {
    failures.push(`无法执行裁剪构建：${result.error.message}`);
  } else if (result.status !== 0) {
    failures.push(`裁剪构建 exit ${result.status}：${(result.stderr || '').trim()}`);
  } else {
    if (result.stdout.trim() !== '') console.log(result.stdout.trimEnd());
  }

  if (failures.length === 0) {
    if (!existsSync(customBundle)) {
      failures.push(`裁剪构建没有产出 ${relativeToRoot(customBundle)}`);
    } else {
      const contents = readFileSync(customBundle);
      const text = contents.toString('utf8');

      if (!text.includes(INCLUDED)) failures.push(`裁剪产物不含标签 ${INCLUDED}`);
      if (!text.includes(INCLUDED_CLASS)) failures.push(`裁剪产物不含类名 ${INCLUDED_CLASS}`);
      if (!text.includes('customElements.define')) {
        failures.push('裁剪产物不含 customElements.define：只会导出类、不会注册元素');
      }
      if (text.includes(EXCLUDED)) failures.push(`裁剪产物混入了未点名的标签 ${EXCLUDED}`);
      if (text.includes(EXCLUDED_CLASS)) failures.push(`裁剪产物混入了未点名的类 ${EXCLUDED_CLASS}`);

      const customRaw = contents.byteLength;
      const customGzip = gzipSize(contents);
      console.log(`[ci:custom-build] 裁剪产物：${relativeToRoot(customBundle)}（临时目录，结束即删）`);
      console.log(`[ci:custom-build] 组件：${INCLUDED}`);
      console.log(`[ci:custom-build] raw：${describeBytes(customRaw)}`);
      console.log(`[ci:custom-build] gzip（level 9）：${describeBytes(customGzip)}`);
      console.log(`[ci:custom-build] 不含 ${EXCLUDED} / ${EXCLUDED_CLASS} ✓`);
      console.log(`[ci:custom-build] 含 ${INCLUDED} / ${INCLUDED_CLASS} 与注册语句 ✓`);

      if (existsSync(FULL_BUNDLE)) {
        const full = readFileSync(FULL_BUNDLE);
        const fullRaw = full.byteLength;
        const fullGzip = gzipSize(full);
        const savedGzip = fullGzip - customGzip;
        const savedPercent = fullGzip === 0 ? 0 : (savedGzip / fullGzip) * 100;
        console.log(
          `[ci:custom-build] 全量对比：raw ${describeBytes(fullRaw)} → ${describeBytes(customRaw)}，` +
            `gzip ${describeBytes(fullGzip)} → ${describeBytes(customGzip)}（省 ${savedGzip}B，${savedPercent.toFixed(1)}%）`,
        );
      } else {
        console.log(
          `[ci:custom-build] 全量产物 ${relativeToRoot(FULL_BUNDLE)} 不存在，跳过体积对比（先跑 elements build）`,
        );
      }
    }
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`[ci:custom-build] FAIL ${failure}`);
  process.exit(1);
}

console.log('[ci:custom-build] OK');
