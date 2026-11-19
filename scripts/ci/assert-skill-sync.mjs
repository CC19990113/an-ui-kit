#!/usr/bin/env node
/**
 * CI 防漂移：`skills/an-ui-kit` 必须与仓库根的 CEM 同步。
 *
 * skill 是给 agent 看的契约，它比代码更容易过期：组件加了 attribute、改了名字，
 * 没人会记得回去改 markdown。这里检查三件事：
 *
 *   1. CEM 里每个 `tagName` 都在 `skills/an-ui-kit/SKILL.md` 里被提到；
 *   2. 每个 `tagName` 都有 `skills/an-ui-kit/references/<tagName>.md`；
 *      反之，references/ 下不允许有 CEM 里不存在的孤儿文件；
 *   3. 每个 reference 的 `## Attributes` 表格与 CEM 的 attributes 双向一致 ——
 *      既不能写契约里没有的 attribute（agent 会照着编），也不能漏掉新增的。
 *
 * 只比对 reference 的 Attributes **表格**：正文里的反例（如 `<an-button color="red">`）
 * 是故意写错的，不能当成契约声明。
 *
 * 退出码：0 = 同步；1 = 有缺项。
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST = join(ROOT, 'custom-elements-manifest.json');
const SKILL_DIR = join(ROOT, 'skills', 'an-ui-kit');
const SKILL_FILE = join(SKILL_DIR, 'SKILL.md');
const REFERENCES_DIR = join(SKILL_DIR, 'references');
const FIX = '改组件 JSDoc 后重跑 `pnpm cem`，再同步更新 skills/an-ui-kit/SKILL.md 与 references/<tagName>.md';

/** @type {string[]} */
const errors = [];

/** @param {string} message */
function fail(message) {
  errors.push(message);
}

/**
 * 从 CEM 里取出每个自定义元素的 tagName 与它的 attribute 名。
 *
 * @param {any} manifest 已解析的 CEM
 * @returns {Map<string, Set<string>>} tagName → attribute 名集合
 */
function readContract(manifest) {
  /** @type {Map<string, Set<string>>} */
  const components = new Map();
  for (const mod of manifest.modules ?? []) {
    for (const decl of mod.declarations ?? []) {
      if (!decl.tagName) continue;
      const attributes = new Set();
      for (const attribute of decl.attributes ?? []) {
        if (attribute?.name !== undefined) attributes.add(String(attribute.name));
      }
      components.set(decl.tagName, attributes);
    }
  }
  return components;
}

/**
 * 按未转义的 `|` 切开一行 markdown 表格。
 *
 * @param {string} line
 * @returns {string[]} 去掉首尾空单元后的单元格
 */
function splitRow(line) {
  const placeholder = '\u0000';
  const cells = line.replace(/\\\|/g, placeholder).split('|');
  // 首尾各有一个由 `| a | b |` 产生的空单元。
  if (cells.length && cells[0].trim() === '') cells.shift();
  if (cells.length && cells[cells.length - 1].trim() === '') cells.pop();
  return cells.map((cell) => cell.replaceAll(placeholder, '|'));
}

/** @param {string} cell */
function isSeparatorCell(cell) {
  return /^\s*:?-{3,}:?\s*$/.test(cell);
}

/**
 * 抽出 markdown 里某个 section 下方第一张表的第一列名字。
 *
 * @param {string} markdown
 * @param {RegExp} headingPattern 匹配 section 标题正文（不含前导 `#`）
 * @returns {{ found: boolean, names: string[], unparsed: string[] }}
 */
function readTableNames(markdown, headingPattern) {
  /** @type {string[]} */
  const names = [];
  /** @type {string[]} */
  const unparsed = [];
  let inSection = false;
  let headerSkipped = false;
  let found = false;

  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      if (inSection) {
        inSection = false;
        if (found) break; // section 结束，第一张表就是契约表
      }
      inSection = headingPattern.test(heading[1].trim());
      headerSkipped = false;
      continue;
    }
    if (!inSection) continue;
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;

    const cells = splitRow(trimmed);
    if (!cells.length || cells.every(isSeparatorCell)) continue;
    if (!headerSkipped) {
      headerSkipped = true; // 第一行是表头（名称 | 类型 | …）
      found = true;
      continue;
    }

    const raw = cells[0] ?? '';
    const name = raw.replaceAll('`', '').replaceAll('*', '').trim();
    if (/^[A-Za-z_][\w-]*$/.test(name)) names.push(name);
    else if (name) unparsed.push(name);
  }

  return { found, names, unparsed };
}

function main() {
  if (!existsSync(MANIFEST)) {
    console.error('✖ 仓库根缺少 custom-elements-manifest.json，无法校验 skill');
    console.error(`  修复：pnpm cem\n  然后：${FIX}`);
    process.exit(1);
  }

  /** @type {Map<string, Set<string>>} */
  let components;
  try {
    components = readContract(JSON.parse(readFileSync(MANIFEST, 'utf8')));
  } catch (error) {
    console.error(`✖ custom-elements-manifest.json 解析失败：${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  if (!existsSync(SKILL_FILE)) {
    console.error(`✖ 缺少 ${SKILL_FILE.slice(ROOT.length + 1)}`);
    console.error(`  修复：${FIX}`);
    process.exit(1);
  }
  const skillMarkdown = readFileSync(SKILL_FILE, 'utf8');

  // 1. SKILL.md 必须提到每个组件。
  for (const tagName of components.keys()) {
    if (!skillMarkdown.includes(tagName)) {
      fail(`skills/an-ui-kit/SKILL.md 没有提到 <${tagName}>（CEM 里有这个组件）`);
    }
  }

  // 2. references/<tagName>.md 双向对齐。
  /** @type {string[]} */
  const referenceFiles = existsSync(REFERENCES_DIR)
    ? readdirSync(REFERENCES_DIR).filter((file) => file.endsWith('.md')).sort()
    : [];
  for (const tagName of components.keys()) {
    const file = `${tagName}.md`;
    if (!referenceFiles.includes(file)) {
      fail(`缺少 skills/an-ui-kit/references/${file}（CEM 里有 <${tagName}>）`);
    }
  }
  for (const file of referenceFiles) {
    const tagName = file.slice(0, -'.md'.length);
    if (!components.has(tagName)) {
      fail(`skills/an-ui-kit/references/${file} 没有对应的 CEM 组件（没有 tagName 为 ${tagName} 的声明）`);
    }
  }

  // 3. reference 的 Attributes 表格 vs CEM 的 attributes，双向一致。
  let checkedReferences = 0;
  let checkedAttributes = 0;
  for (const tagName of components.keys()) {
    const file = `${tagName}.md`;
    if (!referenceFiles.includes(file)) continue;
    const relative = `skills/an-ui-kit/references/${file}`;
    const markdown = readFileSync(join(REFERENCES_DIR, file), 'utf8');
    checkedReferences += 1;

    const { found, names, unparsed } = readTableNames(markdown, /^attributes?$/i);
    if (!found) {
      fail(`${relative} 找不到 "## Attributes" 表格，无法核对 attribute 是否都在 CEM 里`);
      continue;
    }
    for (const cell of unparsed) {
      fail(`${relative} 的 Attributes 表格里有一行首列无法识别为 attribute 名：${cell}`);
    }

    const declared = components.get(tagName) ?? new Set();
    const documented = new Set(names);
    for (const name of documented) {
      if (!declared.has(name)) {
        fail(`${relative} 写了 CEM 里不存在的 attribute "${name}"（<${tagName}> 的 attribute：${[...declared].join(', ') || '无'}）`);
      }
    }
    for (const name of declared) {
      if (!documented.has(name)) {
        fail(`${relative} 漏了 CEM 里的 attribute "${name}"（<${tagName}> 的 attribute：${[...declared].join(', ') || '无'}）`);
      }
    }
    checkedAttributes += declared.size;
  }

  if (errors.length) {
    console.error(`✖ skill 与 CEM 不同步（${errors.length} 处）：`);
    for (const message of errors) console.error(`  - ${message}`);
    console.error('');
    console.error(`  修复：${FIX}`);
    process.exit(1);
  }

  const tagNames = [...components.keys()];
  console.log(
    `✔ skill is in sync with CEM（${tagNames.length} 个组件：${tagNames.join(', ') || '无'}；` +
      `${checkedReferences} 个 reference 文件；${checkedAttributes} 个 attribute 已双向核对）`,
  );
}

main();
