/**
 * Shared helpers for the `@an-ui-kit/elements` build and its CI assertions.
 *
 * Two things are deliberately centralised here so `build-elements.mjs`,
 * `ci/assert-bundle-size.mjs` and `ci/assert-custom-build.mjs` cannot drift:
 *
 *   1. **组件清单来自源码目录，不硬编码。** CONTRACT.md §1 规定标签名与源码
 *      目录一一对应：`packages/elements/src/<dir>/an-<tag>.ts` → 标签 `<tag>`。
 *      所以扫描 `src/<dir>/an-*.ts`，标签取文件名去掉 `.ts`，类名取该文件里
 *      `export class <Name> extends (AnElement | HTMLElement)` 的 `<Name>`，
 *      两条基类都合法。新增组件只要按约定落文件就会被构建脚本、体积预算与
 *      裁剪断言同时看见。
 *
 *      **为什么允许 `HTMLElement`：** `AnElement` 是 shadow 组件的基类（自带
 *      `attachShadow` + 模板渲染）；无 shadow 的控制器/容器组件不需要 shadow
 *      root，契约上就应当直接 `extends HTMLElement` —— 例如 `<an-form>`：它只
 *      作为透明容器用 `display: contents` 留在 light DOM 里，包住消费者自己的
 *      控件（shadow 会把外部子节点挡在插槽另一侧，反而要额外转发）。两者共用
 *      同一套标签推导规则，构建脚本无需为它们分叉。
 *   2. **esbuild 从 packages/elements 解析。** 它是该包的 devDependency；从仓库根
 *      直接 `import('esbuild')` 在 pnpm 的隔离 node_modules 下解析不到。用
 *      createRequire 从 elements 的 package.json 起解析，零新依赖。
 */

import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ELEMENTS_DIR = path.join(ROOT, 'packages', 'elements');
export const SRC_DIR = path.join(ELEMENTS_DIR, 'src');
export const CONFIG_PATH = path.join(ROOT, 'an-ui-kit.config.json');

/** Custom Elements: `an-` 前缀 + 小写 kebab-case，必须带连字符。 */
const TAG_PATTERN = /^an-[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/**
 * 组件模块必须导出继承自 `AnElement` 或 `HTMLElement` 的类，名字就是标签的
 * PascalCase 形式。`AnElement` 用于 shadow 组件；`HTMLElement` 用于无 shadow
 * 的控制器/容器（如 `an-form`，用 `display: contents` 留在 light DOM）。
 */
const CLASS_PATTERN = /export\s+class\s+([A-Za-z_$][\w$]*)\s+extends\s+(?:AnElement|HTMLElement)\b/;

/**
 * Scan `packages/elements/src/<dir>/an-*.ts` and return every component, sorted
 * by tag so builds and size reports are deterministic.
 *
 * @returns {Array<{ tag: string, className: string, dir: string, file: string, importPath: string }>}
 */
export function discoverComponents({ srcDir = SRC_DIR } = {}) {
  /** @type {Array<{ tag: string, className: string, dir: string, file: string, importPath: string }>} */
  const components = [];

  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const dir = entry.name;
    const dirPath = path.join(srcDir, dir);
    for (const file of readdirSync(dirPath)) {
      if (!file.endsWith('.ts')) continue;

      const stem = file.slice(0, -'.ts'.length);
      if (!TAG_PATTERN.test(stem)) continue;

      const source = readFileSync(path.join(dirPath, file), 'utf8');
      const match = CLASS_PATTERN.exec(source);
      if (!match) {
        throw new Error(
          `组件模块 ${path.join(dir, file)} 没有按约定导出 \`export class <Name> extends (AnElement | HTMLElement)\`，` +
            '无法推导类名（shadow 组件继承 AnElement，无 shadow 控制器继承 HTMLElement；' +
            '见 CONTRACT.md §1 与 scripts/new-component.mjs 的骨架）。',
        );
      }

      components.push({
        tag: stem,
        className: match[1],
        dir,
        file,
        importPath: `./${dir}/${stem}`,
      });
    }
  }

  components.sort((a, b) => a.tag.localeCompare(b.tag, 'en'));

  if (components.length === 0) {
    throw new Error(`在 ${path.relative(ROOT, srcDir)} 下没有扫描到任何组件（期望 <dir>/an-<tag>.ts）。`);
  }

  const seen = new Set();
  for (const component of components) {
    if (seen.has(component.tag)) {
      throw new Error(`重复的组件标签 "${component.tag}"：同一标签只能对应一个源码目录。`);
    }
    seen.add(component.tag);
  }

  return components;
}

/**
 * Load the esbuild that `packages/elements` already depends on. Never add a new
 * dependency for the build: the repo already ships esbuild as a devDependency.
 */
export function loadEsbuild() {
  const requireFromElements = createRequire(path.join(ELEMENTS_DIR, 'package.json'));
  try {
    return requireFromElements('esbuild');
  } catch (cause) {
    throw new Error(
      '解析不到 esbuild。它是 packages/elements 的 devDependency：先跑 pnpm install，' +
        `不要为构建脚本新增依赖。原因：${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
}

/** gzip level 9 size, matching what the size assertions report. */
export function gzipSize(buffer) {
  return gzipSync(buffer, { level: 9 }).length;
}

/** Exact bytes plus a short human-readable form, e.g. `12345 B（12.1 KB）`. */
export function describeBytes(bytes) {
  return `${bytes} B（${(bytes / 1024).toFixed(1)} KB）`;
}

/** Path shown relative to the repo root in logs. */
export function relativeToRoot(target) {
  const relative = path.relative(ROOT, target);
  return relative.startsWith('..') ? target : relative;
}
