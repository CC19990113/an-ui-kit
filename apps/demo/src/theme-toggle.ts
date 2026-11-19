/**
 * Demo 页统一的明暗主题开关。
 *
 * 组件 CSS 只读 `--an-color-*` 变量，主题入口在 tokens：文档根上的
 * `data-theme="dark"` 会把整套语义色换成 dark 取值（`tokens.css` 由
 * `packages/tokens/scripts/build.mjs` 生成），组件源码一行都不用改。
 *
 * 四个页面（native / react / vue / tailwind）共用这一个模块：
 * 按钮固定挂在 `<body>` 末尾，带 `data-testid="theme-toggle"` 供 e2e 定位。
 */

export type DemoTheme = 'light' | 'dark';

/** e2e 与页面共用的 testid。 */
export const THEME_TOGGLE_TESTID = 'theme-toggle';

const BUTTON_TEXT: Record<DemoTheme, string> = {
  light: '🌙 深色',
  dark: '☀️ 浅色',
};

const BUTTON_LABEL: Record<DemoTheme, string> = {
  light: '切换到深色模式',
  dark: '切换到浅色模式',
};

/** 把开关的可见文案 / ARIA 状态同步到当前主题。 */
function syncToggle(button: HTMLButtonElement, theme: DemoTheme): void {
  button.textContent = BUTTON_TEXT[theme];
  button.setAttribute('aria-label', BUTTON_LABEL[theme]);
  button.setAttribute('aria-pressed', String(theme === 'dark'));
}

/** 切换并同步根元素上的 `data-theme`，返回生效后的主题。 */
export function applyTheme(theme: DemoTheme): DemoTheme {
  document.documentElement.dataset.theme = theme;
  const button = document.querySelector<HTMLButtonElement>(
    `[data-testid="${THEME_TOGGLE_TESTID}"]`,
  );
  if (button) syncToggle(button, theme);
  return theme;
}

/** 当前主题；页面没调用过 `installThemeToggle` 时按浅色算。 */
export function currentTheme(): DemoTheme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/**
 * 安装开关并显式落到浅色。
 *
 * 显式写成 `light` 而不是删掉属性，是为了让 e2e 不受宿主机
 * `prefers-color-scheme: dark` 影响：tokens 的 `[data-theme="light"]`
 * 优先级高于 `prefers-color-scheme` 媒体查询。
 */
export function installThemeToggle(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'theme-toggle';
  button.setAttribute('data-testid', THEME_TOGGLE_TESTID);

  button.addEventListener('click', () => {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  });

  document.body.append(button);
  applyTheme('light');
  return button;
}
