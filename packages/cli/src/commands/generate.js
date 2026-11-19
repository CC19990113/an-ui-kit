/**
 * `an-ui-kit generate` —— 按配置裁剪组件，产出一个单文件 ESM bundle。
 *
 * 组件来源只有一处：已安装 `@an-ui-kit/elements` 的 `src/`（通过 resolveElements
 * 定位）。配置里的组件名必须是这里扫描到的标签，否则直接报错并列出可用标签，
 * 不做「猜你想选哪个」的模糊匹配。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseFlags, rejectPositionals } from '../lib/args.js';
import { bundleComponents, describeBytes } from '../lib/bundle.js';
import { configPathFrom, CONFIG_FILENAME, readConfig } from '../lib/config.js';
import { resolveElements } from '../lib/elements.js';
import { CliError, UsageError } from '../lib/errors.js';

/** 默认输出到 cwd 下这个文件名（与仓库根 `.gitignore` 无关，纯约定）。 */
export const DEFAULT_OUT = 'an-ui-kit.bundle.js';

const HELP = `用法：an-ui-kit generate [--config <path>] [--components a,b] [--out <path>] [--no-minify]

读配置 → 只打包选中的组件 → 写一个自包含的单文件 ESM bundle（不含 npm 依赖）。

选项：
  --config <path>     配置路径（默认 ./${CONFIG_FILENAME}；不存在按 "all" 处理）
  --components a,b    覆盖配置里的组件清单（逗号分隔；也接受 all）
  --out <path>        输出路径（默认 ./${DEFAULT_OUT}）
  --no-minify         关闭压缩，便于调试产物
`;

export async function runGenerate(argv) {
  const { flags, positionals } = parseFlags(argv, {
    booleans: ['no-minify', 'help'],
    values: ['config', 'components', 'out'],
  });

  if (flags.help) {
    console.log(HELP);
    return 0;
  }

  rejectPositionals(positionals, 'generate');

  const cwd = process.cwd();
  const configPath = configPathFrom(cwd, flags.config);
  const elements = resolveElements();
  const config = readConfig(configPath);

  const requested = flags.components === undefined ? config.components : parseComponentArgument(flags.components);
  const selected = selectComponents(elements.components, requested);

  const outPath = resolve(cwd, flags.out ?? DEFAULT_OUT);
  const minify = flags['no-minify'] !== true;

  const origin =
    flags.components !== undefined
      ? '命令行 --components（覆盖配置）'
      : config.existed
        ? configPath
        : `未找到 ${configPath}，按 "all" 处理`;

  console.log(`[an-ui-kit] @an-ui-kit/elements@${elements.version}（${elements.packageRoot}）`);
  console.log(`[an-ui-kit] 配置来源：${origin}`);
  console.log(`[an-ui-kit] 模式：${selected.length === elements.components.length ? 'all' : 'custom'}`);
  console.log(`[an-ui-kit] 组件（${selected.length}）：${selected.map((component) => component.tag).join(', ')}`);
  console.log(`[an-ui-kit] 压缩：${minify ? '开启（esbuild minify）' : '关闭（--no-minify）'}`);

  const bundle = await bundleComponents({ srcDir: elements.srcDir, components: selected, minify });

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, bundle.contents);

  console.log(`[an-ui-kit] 输出：${outPath}`);
  console.log(`[an-ui-kit] raw：${describeBytes(bundle.rawBytes)}`);
  console.log(`[an-ui-kit] gzip（level 9）：${describeBytes(bundle.gzipBytes)}`);

  return 0;
}

/** `--components an-button,an-input`；`all` 是「全部」的快捷写法。 */
function parseComponentArgument(raw) {
  const tags = raw
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '');

  if (tags.length === 0) throw new UsageError('--components 需要一个逗号分隔的组件名，例如 an-button,an-input');
  if (tags.length === 1 && tags[0] === 'all') return 'all';

  return tags;
}

/**
 * 把配置/命令行给的组件名映射到扫描结果。
 *
 * @param {import('../lib/elements.js').Component[]} available
 * @param {'all' | string[]} requested
 * @returns {import('../lib/elements.js').Component[]}
 */
function selectComponents(available, requested) {
  if (requested === 'all') return available;

  const known = new Map(available.map((component) => [component.tag, component]));
  const tags = [...new Set(requested)];
  const unknown = tags.filter((tag) => !known.has(tag));

  if (unknown.length > 0) {
    throw new CliError(
      [
        `未知组件：${unknown.join(', ')}`,
        `可用组件（${available.length}）：${available.map((component) => component.tag).join(', ')}`,
        '也可以用 `--components all` 打包全部组件；`an-ui-kit list` 可随时查看清单。',
      ].join('\n'),
    );
  }

  // 按扫描顺序输出，产物里的注册顺序不随命令行参数的书写顺序抖动。
  return available.filter((component) => tags.includes(component.tag));
}
