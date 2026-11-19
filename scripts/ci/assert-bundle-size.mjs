#!/usr/bin/env node
/**
 * CI 预算：组件构建产物 `packages/elements/dist/index.js` 的 gzip 体积必须
 * ≤ 3072 字节（3 KiB）。
 *
 * 用的是 gzip level 9，比常说的「gzip 后大小」略保守；只要不引入运行时依赖，
 * 这点预算很宽松。
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const LIMIT_BYTES = 3072;

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const bundle = join(ROOT, 'packages/elements/dist/index.js');

if (!existsSync(bundle)) {
  console.error(`[ci:bundle-size] FAIL 找不到 ${bundle}；请先跑 pnpm --filter @an-ui-kit/elements build`);
  process.exit(1);
}

const source = readFileSync(bundle);
const gzipped = gzipSync(source, { level: 9 });

console.log(
  `[ci:bundle-size] dist/index.js raw=${source.length}B gzip(level9)=${gzipped.length}B limit=${LIMIT_BYTES}B`,
);

if (gzipped.length > LIMIT_BYTES) {
  console.error(
    `[ci:bundle-size] FAIL gzip 体积 ${gzipped.length}B 超出预算 ${LIMIT_BYTES}B（超出 ${gzipped.length - LIMIT_BYTES}B）`,
  );
  process.exit(1);
}

console.log(`[ci:bundle-size] OK 剩余预算 ${LIMIT_BYTES - gzipped.length}B`);
