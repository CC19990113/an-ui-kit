/**
 * 定位**用户项目里**已安装的 `@an-ui-kit/elements`，并从它的 `src/` 扫描组件。
 *
 * 为什么读源码而不是读 `dist`：裁剪必须在打包期做，CLI 需要组件源文件才能让
 * esbuild 只把选中的组件及其依赖（`internal/base.ts`、CSS）拉进产物。因此
 * `@an-ui-kit/elements` 从某一版起在 `files` 里带上 `src`；更早的版本只有
 * `dist`，CLI 要给出「升级到带 src 的版本」这句人话，而不是抛栈。
 *
 * 标签与目录的对应关系沿用 CONTRACT.md §1：`src/<dir>/an-<tag>.ts` → `<tag>`；
 * 类名取该文件里 `export class <Name> extends (AnElement | HTMLElement)` 的
 * `<Name>`，两条基类都合法，与仓库根 `scripts/lib/elements.mjs` 同一口径。
 *
 * 为什么也接受 `HTMLElement`：`AnElement` 是 shadow 组件的基类（自带
 * `attachShadow` + 模板渲染）；无 shadow 的控制器/容器组件不需要 shadow root，
 * 契约上直接 `extends HTMLElement` —— 例如 `<an-form>`：它作为透明容器用
 * `display: contents` 留在 light DOM 里包住消费者自己的控件（shadow 会把外部
 * 子节点挡在插槽另一侧，反而要额外转发）。标签推导规则完全相同，无需分叉。
 */
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CliError } from './errors.js';

export const ELEMENTS_PACKAGE = '@an-ui-kit/elements';

/** 第一个在 `files` 里发布 `src` 的版本；更早的版本无法裁剪。 */
export const MIN_SOURCE_VERSION = '0.1.0';

/**
 * @typedef {{ tag: string, className: string, dir: string, file: string, importPath: string }} Component
 * @typedef {{
 *   packageRoot: string,
 *   packageJsonPath: string,
 *   srcDir: string,
 *   version: string,
 *   components: Component[],
 * }} ResolvedElements
 */

/** @returns {ResolvedElements} */
export function resolveElements() {
  const packageJsonPath = resolvePackageJson();
  const packageRoot = realpathSync(dirname(packageJsonPath));

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  } catch (cause) {
    throw new CliError(`读不到 ${packageJsonPath}：${describe(cause)}`);
  }

  const version = typeof manifest.version === 'string' ? manifest.version : '0.0.0';
  const srcDir = join(packageRoot, 'src');

  if (!existsSync(srcDir)) {
    throw new CliError(
      [
        `已安装的 ${ELEMENTS_PACKAGE}@${version} 没有随包发布组件源码（缺少 ${srcDir}），无法按配置裁剪。`,
        `该版本只发布 dist 构建产物；请升级到 >= ${MIN_SOURCE_VERSION} 后再运行：`,
        `  npm i -D ${ELEMENTS_PACKAGE}@latest`,
      ].join('\n'),
    );
  }

  const components = discoverComponents(srcDir);
  if (components.length === 0) {
    throw new CliError(
      `在 ${srcDir} 里没有发现任何组件（约定：src/<dir>/an-<tag>.ts 且导出 ` +
        '`export class <Name> extends (AnElement | HTMLElement)`），这个版本的包可能是坏的。',
    );
  }

  return { packageRoot, packageJsonPath, srcDir, version, components };
}

/** @returns {string} 解析到的 package.json 绝对路径 */
function resolvePackageJson() {
  const attempts = [];

  // 1) 先看**项目**里装的版本（cwd 解析）。用户直觉里「已安装的 elements」指项目依赖；
  //    npx 场景下 CLI 自己也会带一份，不应悄悄盖掉项目锁定的版本。
  try {
    const require = createRequire(pathToFileURL(join(process.cwd(), '__an-ui-kit__.js')).href);
    const file = require.resolve(`${ELEMENTS_PACKAGE}/package.json`);
    if (existsSync(file)) return file;
    attempts.push(`当前工作目录 → ${file}（不存在）`);
  } catch (error) {
    attempts.push(`当前工作目录解析失败：${describe(error)}`);
  }

  // 2) 回落到 CLI 自己的依赖（全局安装 / 项目没装 elements 的 npx 场景）。
  try {
    if (typeof import.meta.resolve === 'function') {
      const url = import.meta.resolve(`${ELEMENTS_PACKAGE}/package.json`);
      // Node >= 20.6 同步返回 string；更早版本返回 Promise，typeof 兜住后走下一步。
      if (typeof url === 'string' && url.startsWith('file:')) {
        const file = fileURLToPath(url);
        if (existsSync(file)) return file;
        attempts.push(`import.meta.resolve → ${file}（不存在）`);
      }
    }
  } catch (error) {
    attempts.push(`import.meta.resolve 失败：${describe(error)}`);
  }

  try {
    const require = createRequire(import.meta.url);
    const file = require.resolve(`${ELEMENTS_PACKAGE}/package.json`);
    if (existsSync(file)) return file;
    attempts.push(`CLI 所在位置 → ${file}（不存在）`);
  } catch (error) {
    attempts.push(`CLI 所在位置解析失败：${describe(error)}`);
  }

  throw new CliError(
    [
      `找不到 ${ELEMENTS_PACKAGE}，无法裁剪组件。请先在项目里安装它：`,
      `  npm i -D ${ELEMENTS_PACKAGE}    # 或 pnpm add -D / yarn add -D`,
      '',
      '已尝试的解析位置：',
      ...attempts.map((attempt) => `  - ${attempt}`),
    ].join('\n'),
  );
}

/**
 * 扫描 `src/<dir>/an-<tag>.ts`。目录名不参与标签推导，但按目录名排序保证输出
 * 稳定（`list` 与产物里的注册顺序都可复现）。
 *
 * 类名推导接受两条基类：shadow 组件 `extends AnElement`，无 shadow 控制器
 * `extends HTMLElement`（如 `an-form`）；见文件头与 `scripts/lib/elements.mjs`。
 *
 * @param {string} srcDir
 * @returns {Component[]}
 */
export function discoverComponents(srcDir) {
  const components = [];

  for (const dir of listDirectories(srcDir)) {
    for (const file of readdirSync(join(srcDir, dir)).sort()) {
      if (!/^an-[a-z0-9]+(-[a-z0-9]+)*\.ts$/.test(file)) continue;

      const source = readFileSync(join(srcDir, dir, file), 'utf8');
      const match = /export\s+class\s+([A-Za-z_$][\w$]*)\s+extends\s+(?:AnElement|HTMLElement)\b/.exec(
        source,
      );
      if (!match) continue;

      components.push({
        tag: file.slice(0, -'.ts'.length),
        className: match[1],
        dir,
        file,
        importPath: `./${dir}/${file}`,
      });
    }
  }

  return components;
}

/** @param {string} root */
function listDirectories(root) {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/**
 * 生成 esbuild 的虚拟入口。与仓库内 `scripts/build-elements.mjs` 的产物同构：
 * 导出 base（AnElement 等）、逐个 import、带 `customElements.get()` 守卫注册，
 * 所以裁剪产物与全量包的行为逐个组件一致。
 *
 * @param {Component[]} components
 */
export function renderEntry(components) {
  const lines = [
    '// 由 @an-ui-kit/cli 生成：只包含配置里选中的组件，单文件、无 npm 依赖。',
    "export * from './internal/base';",
    '',
    ...components.map((component) => `import { ${component.className} } from '${component.importPath}';`),
    '',
    ...components.map((component) => `export { ${component.className} };`),
    '',
  ];

  for (const component of components) {
    lines.push(`if (typeof customElements !== 'undefined' && !customElements.get('${component.tag}')) {`);
    lines.push(`  customElements.define('${component.tag}', ${component.className});`);
    lines.push('}');
  }

  lines.push('');
  return lines.join('\n');
}

function describe(error) {
  return error instanceof Error ? error.message : String(error);
}
