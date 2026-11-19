/**
 * `an-ui-kit.config.json` 的读写。文件结构刻意与仓库根的同名配置一致：
 * `{ "$schema": ..., "components": "all" | ["an-button", ...] }`，这样仓库自己
 * 的 `scripts/build-elements.mjs` 与外部 CLI 看到的是同一种配置。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { CliError } from './errors.js';

/** cwd 下默认的配置文件名。 */
export const CONFIG_FILENAME = 'an-ui-kit.config.json';

/**
 * `init` 写进配置的 `$schema`。它只服务于编辑器补全（VS Code / JetBrains 会
 * 拉取远程 JSON Schema），CLI 运行时不读它，删掉也不影响使用。
 */
export const CONFIG_SCHEMA_URL =
  'https://raw.githubusercontent.com/CC19990113/an-ui-kit/main/schema/an-ui-kit.config.schema.json';

/** `init` 的默认内容：打包全部组件，`$schema` 指向远程 schema 便于补全。 */
export function defaultConfig() {
  return { $schema: CONFIG_SCHEMA_URL, components: 'all' };
}

/** 与仓库格式化保持一致：2 空格缩进 + 结尾换行。 */
export function serializeConfig(config) {
  return `${JSON.stringify(config, null, 2)}\n`;
}

/** @param {string} configPath 已 resolve 的绝对路径（或 cwd 相对路径） */
export function configPathFrom(cwd, value) {
  return resolve(cwd, value ?? CONFIG_FILENAME);
}

/**
 * 读配置。文件不存在**不是**错误：等价于 `"all"`（任务约定）。
 *
 * @param {string} configPath
 * @returns {{ existed: boolean, components: 'all' | string[] }}
 */
export function readConfig(configPath) {
  if (!existsSync(configPath)) {
    return { existed: false, components: 'all' };
  }

  let raw;
  try {
    raw = readFileSync(configPath, 'utf8');
  } catch (cause) {
    throw new CliError(`读不到配置文件 ${configPath}：${describe(cause)}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new CliError(`配置文件 ${configPath} 不是合法 JSON：${describe(cause)}`);
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new CliError(`配置文件 ${configPath} 必须是 JSON 对象，例如 {"components": "all"}`);
  }

  // schema 是 additionalProperties: false，这里同款严格：拼错的字段名（component）
  // 不该静默退化成「全量」，否则产物会莫名其妙变大。
  const unknownKeys = Object.keys(parsed).filter((key) => key !== '$schema' && key !== 'components');
  if (unknownKeys.length > 0) {
    throw new CliError(
      `配置文件 ${configPath} 有未支持的字段：${unknownKeys.join(', ')}（只支持 $schema 与 components）`,
    );
  }

  return { existed: true, components: normalizeComponents(parsed.components, configPath) };
}

/** @returns {'all' | string[]} */
function normalizeComponents(value, configPath) {
  if (value === undefined || value === 'all') return 'all';

  if (!Array.isArray(value) || value.length === 0) {
    throw new CliError(
      `配置文件 ${configPath} 的 "components" 只能是字符串 "all" 或非空组件名数组，收到 ${JSON.stringify(value)}`,
    );
  }

  const invalid = value.filter((item) => typeof item !== 'string' || item.trim() === '');
  if (invalid.length > 0) {
    throw new CliError(
      `配置文件 ${configPath} 的 "components" 里有非字符串项：${JSON.stringify(invalid)}`,
    );
  }

  return value.map((item) => item.trim());
}

/** 写 `init` 产物（父目录不存在时递归创建）。 */
export function writeConfig(configPath) {
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, serializeConfig(defaultConfig()), 'utf8');
}

function describe(error) {
  return error instanceof Error ? error.message : String(error);
}
