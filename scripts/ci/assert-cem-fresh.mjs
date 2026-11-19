#!/usr/bin/env node
/**
 * CI 防漂移：仓库根的 `custom-elements-manifest.json` 必须等于「现在重新扫一遍」的结果。
 *
 * 为什么需要这一步：CI 不会自动重跑 `pnpm cem`。改了组件 JSDoc 却忘了重跑时，
 * 仓库里的 CEM 会一直是旧的，registry / MCP / skill 都跟着发布旧契约，而现有的
 * 类型检查、构建、单测、体积预算**全都不会红**。这个断言就是那道闸。
 *
 * 做法（只读，绝不改写仓库里的那份 CEM）：
 *   1. 读入仓库里的 `custom-elements-manifest.json`；
 *   2. 用仓库 devDependency 的 x-cem 重新扫描，输出到 `os.tmpdir()` 下的临时文件
 *      （不是仓库内的任何路径，避免污染工作区）；
 *   3. 与仓库里那份**逐字节**比对 —— `pnpm cem` 的输出是确定的，所以格式/换行
 *      差异也算漂移；
 *   4. 不一致 → 打印结构化差异与修复命令，exit 1。
 *
 * 退出码：0 = 新鲜；1 = 过期或无法重新生成。
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST = join(ROOT, 'custom-elements-manifest.json');
const SRC = 'packages/elements/src';
const FIX = 'pnpm cem && pnpm registry && pnpm --filter @an-ui-kit/mcp build';

/** CEM declaration 上属于「对外契约」的四个表，用来生成可读的差异说明。 */
const CONTRACT_TABLES = ['attributes', 'events', 'slots', 'cssProperties', 'cssParts'];

/**
 * 重新扫描一份 CEM 到 `outFile`。
 *
 * 优先走 `pnpm exec x-cem`（用的是仓库 devDependency，不会像 `npx x-cem`
 * 那样去远端解析版本）；pnpm 不可用时退回到本地的 `node_modules/.bin/x-cem`。
 *
 * @param {string} outFile 临时文件路径（必须不在仓库里）
 * @returns {string} 实际使用的命令，仅用于日志
 */
function scanTo(outFile) {
  /** @type {{cmd: string, args: string[], label: string}[]} */
  const attempts = [
    { cmd: 'pnpm', args: ['exec', 'x-cem', 'scan', '--src', SRC, '--out', outFile], label: 'pnpm exec x-cem' },
  ];
  const localBin = join(ROOT, 'node_modules', '.bin', 'x-cem');
  if (existsSync(localBin)) {
    attempts.push({ cmd: localBin, args: ['scan', '--src', SRC, '--out', outFile], label: 'node_modules/.bin/x-cem' });
  }

  /** @type {string[]} */
  const failures = [];
  for (const attempt of attempts) {
    const result = spawnSync(attempt.cmd, attempt.args, { cwd: ROOT, encoding: 'utf8' });
    if (result.error) {
      failures.push(`${attempt.label} 无法执行：${result.error.message}`);
      continue;
    }
    if (result.status !== 0) {
      const stderr = (result.stderr || '').trim();
      failures.push(`${attempt.label} 退出码 ${result.status}${stderr ? `\n${stderr}` : ''}`);
      continue;
    }
    if (!existsSync(outFile)) {
      failures.push(`${attempt.label} 成功退出但没有写出 ${outFile}`);
      continue;
    }
    return attempt.label;
  }

  throw new Error(
    `无法用 x-cem 重新生成 CEM（扫描 ${SRC} 失败）。源码本身可能已经编译不过，\n` +
      `请先手动跑一次 \`pnpm cem\` 看具体报错：\n\n${failures.join('\n\n')}`,
  );
}

/**
 * 把两份 CEM 的 JSON 结构差异压成人能读的行。
 *
 * @param {Buffer} staleBuf 仓库里的那份
 * @param {Buffer} freshBuf 重新扫描的那份
 * @returns {string[]}
 */
function describeDiff(staleBuf, freshBuf) {
  const staleText = staleBuf.toString('utf8');
  const freshText = freshBuf.toString('utf8');

  let stale;
  let fresh;
  try {
    stale = JSON.parse(staleText);
    fresh = JSON.parse(freshText);
  } catch {
    return ['  （两份 CEM 无法按 JSON 解析，只报告字节差异）'];
  }

  if (JSON.stringify(stale) === JSON.stringify(fresh)) {
    return [
      '  内容等价，只是字节不同（格式 / 字段顺序 / 换行）。',
      '  直接跑一次 `pnpm cem` 把文件重写成生成器的标准输出即可。',
    ];
  }

  const lines = [];
  const collected = (manifest) => {
    /** @type {Map<string, Record<string, Set<string>>>} */
    const map = new Map();
    for (const mod of manifest.modules ?? []) {
      for (const decl of mod.declarations ?? []) {
        if (!decl.tagName) continue;
        /** @type {Record<string, Set<string>>} */
        const tables = { attributes: new Set(), events: new Set(), slots: new Set(), cssProperties: new Set(), cssParts: new Set() };
        for (const table of CONTRACT_TABLES) {
          for (const item of decl[table] ?? []) {
            if (item?.name !== undefined) tables[table].add(String(item.name));
          }
        }
        map.set(decl.tagName, tables);
      }
    }
    return map;
  };

  const staleTags = collected(stale);
  const freshTags = collected(fresh);

  for (const tag of freshTags.keys()) {
    if (!staleTags.has(tag)) lines.push(`  <${tag}> 是新扫描才有的组件（仓库里的 CEM 漏了它）`);
  }
  for (const tag of staleTags.keys()) {
    if (!freshTags.has(tag)) lines.push(`  <${tag}> 只在仓库里的 CEM 中（源码已经删掉或改名）`);
  }

  for (const [tag, freshTables] of freshTags) {
    const staleTables = staleTags.get(tag);
    if (!staleTables) continue;
    for (const table of CONTRACT_TABLES) {
      const added = [...freshTables[table]].filter((name) => !staleTables[table].has(name));
      const removed = [...staleTables[table]].filter((name) => !freshTables[table].has(name));
      const label = table === 'attributes' ? 'attribute' : table === 'events' ? 'event' : table === 'slots' ? 'slot' : table === 'cssProperties' ? 'CSS 变量' : 'CSS part';
      if (added.length) lines.push(`  <${tag}> 新增 ${label}：${added.join(', ')}（源码里有，仓库里的 CEM 没有）`);
      if (removed.length) lines.push(`  <${tag}> 少了 ${label}：${removed.join(', ')}（仓库里的 CEM 是旧的）`);
    }
  }

  const firstDiffLine = () => {
    const a = staleText.split('\n');
    const b = freshText.split('\n');
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
      if (a[i] !== b[i]) return { line: i + 1, stale: a[i], fresh: b[i] };
    }
    return null;
  };
  const at = firstDiffLine();
  if (at) {
    const clip = (text) => (text === undefined ? '<行尾>' : text.length > 160 ? `${text.slice(0, 160)}…` : text);
    lines.push(`  第一处差异在第 ${at.line} 行：`);
    lines.push(`    仓库里的：${clip(at.stale)}`);
    lines.push(`    重新扫描：${clip(at.fresh)}`);
  }

  return lines;
}

function main() {
  if (!existsSync(MANIFEST)) {
    console.error('✖ 仓库根缺少 custom-elements-manifest.json（生成物本应被 commit）');
    console.error('  修复：pnpm cem && pnpm registry && pnpm --filter @an-ui-kit/mcp build');
    process.exit(1);
  }

  const committed = readFileSync(MANIFEST);
  const workDir = mkdtempSync(join(tmpdir(), 'x-cem-fresh-'));
  const scannedPath = join(workDir, 'custom-elements-manifest.json');

  try {
    const command = scanTo(scannedPath);
    const fresh = readFileSync(scannedPath);

    // 双保险：扫描过程绝不允许写回仓库里的那份 CEM。
    if (!readFileSync(MANIFEST).equals(committed)) {
      console.error('✖ 断言脚本意外改写了仓库里的 custom-elements-manifest.json（本脚本本应只读）');
      console.error('  请检查 x-cem 的 --out 参数是否被忽略。');
      process.exit(1);
    }

    if (committed.equals(fresh)) {
      const parsed = JSON.parse(committed.toString('utf8'));
      const declarations = (parsed.modules ?? []).flatMap((mod) => mod.declarations ?? []);
      const tagNames = declarations.filter((decl) => decl.tagName).map((decl) => decl.tagName);
      console.log(`✔ CEM is fresh（${tagNames.length} 个自定义元素：${tagNames.join(', ')}；${declarations.length} 个声明；命令：${command}）`);
      return;
    }

    console.error('✖ custom-elements-manifest.json 已过期（源码改了但没重跑 pnpm cem）');
    console.error(`  修复：${FIX}`);
    console.error('');
    console.error('  重新扫描的结果与仓库里的那份不一致：');
    for (const line of describeDiff(committed, fresh)) console.error(line);
    process.exit(1);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  console.error(`✖ ${reason}`);
  console.error('');
  console.error(`  修好源码后再跑：${FIX}`);
  process.exit(1);
}
