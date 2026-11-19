import { expect, test, type Page } from '@playwright/test';

import { scanAxe } from './axe-helpers';
import { FRAMEWORKS, T, TAILWIND } from './family-helpers';

/**
 * demo 深色模式验证：四个页面（native / react / vue / tailwind）共用一个
 * `[data-testid="theme-toggle"]` 开关，切换只改文档根上的 `data-theme`。
 *
 * 断言两件事：
 * 1. 切到 dark 后，页面与关键控件的 background / color 真的变了；
 * 2. dark 下 axe 扫描仍无 critical / serious 违规。
 */

const PAGES = [...FRAMEWORKS, TAILWIND] as const;

const THEME_TOGGLE = T('theme-toggle');

interface StylePair {
  background: string;
  color: string;
}

interface ThemeSnapshot {
  theme: string | undefined;
  body: StylePair;
  button: StylePair;
  input: StylePair;
}

/** 读宿主元素（穿透 open shadow root）里某个节点的 computed background/color。 */
async function readSnapshot(page: Page): Promise<ThemeSnapshot> {
  return page.evaluate(() => {
    const pair = (element: Element): { background: string; color: string } => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, color: style.color };
    };

    const inner = (hostSelector: string, innerSelector: string): { background: string; color: string } => {
      const host = document.querySelector(hostSelector);
      if (!host) throw new Error(`未找到 ${hostSelector}`);
      const target = ((host as HTMLElement).shadowRoot?.querySelector(innerSelector) ??
        host) as Element;
      return pair(target);
    };

    const body = getComputedStyle(document.body);

    return {
      theme: document.documentElement.dataset.theme,
      body: { background: body.backgroundColor, color: body.color },
      // 关键控件：an-button 内部 .base / an-input 的 control wrapper
      // 用 default 变体：primary 的 accent 色在明暗两套主题里是同一个值。
      // input 本身背景透明；背景和前景由 .control class wrapper 承担。
      button: inner('[data-testid="btn-default"]', '.base'),
      input: inner('[data-testid="inp-name"]', '.control'),
    };
  });
}

for (const pageDef of PAGES) {
  test.describe(`深色模式 · ${pageDef.name}`, () => {
    test('切到 dark：关键控件（含 input wrapper）背景/前景变化，axe 仍无 critical·serious', async ({ page }) => {
      test.setTimeout(120_000);
      await page.goto(pageDef.path);
      await page.waitForFunction(
        () => customElements.get('an-button') !== undefined && Boolean(window.__familyState),
      );
      await expect(page.locator(THEME_TOGGLE)).toBeVisible();

      const light = await readSnapshot(page);
      expect(light.theme).toBe('light');

      // 切 dark：先断言属性，再读计算样式。
      await page.locator(THEME_TOGGLE).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expect(page.locator(THEME_TOGGLE)).toHaveAttribute('aria-pressed', 'true');

      const dark = await readSnapshot(page);
      expect(dark.theme).toBe('dark');

      // 「变化」按整对样式断言：背景和前景都必须真的变。
      expect(dark.body, 'body background 应随主题变化').not.toEqual(light.body);
      expect(dark.body.background).not.toBe(light.body.background);
      expect(dark.body.color).not.toBe(light.body.color);

      expect(dark.button, 'an-button 内部 .base 的 background/color 应随主题变化').not.toEqual(
        light.button,
      );
      expect(dark.button.background).not.toBe(light.button.background);
      expect(dark.button.color).not.toBe(light.button.color);

      expect(dark.input, 'an-input control wrapper 的 background/color 应随主题变化').not.toEqual(
        light.input,
      );
      expect(dark.input.background).not.toBe(light.input.background);
      expect(dark.input.color).not.toBe(light.input.color);

      // dark 下的 a11y：表单族区块不允许 critical/serious。
      await scanAxe(page, `${pageDef.name}-dark-form`, T('family-form'));

      // 再切回 light：开关是双向的，样式回到初始值。
      await page.locator(THEME_TOGGLE).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await expect(page.locator(THEME_TOGGLE)).toHaveAttribute('aria-pressed', 'false');
      const back = await readSnapshot(page);
      expect(back.body).toEqual(light.body);
      expect(back.button).toEqual(light.button);
      expect(back.input).toEqual(light.input);
    });
  });
}
