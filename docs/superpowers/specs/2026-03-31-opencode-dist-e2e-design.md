# OpenCode Dist 插件 E2E 测试设计

## 背景与目标

当前 `tests/` 下的测试主要是单元级校验（文本内容与配置 merge 逻辑），无法证明 OpenCode 在真实运行时确实加载了本插件，并暴露了预期的 agent 与 skills。

本次目标：增加一组黑盒 E2E 测试，在 `tests/` 受控工作区内执行真实 `opencode` CLI；通过 `opencode.json` 挂载插件；最终以**名称 + 来源路径**双重条件验证运行时加载结果。

## 范围

本次包含：

- 基于编译产物（`dist/index.js`）挂载插件并验证 OpenCode 运行时行为
- 测试自动化准备（构建产物 + workspace + `opencode.json`）
- 对以下实体做断言：
  - agent：`harness-init`
  - skills：`harness-env-skill`、`harness-repo-skill`、`harness-agents-doc-skill`
  - 来源路径必须命中本仓库 `dist/builtin/...`
- 测试目录结构需为后续 Claude E2E 扩展预留空间

本次不包含：

- Claude 运行时 E2E 具体实现（仅预留目录和扩展位）
- 替换全部单测（单测仍保留为快速契约回归）

## 目录与边界设计

目标目录布局：

- `tests/opencode/unit/`：放置现有单元测试
- `tests/opencode/e2e/`：放置 OpenCode 黑盒测试
- `tests/opencode/e2e/workspaces/`：按 case 隔离的运行工作区
- `tests/claude/e2e/`：预留给后续 Claude 集成测试

边界规则：OpenCode E2E 命令必须在 `tests/opencode/e2e/workspaces/<case-id>` 作为 cwd 运行。

## 运行流程

每个 E2E case 固定执行以下步骤：

1. 执行 `bun run build` 生成插件编译产物。
2. 在 `tests/opencode/e2e/workspaces/<case-id>` 创建隔离 workspace。
3. 在该 workspace 下生成 `opencode.json`，其 `plugin` 字段指向 `file:///ABS_PATH_TO/dist/index.js`。
4. 在该 workspace 内执行 OpenCode 调试命令：
   - `<OPENCODE_CLI> debug config`
   - `<OPENCODE_CLI> debug skill`
   - `<OPENCODE_CLI> debug agent harness-init`
5. 解析 JSON 输出并执行“名称 + 来源路径”断言。

CLI 解析约定：

- 所有自动化运行都必须提供 `OPENCODE_CLI`（指向固定版本的可执行路径或包装脚本）。
- 若 `OPENCODE_CLI` 未设置，测试必须立刻失败并给出明确报错。
- 仅在 `E2E_ALLOW_CLI_FALLBACK=1` 时允许本地回退到 `opencode`，优先级为：`OPENCODE_CLI` > `opencode`。

## Workspace 配置约定

每个 E2E workspace 必须写入如下结构的 `opencode.json`：

```json
{
  "plugin": [
    "file:///ABSOLUTE/PATH/TO/dedge-harness-init-guide/dist/index.js"
  ]
}
```

规则：

- `plugin` 必须是数组。
- 数组项必须是绝对路径的 `file://` URL。
- 当前阶段必须挂载 dist 产物。

## 命令输出约定

上述 3 个 debug 命令都应输出 JSON 到 stdout。

- `debug skill`：JSON 数组，元素至少包含 `name`（string）、`location`（string）
- `debug agent harness-init`：JSON 对象，至少包含 `name`（string）、`prompt`（string）、`mode`（string）
- `debug config`：JSON 对象，并满足下文“必需断言”

若输出不可解析为 JSON，视为测试失败，并回传完整 stdout/stderr。

## `debug config` 必需断言

- 命令退出码必须为 0。
- stdout 必须可解析为 JSON 对象。
- 解析后的配置需能证明 workspace 本地挂载生效（包含仓库 dist 插件路径 `.../dist/index.js`）。
- 命令运行的 cwd 必须等于当前 case 的 workspace 路径。

## 断言模型

### Agent 断言

- `opencode debug agent harness-init` 可成功查询到目标 agent。
- `prompt` 必须解析到本仓库 `dist/builtin/agents/harness-init.md`。
- `mode` 必须为 `primary`（防止行为意外漂移）。

### Skill 断言

- 必须存在以下 skill 名称：
  - `harness-env-skill`
  - `harness-repo-skill`
  - `harness-agents-doc-skill`
- 每个目标 skill 的 `location` 必须位于本仓库 `dist/builtin/skills/...`。

路径规范化规则（agent + skills 通用）：

- 对每个 `prompt`/`location`：
  - 若含 URL scheme，则必须是 `file://`；先按 URL 解析并解码到文件路径。
  - 若是非 `file` scheme，立即失败。
  - 再转为 canonical 绝对路径（realpath 语义）。
- 仓库根路径同样转为 canonical 绝对路径。
- 比较前统一路径分隔符。
- 必须满足严格前缀匹配：
  - Agent prompt 前缀：`${REPO_ROOT}/dist/builtin/agents/`
  - Skill location 前缀：`${REPO_ROOT}/dist/builtin/skills/`

该规则用于避免“同名但来自外部路径”的假阳性。

## 错误处理与诊断

失败类型：

- 构建产物缺失（`dist/index.js` 不存在）
- 插件挂载无效（`opencode.json` 中 plugin 路径非法）
- 运行时加载失败（必需 agent/skills 缺失）
- 同名污染（名称存在但来源路径不在预期 dist 前缀下）
- 执行根目录错误（命令未在测试 workspace 运行）

诊断要求：

- 失败信息必须包含：命令、cwd、退出码、stdout、stderr
- 来源路径断言失败时必须输出：期望路径前缀 vs 实际规范化路径
- 支持 `E2E_KEEP_WORKSPACE=1` 保留现场用于本地排障
- 超时失败必须包含：命令、超时阈值、cwd

## 稳定性策略

- 基于 JSON 结构断言，避免脆弱的纯文本匹配
- 路径统一做 realpath 语义规范化后比较
- 每个 case 使用独立 workspace，避免配置串扰
- 显式超时约定：
  - 构建命令超时：120 秒
  - 每个 debug 命令超时：30 秒
- 运行前清理同 case 旧 workspace
- 运行后默认清理 workspace；仅 `E2E_KEEP_WORKSPACE=1` 时保留

## 兼容扩展准备

内部引入挂载 profile 抽象（本阶段先实现一个）：

- `opencode-dist`（本次实现）

下一阶段预留：

- `claude-dist`（后续实现），复用同一断言内核，仅替换配置/挂载机制。

## 测试矩阵

本阶段必需 case：

- `opencode-dist-loads-agent-and-skills-from-repo-dist`

期望结果：

- 仅当“名称正确 + 来源路径正确”同时满足时通过
- 若仅名称存在但来源路径外部，则失败

## 现有测试迁移

- `tests/builtin-content.test.ts` 迁移到 `tests/opencode/unit/`
- `tests/config-handler.test.ts` 迁移到 `tests/opencode/unit/`
- `tests/index.test.ts` 迁移到 `tests/opencode/unit/`

测试发现机制说明：

- 当前 `bun test` 会递归发现 `*.test.ts`，迁移后仍可被执行。
- 若后续改为显式 include pattern，必须覆盖：
  - `tests/opencode/unit/**/*.test.ts`
  - `tests/opencode/e2e/**/*.test.ts`

这些单测仍保留价值，但不再承担“运行时加载证明”职责。

## 验收标准

满足以下条件即视为设计通过：

- OpenCode E2E 能证明 dist 挂载插件在真实 CLI 运行时生效
- 断言同时覆盖名称存在与来源路径正确性
- 所有 workspace 均在 `tests/` 下自动创建，无需手工准备
- 目录结构为后续 `tests/claude/e2e/` 实现保留清晰扩展位
