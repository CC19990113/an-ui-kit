import { expect, test } from '@playwright/test';

/** React writes the inherited boolean property; HTML keeps enumerated attributes. */
test.describe('an-input · spellcheck framework boundary', () => {
  test('React 19 forwards spellcheck={false} as a false boolean', async ({ page }) => {
    await page.goto('/react.html');
    const input = page.locator('an-input[data-testid="form-name"]');
    await expect(input.locator('input')).toBeVisible();

    await expect(input).toHaveJSProperty('spellcheck', false);
    await expect(input.locator('input')).toHaveJSProperty('spellcheck', false);
    await expect(input.locator('input')).toHaveAttribute('spellcheck', 'false');
  });

  test('native HTML spellcheck="false" keeps the enumerated false value', async ({ page }) => {
    await page.goto('/native.html');
    await page.waitForFunction(() => customElements.get('an-input') !== undefined);

    // The HTML parser must retain "false" as a value, not a presence-only flag.
    await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        'beforeend',
        '<an-input data-testid="static-spellcheck" label="拼写检查" spellcheck="false"></an-input>',
      );
    });
    const input = page.locator('an-input[data-testid="static-spellcheck"]');
    await expect(input.locator('input')).toBeVisible();

    await expect(input).toHaveAttribute('spellcheck', 'false');
    await expect(input).toHaveJSProperty('spellcheck', false);
    await expect(input.locator('input')).toHaveAttribute('spellcheck', 'false');
    await expect(input.locator('input')).toHaveJSProperty('spellcheck', false);
  });
});
