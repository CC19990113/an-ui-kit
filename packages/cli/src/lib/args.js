/**
 * 极简 argv 解析。CLI 不引 commander/yargs：只有「布尔开关」和「带值选项」
 * 两类参数，支持 `--out x`、`--out=x` 与 `-h`，零依赖、行为一眼能看懂。
 */
import { UsageError } from './errors.js';

/**
 * @param {string[]} argv 去掉命令名之后的参数
 * @param {{ booleans?: string[], values?: string[] }} spec 允许的开关
 * @returns {{ flags: Record<string, string | true>, positionals: string[] }}
 */
export function parseFlags(argv, { booleans = [], values = [] } = {}) {
  const booleanNames = new Set(booleans);
  const valueNames = new Set(values);
  /** @type {Record<string, string | true>} */
  const flags = {};
  /** @type {string[]} */
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--') {
      positionals.push(...argv.slice(index + 1));
      break;
    }

    if (!arg.startsWith('-') || arg === '-') {
      positionals.push(arg);
      continue;
    }

    if (arg === '-h') {
      flags.help = true;
      continue;
    }

    if (!arg.startsWith('--')) {
      throw new UsageError(`未知参数 ${arg}（-h 是唯一可用的短选项）`);
    }

    let name = arg.slice(2);
    /** @type {string | undefined} */
    let inline;

    const equalsAt = name.indexOf('=');
    if (equalsAt !== -1) {
      inline = name.slice(equalsAt + 1);
      name = name.slice(0, equalsAt);
    }

    if (name === '') {
      throw new UsageError(`无法识别的参数 ${arg}`);
    }

    if (booleanNames.has(name)) {
      if (inline !== undefined) throw new UsageError(`--${name} 是开关，不接受值`);
      flags[name] = true;
      continue;
    }

    if (valueNames.has(name)) {
      if (inline !== undefined) {
        if (inline === '') throw new UsageError(`--${name} 需要一个非空值`);
        flags[name] = inline;
        continue;
      }

      const next = argv[index + 1];
      if (next === undefined || (next.startsWith('-') && next !== '-')) {
        throw new UsageError(`--${name} 需要一个值`);
      }

      flags[name] = next;
      index += 1;
      continue;
    }

    throw new UsageError(`未知参数 --${name}`);
  }

  return { flags, positionals };
}

/** 有位置参数就说明用户敲了不认识的东西，统一报错（不静默忽略）。 */
export function rejectPositionals(positionals, command) {
  if (positionals.length === 0) return;
  throw new UsageError(`\`${command}\` 不接受位置参数，收到：${positionals.join(' ')}（选项见 --help）`);
}
