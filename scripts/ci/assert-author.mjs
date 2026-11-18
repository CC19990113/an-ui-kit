#!/usr/bin/env node
/**
 * CI 硬红线：提交历史里的 git author 邮箱不能是公司域名。
 *
 * 公开仓库的提交记录是永久的，所以这条在 CI 里卡住：只要有一个 author 邮箱
 * 以 `@shenshiads.com` 结尾就失败。本地新建仓库还没有提交时给警告并跳过，
 * CI 环境一定至少有一个提交。
 */
import { execFileSync } from 'node:child_process';

const FORBIDDEN_SUFFIX = '@shenshiads.com';

let output;
try {
  output = execFileSync('git', ['log', '--format=%ae'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (error) {
  const detail = String(error.stderr ?? error.message).trim();
  console.warn(`[ci:author] 跳过：读不到 git 历史（${detail || 'no commits'}）`);
  process.exit(0);
}

const emails = [...new Set(output.split('\n').map((line) => line.trim()).filter(Boolean))];
if (emails.length === 0) {
  console.warn('[ci:author] 跳过：git 历史为空');
  process.exit(0);
}

const offenders = emails.filter((email) => email.toLowerCase().endsWith(FORBIDDEN_SUFFIX));

if (offenders.length > 0) {
  console.error(
    `[ci:author] FAIL 以下 git author 使用了被禁止的邮箱域名 ${FORBIDDEN_SUFFIX}：\n` +
      offenders.map((email) => `  - ${email}`).join('\n') +
      '\n请用 `git rebase --root --exec ...` 或重写历史后重试；author 记录一旦公开就无法收回。',
  );
  process.exit(1);
}

console.log(`[ci:author] OK ${emails.length} 个 author 邮箱均不含 ${FORBIDDEN_SUFFIX}：${emails.join(', ')}`);
