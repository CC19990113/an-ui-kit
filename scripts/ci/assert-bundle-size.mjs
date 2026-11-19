#!/usr/bin/env node
/**
 * CI：`@an-ui-kit/elements` 全量单入口产物的 gzip 体积预算。
 *
 * 规则：预算 = 基线 4096B + 每个组件 2048B（gzip, level 9）× 组件数。
 * 组件数从源码扫描得到（`packages/elements/src/<dir>/an-<tag>.ts`），与
 * `scripts/build-elements.mjs` 用的是同一份清单，所以新增组件会自动抬预算，
 * 无需改本文件。
 *
 * 为什么要有 4096B 的固定基线：
 *  - 单入口产物里有一份**被所有组件共用**的运行时：`internal/base.ts`
 *    （`AnElement`：form-associated 生命周期、`setValidity`、样式注入）、
 *    `reset.css` / 共享 CSS reset、`internal/popover.ts`（浮层定位与
 *    top-layer 回退）、`internal/calendar.ts`（日期计算与面板状态机）。
 *  - 这些代码与组件数量无关，只在产物里出现一次。把它按组件平摊会系统性
 *    高估小组件（例如 `an-option`）的成本、低估大组件（例如 `an-upload`），
 *    并且组件数越少偏差越大；拆成「固定基线 + 每组件增量」才能同时反映
 *    共享成本与单组件实现成本。
 *  - 2048B gzip/组件 覆盖：组件自身的 JS、内联进 bundle 的组件 CSS
 *    （esbuild loader `.css=text`）、以及该组件的注册守卫语句。
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

/**
 * 固定基线：所有组件共享的运行时与 CSS reset，只按一份计算。
 * 理由见文件头注释。
 */
const BASE_BYTES = 4096;

/** 每个组件允许的 gzip 体积上限。理由见文件头注释。 */
const PER_COMPONENT_BYTES = 2048;

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
const budgetBytes = BASE_BYTES + PER_COMPONENT_BYTES * components.length;
const headroomBytes = budgetBytes - gzippedBytes;

console.log(`[ci:bundle-size] 产物：${relativeToRoot(ARTIFACT)}`);
console.log(`[ci:bundle-size] raw：${describeBytes(rawBytes)}`);
console.log(`[ci:bundle-size] gzip（level 9）：${describeBytes(gzippedBytes)}`);
console.log(
  `[ci:bundle-size] 组件数：${components.length}（${components.map((component) => component.tag).join(', ')}）`,
);
console.log(
  `[ci:bundle-size] 基线：${describeBytes(BASE_BYTES)}（共享运行时：internal/base.ts、reset.css、internal/popover.ts、internal/calendar.ts 与共享 CSS reset）`,
);
console.log(
  `[ci:bundle-size] 预算：${describeBytes(budgetBytes)}（${BASE_BYTES}B 基线 + ${PER_COMPONENT_BYTES}B × ${components.length} 个组件）`,
);
console.log(`[ci:bundle-size] 余量：${describeBytes(headroomBytes)}`);

if (headroomBytes < 0) {
  fail(`gzip ${gzippedBytes}B 超出预算 ${budgetBytes}B（超出 ${-headroomBytes}B）`);
}

console.log('[ci:bundle-size] OK');
