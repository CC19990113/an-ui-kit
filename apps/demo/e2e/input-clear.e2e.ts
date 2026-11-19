import { expect, test, type Locator } from '@playwright/test';

import type { AnInput } from '@an-ui-kit/elements';

import { FRAMEWORKS, openDemo } from './family-helpers';

const CLEAR = '[part~="clear"]';

function enableClear(control: Locator): Promise<void> {
  return control.evaluate((element) => element.setAttribute('clearable', ''));
}

function nameEntries(form: Locator): Promise<FormDataEntryValue[]> {
  return form.evaluate((element) => new FormData(element as HTMLFormElement).getAll('name'));
}

test('原生：点击清空依次派发 an-input、an-change、an-input-clear', async ({ page }) => {
  await openDemo(page, '/native.html');
  const form = page.getByTestId('input-form');
  const control = form.getByTestId('inp-name');
  const input = control.locator('input');
  await expect(input).toHaveValue('初始值');
  expect(await nameEntries(form)).toEqual(['初始值']);
  await enableClear(control);

  const events = await control.evaluateHandle((element) => {
    const form = element.closest('form');
    if (!form) throw new Error('未找到输入框所属表单');
    const records: Array<{
      type: string;
      value: string;
      entries: FormDataEntryValue[];
      bubbles: boolean;
      composed: boolean;
    }> = [];

    for (const type of ['an-input', 'an-change', 'an-input-clear']) {
      form.addEventListener(type, (event) => {
        if (event.target !== element) return;
        const { value } = (event as CustomEvent<{ value: string }>).detail;
        records.push({
          type,
          value,
          entries: new FormData(form).getAll('name'),
          bubbles: event.bubbles,
          composed: event.composed,
        });
      });
    }
    return records;
  });

  await control.locator(CLEAR).click();

  expect(await events.jsonValue()).toEqual(
    ['an-input', 'an-change', 'an-input-clear'].map((type) => ({
      type,
      value: '',
      entries: [''],
      bubbles: true,
      composed: true,
    })),
  );
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  await expect(control.locator(CLEAR)).toHaveCount(0);
  expect(await nameEntries(form)).toEqual(['']);
});

for (const framework of FRAMEWORKS.filter(({ name }) => name !== 'native')) {
  test(`${framework.name}：组件清空同步更新框架回显和表单提交值`, async ({ page }) => {
    await openDemo(page, framework.path);
    const form = page.getByTestId('input-form');
    const control = form.getByTestId('inp-name');
    const input = control.locator('input');
    const echo = page.getByTestId('input-echo');
    await enableClear(control);

    await input.fill('Ada');
    await expect(echo).toHaveText('Ada');
    expect(await nameEntries(form)).toEqual(['Ada']);

    await control.locator(CLEAR).click();

    // React 的 onan-input 与 Vue 的 @an-input 都用 detail.value 更新框架状态。
    await expect(echo).toHaveText('');
    await expect(input).toHaveValue('');
    expect(await nameEntries(form)).toEqual(['']);

    await form.getByTestId('btn-submit').click();
    await expect(form.getByTestId('input-form-result')).toContainText('name= · email=a@b.com');
    await expect(input).toHaveValue('');
  });
}

test('原生 an-field：清空消除当前错误，下次提交仍触发必填校验', async ({ page }) => {
  await openDemo(page, '/native.html');
  const form = page.getByTestId('form-root');
  const field = form.getByTestId('field-name');
  const control = field.getByTestId('form-name');
  const error = field.locator('[part~="error"]');
  const submit = form.getByTestId('form-submit');
  await enableClear(control);

  await submit.click();
  await expect(error).toBeVisible();
  await expect(control).toHaveAttribute('aria-invalid', 'true');

  // 通过 property 恢复内容，此时组件尚未派发用户输入事件，错误仍在。
  await control.evaluate((element) => {
    (element as AnInput).value = 'Ada';
  });
  await expect(control.locator('input')).toHaveValue('Ada');
  await expect(error).toBeVisible();
  await control.locator(CLEAR).click();

  expect(await nameEntries(form)).toEqual(['']);
  await expect(error).toBeHidden();
  await expect(control).not.toHaveAttribute('aria-invalid', 'true');

  await submit.click();
  await expect(error).toBeVisible();
  await expect(control).toHaveAttribute('aria-invalid', 'true');
});
