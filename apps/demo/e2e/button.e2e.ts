import { expect, test, type Page } from '@playwright/test';

import {
  formatA11yReport,
  runA11yChecks,
  type A11yLocatorLike,
} from '../../../scripts/a11y/index';

/** 三个框架页：同一份组件产物，同一套断言。 */
const FRAMEWORKS = [
  { name: 'native', path: '/native.html' },
  { name: 'react', path: '/react.html' },
  { name: 'vue', path: '/vue.html' },
] as const;

/** 与四个页面的 fixture 对应（data-testid 是稳定契约）。 */
const BUTTON_IDS = [
  'btn-default',
  'btn-primary',
  'btn-danger',
  'btn-ghost',
  'btn-disabled',
  'btn-loading',
] as const;

/** 对比 preflight 用的计算样式属性（都是组件自己声明过的，不该被文档样式影响）。 */
const COMPARED_STYLE_PROPS = [
  'backgroundColor',
  'borderColor',
  'color',
  'height',
  'width',
  'padding',
  'margin',
  'boxSizing',
  'borderRadius',
  'fontSize',
  'fontFamily',
  'lineHeight',
  'display',
  'appearance',
] as const;

const host = (page: Page, testId: string) => page.locator(`[data-testid="${testId}"]`);

/** 读内部 `<button>` 的计算样式；必须真的进 shadow root，避免只测到 host。 */
async function stylesOf(page: Page, testId: string): Promise<Record<string, string>> {
  const value = await host(page, testId).evaluate((element, props) => {
    const inner = (element as HTMLElement).shadowRoot?.querySelector('button');
    if (!inner) throw new Error('<an-button> 里没有 <button>');
    const style = getComputedStyle(inner);
    // getPropertyValue 只认 kebab-case；camelCase 传进去会静默返回 ""，
    // 那样「两页都为 ""」会被判成相等 —— 典型的假绿，这里显式转一次。
    const kebab = (prop: string) => prop.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
    return Object.fromEntries(props.map((prop) => [prop, style.getPropertyValue(kebab(prop))]));
  }, COMPARED_STYLE_PROPS as unknown as string[]);
  return value as Record<string, string>;
}

async function openPage(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(host(page, 'btn-default')).toBeVisible();
  // 自定义元素已定义 + 事件记录器已就绪，后面才能数事件。
  await page.waitForFunction(() => Boolean(customElements.get('an-button')));
  await page.waitForFunction(() => Array.isArray(window.__anButtonClickLog));
}

/** 数 DOM 上真实发生的 an-button-click 次数。 */
const clickLog = (page: Page) => page.evaluate(() => window.__anButtonClickLog);

for (const framework of FRAMEWORKS) {
  test.describe(`${framework.name} 页`, () => {
    test.beforeEach(async ({ page }) => {
      await openPage(page, framework.path);
    });

    test('variant=primary 真的生效（读内部 button 的 computed style）', async ({ page }) => {
      const styles = await Promise.all(
        BUTTON_IDS.map(async (id) => [id, await stylesOf(page, id)] as const),
      );
      const byId = Object.fromEntries(styles);

      const defaults = byId['btn-default'];
      const primary = byId['btn-primary'];
      const danger = byId['btn-danger'];
      const ghost = byId['btn-ghost'];

      // 1. primary 与 default 背景不同 —— 只断言「不同」还不够，再排除 UA 默认灰。
      expect(primary.backgroundColor).not.toBe(defaults.backgroundColor);
      expect(primary.backgroundColor).not.toBe('rgb(239, 239, 239)'); // Chrome UA buttonface
      expect(primary.backgroundColor).not.toBe('buttonface');

      // 2. danger / ghost 也各自命中自己的规则（ghost = 透明）
      expect(danger.backgroundColor).not.toBe(defaults.backgroundColor);
      expect(ghost.backgroundColor).toBe('rgba(0, 0, 0, 0)');

      // 3. 高度来自组件 CSS（--an-button-height 默认 2.25rem = 36px），不是 UA 默认
      expect(primary.height).toBe('36px');
      expect(primary.boxSizing).toBe('border-box');
      expect(primary.appearance).toBe('none');

      console.log(
        `[${framework.name}] background-color — default=${defaults.backgroundColor} ` +
          `primary=${primary.backgroundColor} danger=${danger.backgroundColor} ` +
          `ghost=${ghost.backgroundColor} | primary.height=${primary.height}`,
      );
    });

    test('点击恰好派发 1 次 an-button-click（bubbles + composed + originalEvent）', async ({
      page,
    }) => {
      await host(page, 'btn-primary').click();

      await expect
        .poll(async () => (await clickLog(page)).length, { message: 'an-button-click 次数' })
        .toBe(1);

      const [record] = await clickLog(page);
      expect(record.id).toBe('btn-primary');
      expect(record.tag).toBe('an-button');
      expect(record.bubbles).toBe(true);
      expect(record.composed).toBe(true);
      expect(record.hasOriginalEvent).toBe(true);

      // 框架自己的监听器也收到，证明适配层真的接线了，而不只是 DOM 上冒泡。
      if (framework.name === 'react') {
        await expect
          .poll(() => page.evaluate(() => window.__reactHandlerCalls.length))
          .toBe(1);
      }
      if (framework.name === 'vue') {
        await expect.poll(() => page.evaluate(() => window.__vueHandlerCalls.length)).toBe(1);
      }
    });

    test('disabled 时点击不派发事件', async ({ page }) => {
      // force: 绕过 Playwright 的 actionability 检查，打的是真实坐标点击。
      await host(page, 'btn-disabled').click({ force: true });
      await page.waitForTimeout(150);

      expect(await clickLog(page)).toHaveLength(0);
      if (framework.name === 'react') {
        expect(await page.evaluate(() => window.__reactHandlerCalls.length)).toBe(0);
      }
      if (framework.name === 'vue') {
        expect(await page.evaluate(() => window.__vueHandlerCalls.length)).toBe(0);
      }
    });

    test('a11y：5 条断言在 primary / disabled / loading 上都成立', async ({ page }) => {
      const cases = [
        { id: 'btn-primary', expectation: {} },
        { id: 'btn-disabled', expectation: { disabled: true } },
        { id: 'btn-loading', expectation: { loading: true } },
      ] as const;

      for (const testCase of cases) {
        const report = await runA11yChecks(
          host(page, testCase.id) as unknown as A11yLocatorLike,
          testCase.expectation,
        );
        expect(report.ok, `[${framework.name}] ${testCase.id}\n${formatA11yReport(report)}`).toBe(
          true,
        );
        console.log(`[${framework.name}] a11y ${testCase.id} OK`);
      }
    });
  });
}

test.describe('Tailwind v4 preflight', () => {
  test('preflight 确实加载，但没有打穿 <an-button>', async ({ page }) => {
    await openPage(page, '/native.html');
    const nativeStyles: Record<string, Record<string, string>> = {};
    for (const id of BUTTON_IDS) nativeStyles[id] = await stylesOf(page, id);

    // 未启用 preflight 时，UA 给 body 8px margin。
    const nativeBodyMargin = await page.evaluate(() => getComputedStyle(document.body).margin);
    expect(nativeBodyMargin).toBe('8px');

    await openPage(page, '/tailwind.html');
    const tailwindStyles: Record<string, Record<string, string>> = {};
    for (const id of BUTTON_IDS) tailwindStyles[id] = await stylesOf(page, id);

    // preflight 生效的直接证据：body margin 被归零。
    const tailwindBodyMargin = await page.evaluate(() => getComputedStyle(document.body).margin);
    expect(tailwindBodyMargin).toBe('0px');

    // 组件内部计算样式逐按钮逐属性一致 —— Shadow DOM 是真正的隔离边界。
    for (const id of BUTTON_IDS) {
      expect(tailwindStyles[id], `${id} 在 preflight 下被改了样式`).toEqual(nativeStyles[id]);
    }

    // 关键三项再单独钉死（对比表之外的显式契约）。
    expect(tailwindStyles['btn-primary'].height).toBe('36px');
    expect(tailwindStyles['btn-primary'].boxSizing).toBe('border-box');
    expect(tailwindStyles['btn-primary'].margin).toBe('0px');

    console.log(
      '[tailwind] 六颗按钮 × 13 项计算样式与 native 页完全一致；' +
        `btn-primary: height=${tailwindStyles['btn-primary'].height} ` +
        `box-sizing=${tailwindStyles['btn-primary'].boxSizing} ` +
        `margin=${tailwindStyles['btn-primary'].margin} ` +
        `background=${tailwindStyles['btn-primary'].backgroundColor}`,
    );
  });

  test('preflight 页里点击事件照常派发', async ({ page }) => {
    await openPage(page, '/tailwind.html');
    await host(page, 'btn-primary').click();
    await expect.poll(async () => (await clickLog(page)).length).toBe(1);
  });
});
