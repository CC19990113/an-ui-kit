/**
 * `an-ui-kit` CLI 入口：解析子命令 → 执行 → 统一错误出口。
 *
 * 零框架：参数解析在 `lib/args.js`，错误分成 `UsageError`（附用法）与
 * `CliError`（只给一句人话），所以使用者看不到半截堆栈。
 */
import { runGenerate } from './commands/generate.js';
import { runInit } from './commands/init.js';
import { runList } from './commands/list.js';
import { CliError, UsageError } from './lib/errors.js';

/** 由 `scripts/build.mjs` 在打包时用 define 注入。 */
const VERSION = typeof __CLI_VERSION__ === 'string' ? __CLI_VERSION__ : '0.0.0-dev';

export const USAGE = `an-ui-kit —— 按配置裁剪 @an-ui-kit/elements，生成单文件 ESM bundle

用法：
  an-ui-kit <命令> [选项]

命令：
  list        列出可用组件标签（扫描已安装 @an-ui-kit/elements 的 src/）
  init        在当前目录写 an-ui-kit.config.json
  generate    按配置生成只含选中组件的单文件 bundle

通用选项：
  -h, --help    打印这份用法
  --version     打印 CLI 版本（当前 ${VERSION}）

示例：
  npx @an-ui-kit/cli init
  npx @an-ui-kit/cli generate --components an-button --out ./src/vendor/an-ui-kit.js
  npx @an-ui-kit/cli generate --config ./config/an-ui-kit.config.json

每个子命令都支持 --help，例如 \`an-ui-kit generate --help\`。
`;

export async function main(argv) {
  const [command, ...rest] = argv;

  if (command === undefined) {
    console.log(USAGE);
    return 1;
  }

  if (command === '--version' || command === '-v') {
    console.log(VERSION);
    return 0;
  }

  switch (command) {
    case '-h':
    case '--help':
    case 'help':
      console.log(USAGE);
      return 0;
    case 'list':
      return runList(rest);
    case 'init':
      return runInit(rest);
    case 'generate':
      return runGenerate(rest);
    default:
      console.error(`[an-ui-kit] 未知命令：${command}`);
      console.error('');
      console.error(USAGE);
      return 1;
  }
}

function report(error) {
  if (error instanceof UsageError) {
    console.error(`[an-ui-kit] ${error.message}`);
    console.error('');
    console.error(USAGE);
    return;
  }

  if (error instanceof CliError) {
    console.error(`[an-ui-kit] 错误：${error.message}`);
    return;
  }

  console.error(`[an-ui-kit] 内部错误：${error instanceof Error ? error.message : String(error)}`);
  if (process.env.AN_UI_KIT_DEBUG) console.error(error);
}

// 只作为 bin 使用（package.json 只暴露 bin，没有 import 入口），所以直接执行。
try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  report(error);
  process.exitCode = 1;
}
