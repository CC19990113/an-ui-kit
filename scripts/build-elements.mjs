#!/usr/bin/env node
/**
 * Build `@an-ui-kit/elements` — **one entry**, optionally trimmed by JSON config.
 *
 * 为什么是「单入口 + 配置裁剪」而不是多入口：包的 `exports` 只有 `.`（以及
 * react/vue/package.json 三个适配入口）。需要更小产物的用户不换 import 路径，
 * 而是在仓库根的 `an-ui-kit.config.json` 里点名组件，生成一个只含这些组件的
 * 单文件 bundle：`dist/an-ui-kit.custom.js`。标签名、类名与注册守卫仍由同一份
 * 源码决定，所以裁剪产物的行为与全量产物逐个组件一致。
 *
 * 用法：
 *   node scripts/build-elements.mjs                      # 全量 → dist/index.js
 *   node scripts/build-elements.mjs --mode all           # 同上
 *   node scripts/build-elements.mjs --mode custom        # 裁剪 → dist/an-ui-kit.custom.js
 *   node scripts/build-elements.mjs --mode custom --components an-button,an-input
 *   node scripts/build-elements.mjs --mode custom --out /tmp/an-ui-kit.custom.js
 *   node scripts/build-elements.mjs --mode custom --config /tmp/my.config.json
 *   node scripts/build-elements.mjs --mode custom --no-minify
 *
 * 组件清单**从源码目录扫描**：`packages/elements/src/<dir>/an-<tag>.ts`（见
 * scripts/lib/elements.mjs）。配置里出现未知标签会报错并列出可用组件。
 *
 * 配置（仓库根 `an-ui-kit.config.json`，不存在等价于 "all"）：
 *   { "components": "all" }
 *   { "components": ["an-button"] }
 *
 * 两种模式的产物：
 *   all    → packages/elements/dist/index.js   （npm 发布产物，行为与之前一致）
 *   custom → packages/elements/dist/an-ui-kit.custom.js（或 --out 指定的路径）
 *
 * 类型：
 *   all    由 `tsc -p tsconfig.build.json` 产出 `dist/index.d.ts`（package.json 的
 *          build 脚本两步串联）。
 *   custom 不产出 d.ts：类型仍是全量 `dist/index.d.ts` 的公共超集，裁剪只影响运行时
 *          字节；需要强类型就 import 全量包的类型。
 *
 * 零第三方依赖：Node 内置 + 仓库已装的 esbuild。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  CONFIG_PATH,
  ELEMENTS_DIR,
  ROOT,
  SRC_DIR,
  describeBytes,
  discoverComponents,
  gzipSize,
  loadEsbuild,
  relativeToRoot,
} from './lib/elements.mjs';

const USAGE = `用法：
  node scripts/build-elements.mjs [--mode all|custom] [选项]

选项：
  --mode all|custom   构建模式，默认 all（全量单入口，产 dist/index.js）
  --components <a,b>  仅裁剪模式：命令行点名组件，覆盖配置文件（CI 断言用）
  --config <path>     仅裁剪模式：配置文件路径，默认仓库根 an-ui-kit.config.json
  --out <path>        仅裁剪模式：覆盖输出路径（相对路径按当前目录解析）
  --no-minify         仅裁剪模式：不压缩，便于排查产物
  -h, --help          打印本帮助

示例：
  node scripts/build-elements.mjs --mode custom --components an-button --out /tmp/x.js
`;

/** @param {string[]} argv */
function parseArgs(argv) {
  const options = {
    mode: 'all',
    out: null,
    components: null,
    config: null,
    minify: true,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const [flag, inlineValue] = arg.includes('=')
      ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)]
      : [arg, undefined];

    const takeValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const next = argv[index + 1];
      if (next === undefined || next.startsWith('--')) {
        throw new Error(`${flag} 需要一个值（见 --help）`);
      }
      index += 1;
      return next;
    };

    switch (flag) {
      case '--mode':
        options.mode = takeValue();
        break;
      case '--components':
        options.components = takeValue();
        break;
      case '--config':
        options.config = path.resolve(process.cwd(), takeValue());
        break;
      case '--out':
        options.out = takeValue();
        break;
      case '--no-minify':
        if (inlineValue !== undefined) throw new Error('--no-minify 不接受值');
        options.minify = false;
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
      default:
        throw new Error(`未知参数 ${arg}（见 --help）`);
    }
  }

  if (options.help) return options;
  if (options.mode !== 'all' && options.mode !== 'custom') {
    throw new Error(`--mode 只能是 all 或 custom，收到 "${options.mode}"`);
  }
  if (options.mode === 'all' && options.out !== null) {
    throw new Error('--out 只适用于 --mode custom；全量产物的路径固定为 packages/elements/dist/index.js');
  }
  if (options.mode === 'all' && options.components !== null) {
    throw new Error('--components 只适用于 --mode custom；全量模式固定打包所有组件');
  }
  if (options.mode === 'all' && options.config !== null) {
    throw new Error('--config 只适用于 --mode custom；全量模式永远打包所有组件，不读配置');
  }
  if (options.mode === 'all' && !options.minify) {
    throw new Error('--no-minify 只适用于 --mode custom；全量发布产物必须压缩');
  }
  return options;
}

/**
 * @param {string} configPath
 * @returns {{ components: 'all' | string[], source: string }}
 */
function readConfig(configPath) {
  if (!existsSync(configPath)) {
    return { components: 'all', source: '未找到配置文件，按 "all" 处理' };
  }

  let raw;
  try {
    raw = readFileSync(configPath, 'utf8');
  } catch (cause) {
    throw new Error(`读不到配置文件 ${relativeToRoot(configPath)}：${cause instanceof Error ? cause.message : String(cause)}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new Error(
      `配置文件 ${relativeToRoot(configPath)} 不是合法 JSON：${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`配置文件 ${relativeToRoot(configPath)} 必须是 JSON 对象（见 schema/an-ui-kit.config.schema.json）`);
  }

  const value = parsed.components;
  if (value === undefined) {
    throw new Error(`配置文件 ${relativeToRoot(configPath)} 缺少 components 字段；全量请写 "all"（见 schema/）`);
  }
  if (value === 'all') {
    return { components: 'all', source: `${relativeToRoot(configPath)}（"all"）` };
  }
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`components 必须是 "all" 或非空字符串数组；收到 ${JSON.stringify(value)}`);
  }
  if (value.some((item) => typeof item !== 'string' || item.trim() === '')) {
    throw new Error(`components 数组里只能放组件标签名（如 "an-button"）；收到 ${JSON.stringify(value)}`);
  }

  const tags = [...new Set(value.map((item) => item.trim()))];
  return { components: tags, source: `${relativeToRoot(configPath)}（${tags.length} 个组件）` };
}

/**
 * 生成 esbuild 的 stdin 虚拟入口：按配置逐个组件生成 import / export / 注册语句。
 *
 * 为什么是显式 `export { AnButton }` 而不是 `export * from './button/an-button'`：
 * 组件模块为了单测还导出了 `VARIANTS` / `SIZES` / `TYPES` 这类实现常量，`export *`
 * 会把它们一起泄进 `dist/index.js`，而公共类型面 `dist/index.d.ts`（由 `src/index.ts`
 * 经 tsc 产出）并不包含它们 —— 运行时导出和类型面就对不上了。显式导出保证全量产物
 * 的导出面与改动前完全一致（`AnElement` + 各组件类），裁剪产物也遵循同一条规则。
 *
 * `./internal/base` 始终导出：`AnElement` 是公共 API，且每个组件都依赖它。
 * 组件模块本身不自注册（注册是入口的职责，见 CONTRACT.md §1），所以入口必须带上
 * `customElements.get()` 守卫的注册语句，否则产物只导出类、不会定义元素。
 *
 * @param {ReturnType<typeof discoverComponents>} components
 */
function renderEntry(components) {
  const lines = [
    '// 由 scripts/build-elements.mjs 为本次构建生成，不落盘、不手改。',
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(USAGE);
    return;
  }

  const discovered = discoverComponents();
  const known = new Map(discovered.map((component) => [component.tag, component]));

  /**
   * @param {string[]} tags
   * @returns {ReturnType<typeof discoverComponents>}
   */
  const pick = (tags) => {
    const trimmed = tags.map((tag) => tag.trim()).filter(Boolean);
    if (trimmed.length === 0) throw new Error('没有选中任何组件；至少给一个标签名（见 --help）');
    const unknown = trimmed.filter((tag) => !known.has(tag));
    if (unknown.length > 0) {
      throw new Error(
        `配置里有未知组件：${unknown.join(', ')}\n可用组件：${discovered.map((component) => component.tag).join(', ')}`,
      );
    }
    return [...new Set(trimmed)].map((tag) => known.get(tag));
  };

  /** @type {ReturnType<typeof discoverComponents>} */
  let selected;
  /** @type {string} */
  let componentSource;
  if (options.mode === 'all') {
    // 全量模式不读配置：npm 发布产物必须始终包含所有组件，配置只用于裁剪。
    selected = discovered;
    componentSource = '全量模式（不读配置）';
  } else if (options.components !== null) {
    selected = pick(options.components.split(','));
    componentSource = '命令行 --components（覆盖配置文件）';
  } else {
    const config = readConfig(options.config ?? CONFIG_PATH);
    selected = config.components === 'all' ? discovered : pick(config.components);
    componentSource = config.source;
  }

  const outfile =
    options.mode === 'all'
      ? path.join(ELEMENTS_DIR, 'dist', 'index.js')
      : options.out !== null
        ? path.resolve(process.cwd(), options.out)
        : path.join(ELEMENTS_DIR, 'dist', 'an-ui-kit.custom.js');

  const esbuild = loadEsbuild();
  const startedAt = Date.now();
  const result = await esbuild.build({
    stdin: {
      contents: renderEntry(selected),
      resolveDir: SRC_DIR,
      sourcefile: 'an-ui-kit.entry.ts',
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    minify: options.minify,
    loader: { '.css': 'text' },
    outfile,
    write: false,
    logLevel: 'warning',
  });

  const output = result.outputFiles?.[0];
  if (!output) throw new Error('esbuild 没有返回产物');

  mkdirSync(path.dirname(outfile), { recursive: true });
  writeFileSync(outfile, output.contents);
  const rawBytes = output.contents.byteLength;
  const gzippedBytes = gzipSize(output.contents);

  console.log(`[build:elements] 模式：${options.mode}`);
  console.log(`[build:elements] 组件来源：${componentSource}`);
  console.log(`[build:elements] 组件（${selected.length}）：${selected.map((component) => component.tag).join(', ')}`);
  console.log(`[build:elements] 输出：${relativeToRoot(outfile)}`);
  console.log(`[build:elements] raw：${describeBytes(rawBytes)}`);
  console.log(`[build:elements] gzip（level 9）：${describeBytes(gzippedBytes)}`);
  console.log(`[build:elements] 压缩：${options.minify ? 'on' : 'off（--no-minify）'}`);
  console.log(`[build:elements] 耗时：${Date.now() - startedAt}ms`);

  if (options.mode === 'all') {
    console.log('[build:elements] 类型：由 tsc -p tsconfig.build.json 产出 dist/index.d.ts（下一步）');
  } else {
    console.log('[build:elements] 类型：无 —— 裁剪产物不带 d.ts，类型请用全量 dist/index.d.ts');
  }
}

main().catch((error) => {
  console.error(`[build:elements] ERROR ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
