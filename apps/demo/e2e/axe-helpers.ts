import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { Result } from 'axe-core';

/**
 * axe-core 的共用封装：一次扫描 = 打印全量违规 + 挂 JSON 附件 + 断言。
 *
 * 合并门禁只卡 **critical + serious**；moderate / minor 会全部打印出来并留在
 * 附件里，方便后续按需收敛。`target` 里的 `>>>` 表示进入一层 shadow root。
 */

/** 这两个 impact 会阻断合并。 */
export const BLOCKING_IMPACT = new Set(['critical', 'serious']);

export const isBlocking = (violation: Result): boolean =>
  typeof violation.impact === 'string' && BLOCKING_IMPACT.has(violation.impact);

/** 人类可读的违规清单。 */
export function describeViolations(violations: Result[]): string {
  return violations
    .map((violation) => {
      const targets = violation.nodes
        .slice(0, 5)
        .map((node) => `      ${node.target.join(' >>> ')}`)
        .join('\n');
      return `  • [${violation.impact ?? 'unknown'}] ${violation.id} — ${violation.help}\n${targets}`;
    })
    .join('\n');
}

/**
 * 扫描 `selector`（默认整个文档）并断言无 critical/serious 违规。
 *
 * `label` 用于附件名与日志，调用方应带上页面名保证唯一。
 */
export async function scanAxe(
  page: Page,
  label: string,
  selector?: string,
): Promise<void> {
  const builder = new AxeBuilder({ page });
  if (selector) builder.include(selector);
  const { violations } = await builder.analyze();

  const blocking = violations.filter(isBlocking);
  const allowed = violations.filter((violation) => !isBlocking(violation));

  console.log(
    `[axe] ${label}: ${violations.length} violation(s), ${blocking.length} blocking` +
      (allowed.length > 0
        ? `, ${allowed.length} allowed: ${allowed
            .map((violation) => `${violation.id}(${violation.impact})`)
            .join(', ')}`
        : ''),
  );
  if (violations.length > 0) console.log(describeViolations(violations));

  await test.info().attach(`axe-${label}.json`, {
    body: JSON.stringify({ label, selector: selector ?? 'document', violations }, null, 2),
    contentType: 'application/json',
  });

  expect(
    blocking.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.length,
    })),
    `axe ${label} 不允许 critical/serious 违规:\n${describeViolations(blocking)}`,
  ).toEqual([]);
}
