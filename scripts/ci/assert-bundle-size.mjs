#!/usr/bin/env node
/**
 * CI：`@an-ui-kit/elements` 全量单入口产物的 gzip 体积预算。
 *
 * 规则：预算 = 每个组件 2048B（gzip, level 9）× 组件数。组件数从源码扫描得到
 * （`packages/elements/src/<dir>/an-<tag>.ts`），与 `scripts/build-elements.mjs`
 * 用的是同一份清单，所以新增组件会自动抬预算，无需改本文件。
 *
 * 为什么是「每组件 2048B」而不是一个固定总数：
 *  - 包的 `exports` 只有单入口（`dist/index.js`），产物体积随组件数线性增长；
 *    固定总数会在加组件时误报，按组件算衡量的才是「单个组件的实现成本」。
 *  - 2048B gzip/组件 覆盖：组件自身的 JS、内联进 bundle 的组件 CSS
 *    （esbuild loader `.css=text`）、以及该组件的注册守卫语句。
 *  - 共享 base（`AnElement` + reset 样式）只在产物里出现一次，摊到每个组件
 *    头上已经包含在各组件的预算里，不单独加总。
 *  - 预算不跟随当前体积自动放宽：超了就必须在评审里解释——要么瘦身，要么显式
 *    修改这个常量。
 *
 * 同时校验全量产物里含有每个源码组件的标签名，拦住「dist 是旧的 / 少打了组件」。
 *
 * 用法：node scripts/ci/assert-bundle-size.mjs
 * 退出码：0 = 通过；1 = 超预算、产物缺失或产物缺组件。
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  ELEMENTS_DIR,
  describeBytes,
  discoverComponents,
  gzipSize,
  relativeToRoot,
} from '../lib/elements.mjs';

/** 每个组件允许的 gzip 体积上限。理由见文件头注释。 */
const PER_COMPONENT_BUDGET_BYTES = 2048;

const ARTIFACT = path.join(ELEMENTS_DIR, 'dist', 'index.js');

/** @param {string} message */
function fail(message) {
  console.error(`[ci:bundle-size] FAIL ${message}`);
  process.exit(1);
}

if (!existsSync(ARTIFACT)) {
  fail(`找不到 ${relativeToRoot(ARTIFACT)}；先跑 pnpm --filter @an-ui-kit/elements build`);
}

/** @type {ReturnType<typeof discoverComponents>} */
let components;
try {
  components = discoverComponents();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const bundle = readFileSync(ARTIFACT);
const text = bundle.toString('utf8');
const missing = components.filter((component) => !text.includes(component.tag));
if (missing.length > 0) {
  fail(
    `${relativeToRoot(ARTIFACT)} 不含这些组件的标签：${missing.map((component) => component.tag).join(', ')}；` +
      '产物过期或源码清单与构建不一致',
  );
}

const rawBytes = bundle.byteLength;
const gzippedBytes = gzipSize(bundle);
const budgetBytes = PER_COMPONENT_BUDGET_BYTES * components.length;
const headroomBytes = budgetBytes - gzippedBytes;

console.log(`[ci:bundle-size] 产物：${relativeToRoot(ARTIFACT)}`);
console.log(`[ci:bundle-size] raw：${describeBytes(rawBytes)}`);
console.log(`[ci:bundle-size] gzip（level 9）：${describeBytes(gzippedBytes)}`);
console.log(
  `[ci:bundle-size] 组件数：${components.length}（${components.map((component) => component.tag).join(', ')}）`,
);
console.log(
  `[ci:bundle-size] 预算：${describeBytes(budgetBytes)}（${PER_COMPONENT_BUDGET_BYTES}B × ${components.length} 个组件）`,
);
console.log(`[ci:bundle-size] 余量：${describeBytes(headroomBytes)}`);

if (headroomBytes < 0) {
  fail(`gzip ${gzippedBytes}B 超出预算 ${budgetBytes}B（超出 ${-headroomBytes}B）`);
}

console.log('[ci:bundle-size] OK');
