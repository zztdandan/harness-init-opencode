# dedge-harness-init-guide

面向 **OpenCode** 的 harness 初始化与会话环境准备插件集合。项目当前提供两个插件：

- `harness_init.js`：注入 `harness-init` 主 agent 与内置 skills。
- `harness_shell_env_prepare_plugin.js`：在会话内准备 shell 前置环境（`session_env.json` + `shell_source.sh`）。

## Two Plugins

### 1) harness-init-plugin（`dist/harness_init.js`）
功能：
- 提供一个即插即用的 harness 工作目录管理全套功能，包括一个 agent 和3个技能。提供一套完整可扩展的的 harness 维护框架


职责：

- 通过 config hook 注入 `agent.harness-init`
- 注入内置 skills 路径（`dist/builtin/skills`）
- 默认注入 skill 权限：`harness-agent-env`、`harness-git-worktree`、`harness-docs`
- 默认不抢占用户会话，不会把 `harness-init` 设为全局默认 agent
- 本插件的设计哲学是，在插件进行过初始化后仅留下AGNETS.md，内含完善的

### 2) harness_shell_env_prepare_plugin（`dist/harness_shell_env_prepare_plugin.js`）

职责：

- 在会话内一次性读取 `scripts/session_env.json`（要求 `schema = "harness-shell-env/v1"`）并缓存为 env
- 通过 `shell.env` hook 将缓存 env 注入 shell 执行环境
- 若存在 `scripts/shell_source.sh`，注入 `BASH_ENV`，让 bash 在非交互执行时自动加载该脚本
- 为 zsh 生成补救 shim：`scripts/.harness-zdotdir/.zshenv`，并注入 `ZDOTDIR` 指向该目录

关键语义：

- `session_env.json` 是会话级缓存快照（同会话内文件变更不会自动刷新）
- `shell_source.sh` 存在才会注入 `BASH_ENV` / `ZDOTDIR`；不存在时仅注入 `session_env.json` 中的 env
- `shell_source.sh` 在 bash 非交互启动阶段自动加载；脚本返回非 0 也不会阻断命令执行
- zsh 通过 shim 中的 `|| true` 保证 source 失败不阻断后续命令

## Quick Start

### 1) 安装依赖

```bash
bun install
```

### 2) 构建 dist

```bash
bun run build
```

### 3) 在 OpenCode 配置两个插件

`opencode.json` 示例：

```json
{
  "plugin": [
    "file:///ABSOLUTE/PATH/TO/dedge-harness-init-guide/dist/harness_init.js",
    "file:///ABSOLUTE/PATH/TO/dedge-harness-init-guide/dist/harness_shell_env_prepare_plugin.js"
  ]
}
```

## Long-Term Mode

初始化完成后，建议进入长期模式：

- 保留 `harness_shell_env_prepare_plugin.js` 持续提供会话环境前置
- 将 `harness_init.js` 注释掉（仅在需要重新初始化/重构工作区结构时再启用）

示例：

```json
{
  "plugin": [
    "file:///ABSOLUTE/PATH/TO/dedge-harness-init-guide/dist/harness_shell_env_prepare_plugin.js"
    // "file:///ABSOLUTE/PATH/TO/dedge-harness-init-guide/dist/harness_init.js"
  ]
}
```

## Plugin Constraints

以下限制来自当前 agent/skill 与插件实现事实：

- `harness-init-plugin` 只负责注入 agent/skills，不注入自定义 tool。
- `harness_shell_env_prepare_plugin` 不再改写工具命令，统一通过 `shell.env` 注入环境变量。
- `session_env.json` 必须是对象结构，且满足 schema：`harness-shell-env/v1`；非法键会被过滤。
- 环境变量键名仅接受：`[A-Za-z_][A-Za-z0-9_]*`。
- zsh 兼容依赖插件在 `scripts/.harness-zdotdir/.zshenv` 成功落盘；若写入失败，将只保留 `BASH_ENV` 注入。
- `harness-agent-env` / `harness-docs` 的技能文档当前仍描述 `scripts/shell_env.json`，与新插件使用的 `scripts/session_env.json` 存在命名差异；实际运行请以插件实现为准。
- `harness-init` 设计中包含 Gate A/Gate B 门禁与文档/拓扑治理流程，不适合在未确认主管理项目目录时强行执行。

## Version 0.1.1

当前版本：`0.1.1`

已具备能力：

- 双插件分离交付：初始化治理与会话环境前置解耦
- dist 双入口构建：`harness_init.js` + `harness_shell_env_prepare_plugin.js`
- 会话级 env 缓存 + `BASH_ENV` 自动加载 `shell_source.sh`
- zsh shim（`ZDOTDIR + .zshenv`）补救机制
- shell 前置失败降级（不中断命令）
- 单元与 e2e 覆盖核心加载与行为语义

## Roadmap

- `0.1.0`（已实现）
  - 交付双插件架构
  - 打通 OpenCode dist 挂载与核心测试

- `0.1.1`（已实现）
  - 移除 `tool.execute.before` 命令改写，改为 `shell.env` 统一注入
  - 新增 `BASH_ENV` 自动加载 `scripts/shell_source.sh`
  - 新增 zsh 补救注入（`ZDOTDIR` + `.zshenv` shim）

- `0.2.0`（计划）
  - 增强环境资产 schema 校验与错误可观测性
  - 提供更细粒度的前置策略（按目录/命令模式）
  - 输出更完整的运行诊断信息（便于排障）

- 未来计划
  - 与 `harness-agent-env` / `harness-docs` 做规范统一与自动迁移
  - 探索可选的会话缓存刷新机制（在不破坏稳定性的前提下）
  - 持续补齐发布节奏下的版本化文档与升级指南

## Development Commands

- `bun test`：运行测试
- `bun run typecheck`：TypeScript 类型检查
- `bun run build`：构建两个 OpenCode 插件并打包内置资源

### Run OpenCode dist E2E

必需环境变量：

- `OPENCODE_CLI`：固定版本的 opencode 可执行路径（建议在 CI 显式配置）

可选环境变量：

- `E2E_ALLOW_CLI_FALLBACK=1`：允许在未设置 `OPENCODE_CLI` 时回退到 `opencode`
- `E2E_KEEP_WORKSPACE=1`：失败或成功后保留 `tests/opencode/e2e/workspaces/<case-id>` 现场

示例：

```bash
OPENCODE_CLI=/ABSOLUTE/PATH/TO/opencode bun test tests/opencode/e2e/opencode-dist-load.test.ts --timeout 180000
```
