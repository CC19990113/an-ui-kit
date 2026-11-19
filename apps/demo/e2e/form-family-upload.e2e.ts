import { expect, test } from '@playwright/test';

import {
  familyEvents,
  familyState,
  fileInput,
  host,
  openDemo,
  oversizedPng,
  pngFile,
  submitFamily,
  textFile,
  waitForEvent,
} from './family-helpers';

/**
 * `<an-upload>` 在表单族 demo 上的真实浏览器行为：
 * 文件选择、accept / max-size / max-files 拒绝、移除、FormData 里的 File。
 * demo 用 `auto-upload="false"`，文件只排队不上传，所以状态稳定可断言。
 */
test.describe('an-upload · 表单族 demo', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page);
  });

  test('setInputFiles 选图片：队列出现一项并派发 an-upload-change', async ({ page }) => {
    const upload = host(page, 'family-upload');
    await expect(upload.locator('[part="empty"]')).toBeVisible();

    await fileInput(upload).setInputFiles(pngFile());

    await expect(upload.locator('[part="item"]')).toHaveCount(1);
    await expect(upload.locator('[part="item-name"]')).toHaveText('pixel.png');
    await expect(upload.locator('[part="empty"]')).toHaveCount(0);

    const change = await waitForEvent(page, 'an-upload-change', 'family-upload');
    expect(change.added).toEqual(['pixel.png']);
    expect(change.removed).toEqual([]);
  });

  test('超过 max-size：reject reason=size，队列不增加', async ({ page }) => {
    const upload = host(page, 'family-upload');
    await fileInput(upload).setInputFiles(oversizedPng());

    const reject = await waitForEvent(page, 'an-upload-reject', 'family-upload');
    expect(reject.file).toBe('huge.png');
    expect(reject.reason).toBe('size');
    await expect(upload.locator('[part="item"]')).toHaveCount(0);
    expect(await familyEvents(page, 'an-upload-change')).toEqual([]);
  });

  test('类型不在 accept：reject reason=type', async ({ page }) => {
    const upload = host(page, 'family-upload');
    await fileInput(upload).setInputFiles(textFile());

    const reject = await waitForEvent(page, 'an-upload-reject', 'family-upload');
    expect(reject.reason).toBe('type');
    await expect(upload.locator('[part="item"]')).toHaveCount(0);
  });

  test('max-files=2：第三个文件被拒，前两个保留', async ({ page }) => {
    const upload = host(page, 'family-upload');
    await fileInput(upload).setInputFiles([pngFile('one.png'), pngFile('two.png')]);
    await expect(upload.locator('[part="item"]')).toHaveCount(2);

    await fileInput(upload).setInputFiles(pngFile('third.png'));

    const reject = await waitForEvent(page, 'an-upload-reject', 'family-upload');
    expect(reject.file).toBe('third.png');
    expect(reject.reason).toBe('max-files');
    await expect(upload.locator('[part="item"]')).toHaveCount(2);
  });

  test('移除按钮清空队列并派发 removed', async ({ page }) => {
    const upload = host(page, 'family-upload');
    await fileInput(upload).setInputFiles(pngFile());
    await expect(upload.locator('[part="item"]')).toHaveCount(1);

    await upload.locator('[part="item-remove"]').click();

    await expect(upload.locator('[part="item"]')).toHaveCount(0);
    await expect(upload.locator('[part="empty"]')).toBeVisible();
    const changes = await familyEvents(page, 'an-upload-change', 'family-upload');
    const last = changes[changes.length - 1];
    expect(last?.removed).toEqual(['pixel.png']);
  });

  test('FormData：选中的文件作为 File 提交', async ({ page }) => {
    const upload = host(page, 'family-upload');
    await fileInput(upload).setInputFiles(pngFile());

    await submitFamily(page);

    const state = await familyState(page);
    expect(state.submit).toBe(1);
    const entry = state.entries.find((item) => item.name === 'attachment');
    expect(entry, '提交条目里应有 attachment').toBeDefined();
    expect(entry?.file).toEqual({
      name: 'pixel.png',
      size: pngFile().buffer.byteLength,
      type: 'image/png',
    });
  });
});
