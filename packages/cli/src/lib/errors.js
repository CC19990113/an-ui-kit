/**
 * CLI 的两种错误，决定 `[an-ui-kit]` 前缀打印什么、要不要附用法：
 *
 * - `UsageError`：用户敲错了命令/参数，打印用法后退出码 1。
 * - `CliError`：环境或输入问题（elements 未安装、组件名未知、配置坏掉……），
 *   只打印一句中文说明，**不打印堆栈** —— 使用者要的是下一步怎么做。
 */
export class CliError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CliError';
  }
}

export class UsageError extends CliError {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}
