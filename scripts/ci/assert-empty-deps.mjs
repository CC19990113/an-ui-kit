#!/usr/bin/env node
/**
 * CI 硬红线：每个 `packages/` 子包的 `dependencies` 必须是空对象。
 *
 * 组件产物零第三方运行时依赖，框架适配层只是 `.d.ts`；构建期工具
 * 一律放 devDependencies。这个断言在构建/测试之后跑，确保没人偷偷加依赖。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PACKAGES_DIR = join(ROOT, 'packages');

function fail(message) {
  console.error(`[ci:empty-deps] FAIL ${message}`);
  process.exitCode = 1;
}

function checkEmpty(file, relativePath) {
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  const label = `${pkg.name ?? relativePath}`;

  if (!Object.hasOwn(pkg, 'dependencies')) {
    fail(`${label} (${relativePath}) 缺少 dependencies 字段；多包仓库里请显式写 "dependencies": {}`);
    return null;
  }

  const dependencies = pkg.dependencies;
  if (typeof dependencies !== 'object' || dependencies === null || Array.isArray(dependencies)) {
    fail(`${label} 的 dependencies 不是对象：${JSON.stringify(dependencies)}`);
    return null;
  }

  const keys = Object.keys(dependencies);
  if (keys.length > 0) {
    fail(`${label} 的 dependencies 非空：${keys.join(', ')}`);
    return null;
  }

  return label;
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
  const manifest = join(PACKAGES_DIR, dir, 'package.json');
  if (!existsSync(manifest)) {
    fail(`packages/${dir} 缺少 package.json`);
    continue;
  }
  const label = checkEmpty(manifest, `packages/${dir}/package.json`);
  if (label) checked.push(label);
}

if (checked.length > 0) {
  console.log(
    `[ci:empty-deps] OK ${checked.length} 个包 dependencies 均为 {}：${checked.join(', ')}`,
  );
}
