#!/usr/bin/env node
/**
 * CI 硬红线：每个 `packages/` 子包的 `dependencies` 必须是空对象。
 *
 * 组件产物零第三方运行时依赖，框架适配层只是 `.d.ts`；构建期工具
 * 一律放 devDependencies。这个断言在构建/测试之后跑，确保没人偷偷加依赖。
 *
 * 唯一例外是 `@an-ui-kit/cli`：它是要装到使用者机器上单独运行的**构建工具**，
 * 运行时必须有 esbuild（自带原生二进制，打不进我们的产物）与 `@an-ui-kit/elements`
 * （要读它的 `src/` 才能按配置裁剪）。例外是**受约束**的，不是放任：只允许
 * `esbuild` 与 `@an-ui-kit/` 前缀的包，出现任何别的运行时依赖照样 FAIL。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PACKAGES_DIR = join(ROOT, 'packages');

/** 唯一允许有运行时依赖的包：装在使用者机器上的构建工具，不是组件产物。 */
const BUILD_TOOL_PACKAGE = '@an-ui-kit/cli';

/** 该例外允许的运行时依赖：打包器本体，以及自家 workspace 包（发布时替换为版本号）。 */
const BUILD_TOOL_ALLOWED = ['esbuild'];
const BUILD_TOOL_ALLOWED_PREFIX = '@an-ui-kit/';

function fail(message) {
  console.error(`[ci:empty-deps] FAIL ${message}`);
  process.exitCode = 1;
}

function labelOf(manifest, relativePath) {
  return `${manifest.name ?? relativePath}`;
}

/**
 * 取出 dependencies 的键名；字段缺失/类型不对时直接 FAIL 并返回 null。
 */
function dependencyNames(manifest, relativePath) {
  const label = labelOf(manifest, relativePath);

  if (!Object.hasOwn(manifest, 'dependencies')) {
    fail(`${label} (${relativePath}) 缺少 dependencies 字段；多包仓库里请显式写 "dependencies": {}`);
    return null;
  }

  const dependencies = manifest.dependencies;
  if (typeof dependencies !== 'object' || dependencies === null || Array.isArray(dependencies)) {
    fail(`${label} 的 dependencies 不是对象：${JSON.stringify(dependencies)}`);
    return null;
  }

  return Object.keys(dependencies);
}

/** 普通包：dependencies 必须为空。 */
function checkEmpty(manifest, relativePath) {
  const label = labelOf(manifest, relativePath);
  const names = dependencyNames(manifest, relativePath);
  if (names === null) return null;

  if (names.length > 0) {
    fail(`${label} 的 dependencies 非空：${names.join(', ')}`);
    return null;
  }

  return label;
}

/** 构建工具包：只放行 esbuild 与 @an-ui-kit/ 前缀的包。 */
function checkBuildTool(manifest, relativePath) {
  const label = labelOf(manifest, relativePath);
  const names = dependencyNames(manifest, relativePath);
  if (names === null) return null;

  const disallowed = names.filter(
    (name) => !BUILD_TOOL_ALLOWED.includes(name) && !name.startsWith(BUILD_TOOL_ALLOWED_PREFIX),
  );

  if (disallowed.length > 0) {
    fail(
      `${label} (${relativePath}) 有超出构建工具白名单的运行时依赖：${disallowed.join(', ')}` +
        `（只允许 ${BUILD_TOOL_ALLOWED.join(', ')} 与 ${BUILD_TOOL_ALLOWED_PREFIX} 前缀的包）`,
    );
    return null;
  }

  const detail = names.length === 0 ? '无' : names.join(', ');
  return `${label}（构建工具例外：${detail}）`;
}

const packageDirs = readdirSync(PACKAGES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (packageDirs.length === 0) {
  fail('packages/ 下没有任何包');
}

const checked = [];
for (const dir of packageDirs) {
  const relativePath = `packages/${dir}/package.json`;
  const manifestPath = join(PACKAGES_DIR, dir, 'package.json');

  if (!existsSync(manifestPath)) {
    fail(`packages/${dir} 缺少 package.json`);
    continue;
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    fail(`${relativePath} 不是合法 JSON：${error instanceof Error ? error.message : String(error)}`);
    continue;
  }

  const label =
    manifest.name === BUILD_TOOL_PACKAGE
      ? checkBuildTool(manifest, relativePath)
      : checkEmpty(manifest, relativePath);
  if (label) checked.push(label);
}

if (checked.length > 0) {
  console.log(`[ci:empty-deps] OK ${checked.length} 个包 dependencies 合规：${checked.join(', ')}`);
}
