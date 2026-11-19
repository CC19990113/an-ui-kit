/**
 * `an-ui-kit init` —— 在当前目录写一份可直接用的 `an-ui-kit.config.json`。
 *
 * 默认不覆盖已有配置（配置是用户手写的，静默覆盖会丢东西），要覆盖得显式
 * `--force`。
 */
import { existsSync } from 'node:fs';
import { parseFlags, rejectPositionals } from '../lib/args.js';
import { configPathFrom, CONFIG_FILENAME, writeConfig } from '../lib/config.js';
import { CliError } from '../lib/errors.js';

const HELP = `用法：an-ui-kit init [--config <path>] [--force]

在指定路径写一份默认配置（components 为 "all"），现有文件不会被静默覆盖。

选项：
  --config <path>   配置路径（默认 ./${CONFIG_FILENAME}）
  --force           已存在时覆盖
`;

export function runInit(argv) {
  const { flags, positionals } = parseFlags(argv, { booleans: ['force', 'help'], values: ['config'] });

  if (flags.help) {
    console.log(HELP);
    return 0;
  }

  rejectPositionals(positionals, 'init');

  const configPath = configPathFrom(process.cwd(), flags.config);

  if (existsSync(configPath) && !flags.force) {
    throw new CliError(
      [
        `配置文件已存在：${configPath}`,
        '没有覆盖它。需要重写请加 --force：',
        `  an-ui-kit init --force${flags.config === undefined ? '' : ` --config ${flags.config}`}`,
      ].join('\n'),
    );
  }

  writeConfig(configPath);

  console.log(`[an-ui-kit] 已写入配置文件：${configPath}`);
  console.log('[an-ui-kit] 下一步：把 "components" 改成要打包的组件数组（例如 ["an-button"]），然后运行：');
  console.log(`  an-ui-kit generate${flags.config === undefined ? '' : ` --config ${flags.config}`}`);

  return 0;
}
