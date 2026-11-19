import { expect, test } from '@playwright/test';

const multiline = Array.from({ length: 12 }, (_, index) => `line ${index + 1}`).join('\n');

for (const boxSizing of ['border-box', 'content-box'] as const) {
  test(`textarea auto-size grows, shrinks and remains stable (${boxSizing})`, async ({ page }) => {
    await page.goto('/native.html');
    await page.evaluate(async (sizing) => {
      await customElements.whenDefined('an-textarea');
      const element = document.createElement('an-textarea');
      element.setAttribute('aria-label', 'Autosize regression fixture');
      element.setAttribute('auto-size', '');
      element.setAttribute('rows', '2');
      element.setAttribute('data-testid', 'autosize-regression');
      element.style.cssText = 'display:block;width:320px;--an-textarea-min-height:60px';
      document.body.append(element);

      const textarea = element.shadowRoot!.querySelector('textarea')!;
      textarea.style.cssText = `box-sizing:${sizing};line-height:20px;padding:6px 10px 10px;border-width:2px 1px 3px`;
    }, boxSizing);

    const host = page.getByTestId('autosize-regression');
    const textarea = host.locator('textarea');
    const boxHeight = () => textarea.evaluate((element) => element.getBoundingClientRect().height);
    await textarea.fill('a');
    const short = await boxHeight();
    // The temporary minimum used during measurement must not erase the CSS hook.
    expect(short).toBe(boxSizing === 'border-box' ? 60 : 81);

    await textarea.fill(multiline);
    const tall = await boxHeight();
    expect(tall).toBeCloseTo(261, 0);
    expect(tall).toBeGreaterThan(short);

    await textarea.fill('a');
    expect(await boxHeight()).toBeCloseTo(short, 1);

    const selection = await textarea.evaluate((element: HTMLTextAreaElement) => {
      element.setSelectionRange(0, 1, 'backward');
      element.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
      return [
        element.selectionStart, element.selectionEnd, element.selectionDirection,
        (element.getRootNode() as ShadowRoot).activeElement === element,
      ];
    });
    expect(await boxHeight()).toBeCloseTo(short, 1);
    expect(selection).toEqual([0, 1, 'backward', true]);

    await host.evaluate((element) => element.removeAttribute('auto-size'));
    expect(await textarea.evaluate((element) => [element.style.height, element.style.overflowY])).toEqual(['', '']);
  });
}

test('textarea auto-size respects row bounds and preserves scrolling at the ceiling', async ({ page }) => {
  await page.goto('/native.html');
  await page.evaluate(async () => {
    await customElements.whenDefined('an-textarea');
    const element = document.createElement('an-textarea');
    element.setAttribute('aria-label', 'Bounded autosize fixture');
    element.setAttribute('auto-size', '');
    element.setAttribute('min-rows', '2');
    element.setAttribute('max-rows', '4');
    element.setAttribute('data-testid', 'autosize-bounded');
    element.style.cssText = [
      'display:block;width:320px',
      '--an-textarea-min-height:0px',
      '--an-textarea-font-size:16px',
      '--an-textarea-padding:8px',
    ].join(';');
    document.body.append(element);
  });

  const textarea = page.getByTestId('autosize-bounded').locator('textarea');
  await textarea.fill('a');
  expect(await textarea.evaluate((element) => element.getBoundingClientRect().height)).toBeCloseTo(66, 0);
  await textarea.fill(multiline);
  expect(await textarea.evaluate((element) => element.getBoundingClientRect().height)).toBeCloseTo(114, 0);
  expect(await textarea.evaluate((element) => getComputedStyle(element).overflowY)).toBe('auto');

  const [before, after] = await textarea.evaluate((element) => {
    element.scrollTop = 48;
    const before = element.scrollTop;
    element.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    return [before, element.scrollTop];
  });
  expect(before).toBeGreaterThan(0);
  expect(after).toBe(before);

  await textarea.fill('a');
  expect(await textarea.evaluate((element) => element.getBoundingClientRect().height)).toBeCloseTo(66, 0);
  expect(await textarea.evaluate((element) => element.style.overflowY)).toBe('');
});
