/**
 * `@an-ui-kit/cli` 端到端测试：全部用 `node dist/cli.js ...` 走真实命令行路径，
 * 不 import 源码 —— 这样 bin、shebang、打包产物与依赖解析都在测试覆盖内。
 *
 * 第 6 条用「最小 DOM 环境」而不是 happy-dom：组件只在模块顶层调用
 * `customElements.get/define`，import 阶段不碰 document / shadow DOM
 * （`internal/base.ts` 对 `typeof document === 'undefined'` 有守卫），所以一个
 * `HTMLElement` + `customElements` 的 shim 就够验证产物是可执行 ESM。取舍是
 * 不测「渲染出 shadow DOM」，那由 elements 包自己的 vitest 套件负责；换来的是
 * CLI 不必为测试新增任何依赖。
 */
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const cliPath = join(packageRoot, 'dist', 'cli.js');
const elementsRoot = join(packageRoot, '..', 'elements');

/** @type {string[]} */
const temporaryDirs = [];

/** dist 没构建过就先跑一次 build，让 `node --test test/cli.test.js` 也能单跑。 */
before(async () => {
  try {
    await access(cliPath);
  } catch {
    execFileSync(process.execPath, [join(packageRoot, 'scripts', 'build.mjs')], {
      cwd: packageRoot,
      stdio: 'inherit',
    });
  }
});

after(async () => {
  await Promise.all(temporaryDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** 每个用例一个临时项目目录，互不干扰。 */
async function project() {
  const dir = await mkdtemp(join(tmpdir(), 'an-ui-kit-cli-'));
  temporaryDirs.push(dir);
  return dir;
}

/** @returns {Promise<{ code: number, stdout: string, stderr: string }>} */
function runCli(args, { cwd } = {}) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [cliPath, ...args],
      { cwd, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, NO_COLOR: '1' } },
      (error, stdout, stderr) => {
        const code = error === null ? 0 : typeof error.code === 'number' ? error.code : 1;
        resolve({ code, stdout, stderr });
      },
    );
  });
}

test('list 输出两个组件标签、包版本与绝对路径', async () => {
  const { code, stdout, stderr } = await runCli(['list'], { cwd: packageRoot });

  assert.equal(code, 0, stderr);
  assert.match(stdout, /an-button/);
  assert.match(stdout, /an-input/);
  assert.match(stdout, /@an-ui-kit\/elements@\d+\.\d+\.\d+/);
  assert.ok(stdout.includes(elementsRoot), `stdout 应含 elements 包绝对路径 ${elementsRoot}：\n${stdout}`);
});

test('init 写配置；已存在被拒；--force 才能覆盖', async () => {
  const dir = await project();
  const configPath = join(dir, 'an-ui-kit.config.json');

  const first = await runCli(['init'], { cwd: dir });
  assert.equal(first.code, 0, first.stderr);

  const config = JSON.parse(await readFile(configPath, 'utf8'));
  assert.equal(config.components, 'all');
  assert.ok(typeof config.$schema === 'string' && config.$schema.startsWith('https://'));

  const second = await runCli(['init'], { cwd: dir });
  assert.notEqual(second.code, 0, '重复 init 应该失败');
  assert.match(second.stderr, /已存在/);
  assert.match(second.stderr, /--force/);

  // 被拒绝时不能改动原文件。
  assert.equal(JSON.parse(await readFile(configPath, 'utf8')).components, 'all');

  await writeFile(configPath, '{ "components": ["an-button"] }\n', 'utf8');
  const forced = await runCli(['init', '--force'], { cwd: dir });
  assert.equal(forced.code, 0, forced.stderr);
  assert.equal(JSON.parse(await readFile(configPath, 'utf8')).components, 'all');

  // --config 指向子目录时父目录要自动创建。
  const custom = await runCli(['init', '--config', join('nested', 'custom.json')], { cwd: dir });
  assert.equal(custom.code, 0, custom.stderr);
  assert.equal(JSON.parse(await readFile(join(dir, 'nested', 'custom.json'), 'utf8')).components, 'all');
});

test('generate 默认读配置 "all"，产物含两个组件', async () => {
  const dir = await project();
  await writeFile(join(dir, 'an-ui-kit.config.json'), JSON.stringify({ components: 'all' }, null, 2), 'utf8');

  const { code, stdout, stderr } = await runCli(['generate'], { cwd: dir });
  assert.equal(code, 0, stderr);

  const outPath = join(dir, 'an-ui-kit.bundle.js');
  const bundled = await readFile(outPath, 'utf8');
  assert.match(bundled, /an-button/);
  assert.match(bundled, /an-input/);

  assert.match(stdout, /模式：all/);
  assert.match(stdout, /组件（2）：an-button, an-input/);
  assert.ok(stdout.includes(outPath), `stdout 应含产物绝对路径 ${outPath}：\n${stdout}`);
  assert.match(stdout, /raw：\d+ B/);
  assert.match(stdout, /gzip（level 9）：\d+ B/);
});

test('generate --components an-button 的产物不含 an-input / AnInput', async () => {
  const dir = await project();

  // 配置写着 all，命令行必须能覆盖它。
  await writeFile(join(dir, 'an-ui-kit.config.json'), JSON.stringify({ components: 'all' }, null, 2), 'utf8');

  const { code, stdout, stderr } = await runCli(
    ['generate', '--components', 'an-button', '--out', 'one.js'],
    { cwd: dir },
  );
  assert.equal(code, 0, stderr);

  const bundled = await readFile(join(dir, 'one.js'), 'utf8');
  assert.match(bundled, /an-button/);
  assert.match(bundled, /AnButton/);
  assert.doesNotMatch(bundled, /an-input/);
  assert.doesNotMatch(bundled, /AnInput/);
  assert.match(stdout, /模式：custom/);
});

test('未知组件名 → 非 0 退出码 + 错误里列出可用组件', async () => {
  const dir = await project();

  const { code, stderr } = await runCli(['generate', '--components', 'an-nope'], { cwd: dir });

  assert.notEqual(code, 0, '未知组件必须失败');
  assert.match(stderr, /未知组件/);
  assert.match(stderr, /an-nope/);
  assert.match(stderr, /an-button/);
  assert.match(stderr, /an-input/);
});

test('配置里有拼错的字段名 → 报错，而不是静默退化成 all', async () => {
  const dir = await project();
  await writeFile(
    join(dir, 'an-ui-kit.config.json'),
    JSON.stringify({ component: ['an-button'] }, null, 2),
    'utf8',
  );

  const { code, stderr } = await runCli(['generate'], { cwd: dir });

  assert.notEqual(code, 0);
  assert.match(stderr, /未支持的字段/);
  assert.match(stderr, /component/);
  assert.match(stderr, /components/);
});

test('产物是合法 ESM：在最小 DOM 环境里完成 customElements.define', async () => {
  const dir = await project();
  const outPath = join(dir, 'esm.js');

  const generated = await runCli(
    ['generate', '--components', 'an-button,an-input', '--out', basename(outPath)],
    { cwd: dir },
  );
  assert.equal(generated.code, 0, generated.stderr);

  const probe = `
    globalThis.HTMLElement = class HTMLElement {};
    const registry = new Map();
    globalThis.customElements = {
      get: (name) => registry.get(name),
      define: (name, constructor) => { registry.set(name, constructor); },
    };
    await import(${JSON.stringify(pathToFileURL(outPath).href)});
    console.log(JSON.stringify([...registry.keys()]));
  `;

  const { code, stdout, stderr } = await new Promise((resolve) => {
    execFile(
      process.execPath,
      ['--input-type=module', '-e', probe],
      { maxBuffer: 16 * 1024 * 1024 },
      (error, out, err) => resolve({ code: error === null ? 0 : 1, stdout: out, stderr: err }),
    );
  });

  assert.equal(code, 0, stderr);
  const registered = JSON.parse(stdout.trim().split('\n').at(-1));
  assert.deepEqual(registered, ['an-button', 'an-input']);
});
