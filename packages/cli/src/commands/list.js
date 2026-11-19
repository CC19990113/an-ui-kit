/**
 * `an-ui-kit list` —— 列出当前安装的 `@an-ui-kit/elements` 里可裁剪的组件标签，
 * 并打印包版本与解析到的绝对路径（多版本共存时最有用的一条信息）。
 */
import { parseFlags, rejectPositionals } from '../lib/args.js';
import { resolveElements } from '../lib/elements.js';

const HELP = `用法：an-ui-kit list

列出已安装的 @an-ui-kit/elements 里可用的组件标签，以及包版本与包路径。
`;

export function runList(argv) {
  const { flags, positionals } = parseFlags(argv, { booleans: ['help'] });

  if (flags.help) {
    console.log(HELP);
    return 0;
  }

  rejectPositionals(positionals, 'list');

  const { version, packageRoot, srcDir, components } = resolveElements();

  console.log(`[an-ui-kit] @an-ui-kit/elements@${version}`);
  console.log(`[an-ui-kit] 包路径：${packageRoot}`);
  console.log(`[an-ui-kit] 源码：${srcDir}`);
  console.log(`[an-ui-kit] 组件（${components.length}）：${components.map((component) => component.tag).join(', ')}`);

  return 0;
}
