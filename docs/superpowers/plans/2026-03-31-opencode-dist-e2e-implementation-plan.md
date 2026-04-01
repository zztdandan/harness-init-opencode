# OpenCode Dist E2E 测试落地 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增基于真实 `opencode` CLI 的黑盒 E2E 测试，自动构建并挂载 `dist` 插件，验证 agent/skills 在运行时按“名称 + 来源路径”生效。

**Architecture:** 在 `tests/opencode/e2e` 下实现一个可复用的测试支撑层（CLI 运行、workspace 管理、路径规范化、JSON 解析与断言），由单一主用例驱动。现有单测迁移到 `tests/opencode/unit`，继续承担快速回归；E2E 成为运行时真实性证明。

**Tech Stack:** TypeScript, Bun test, Node.js child_process/fs/path/url

---

## 文件结构与职责

- 新建 `tests/opencode/e2e/helpers/constants.ts`
  - 统一常量：case id、超时阈值、目标 agent/skills 名称、环境变量名。
- 新建 `tests/opencode/e2e/helpers/path-utils.ts`
  - 路径/URL 规范化：`file://` 解析、`realpath`、分隔符归一化、前缀校验。
- 新建 `tests/opencode/e2e/helpers/workspace.ts`
  - workspace 生命周期：清理、创建、写入 `opencode.json`、按需保留现场。
- 新建 `tests/opencode/e2e/helpers/cli.ts`
  - CLI 解析策略与命令执行封装（cwd 强制、超时、stdout/stderr 采集）。
- 新建 `tests/opencode/e2e/helpers/assertions.ts`
  - 对 `debug config` / `debug skill` / `debug agent` 输出做结构化断言。
- 新建 `tests/opencode/e2e/opencode-dist-load.test.ts`
  - 主 E2E 用例：构建 + 挂载 + 三命令 + 全量断言。
- 新建 `tests/claude/e2e/.gitkeep`
  - 预留 Claude E2E 目录。
- 迁移 `tests/builtin-content.test.ts` -> `tests/opencode/unit/builtin-content.test.ts`
- 迁移 `tests/config-handler.test.ts` -> `tests/opencode/unit/config-handler.test.ts`
- 迁移 `tests/index.test.ts` -> `tests/opencode/unit/index.test.ts`

---

### Task 1: 创建 E2E 目录骨架与常量契约

**Files:**
- Create: `tests/opencode/e2e/helpers/constants.ts`
- Create: `tests/opencode/e2e/opencode-dist-load.test.ts`
- Create: `tests/claude/e2e/.gitkeep`

- [ ] **Step 1: 写失败测试（常量契约）**

在 `tests/opencode/e2e/helpers/constants.ts` 所在同目录新增最小校验（可放入后续主用例的第一个 `test`）：

```ts
expect(REQUIRED_SKILLS).toEqual([
  "harness-env-skill",
  "harness-repo-skill",
  "harness-agents-doc-skill",
])
```

- [ ] **Step 2: 运行测试确认失败**

Run: `bun test tests/opencode/e2e/opencode-dist-load.test.ts`
Expected: FAIL（文件/导出尚不存在）

- [ ] **Step 3: 实现最小常量文件**

在 `constants.ts` 定义：

```ts
export const CASE_ID = "opencode-dist-loads-agent-and-skills-from-repo-dist"
export const BUILD_TIMEOUT_MS = 120_000
export const DEBUG_TIMEOUT_MS = 30_000
export const REQUIRED_AGENT = "harness-init"
export const REQUIRED_SKILLS = [
  "harness-env-skill",
  "harness-repo-skill",
  "harness-agents-doc-skill",
] as const
export const ENV_OPENCODE_CLI = "OPENCODE_CLI"
export const ENV_ALLOW_FALLBACK = "E2E_ALLOW_CLI_FALLBACK"
export const ENV_KEEP_WORKSPACE = "E2E_KEEP_WORKSPACE"
```

- [ ] **Step 4: 运行测试确认通过**

Run: `bun test tests/opencode/e2e/opencode-dist-load.test.ts`
Expected: PASS（常量断言通过；其余部分可暂 skip）

- [ ] **Step 5: Commit**

```bash
git add tests/opencode/e2e/helpers/constants.ts tests/claude/e2e/.gitkeep tests/opencode/e2e/opencode-dist-load.test.ts
git commit -m "test: scaffold opencode e2e constants and claude e2e placeholder"
```

### Task 2: 实现路径规范化工具（来源断言基础）

**Files:**
- Create: `tests/opencode/e2e/helpers/path-utils.ts`
- Modify: `tests/opencode/e2e/opencode-dist-load.test.ts`

- [ ] **Step 1: 写失败测试（路径规范化）**

新增用例覆盖：

```ts
expect(normalizeObservedPath("file:///tmp/a%20b")).toContain("/tmp/a b")
expect(() => normalizeObservedPath("https://x/y")).toThrow()
```

- [ ] **Step 2: 运行测试确认失败**

Run: `bun test tests/opencode/e2e/opencode-dist-load.test.ts`
Expected: FAIL（函数未实现）

- [ ] **Step 3: 实现最小路径工具**

实现函数：

- `normalizeObservedPath(value: string): string`
- `canonicalPath(value: string): string`
- `assertHasPrefix(actual: string, expectedPrefix: string, message: string): void`

规则严格执行 spec：仅允许 `file://` scheme，其他 scheme 直接抛错。

- [ ] **Step 4: 运行测试确认通过**

Run: `bun test tests/opencode/e2e/opencode-dist-load.test.ts`
Expected: PASS（路径相关断言通过）

- [ ] **Step 5: Commit**

```bash
git add tests/opencode/e2e/helpers/path-utils.ts tests/opencode/e2e/opencode-dist-load.test.ts
git commit -m "test: add canonical path normalization for e2e source assertions"
```

### Task 3: 实现 workspace 生命周期与 `opencode.json` 自动挂载

**Files:**
- Create: `tests/opencode/e2e/helpers/workspace.ts`
- Modify: `tests/opencode/e2e/opencode-dist-load.test.ts`

- [ ] **Step 1: 写失败测试（workspace 管理）**

新增断言：

```ts
expect(await exists(workspacePath)).toBe(true)
expect(readJson("opencode.json").plugin[0]).toContain("/dist/index.js")
```

- [ ] **Step 2: 运行测试确认失败**

Run: `bun test tests/opencode/e2e/opencode-dist-load.test.ts`
Expected: FAIL（workspace helper 未实现）

- [ ] **Step 3: 实现最小 workspace helper**

实现：

- `prepareWorkspace(caseId: string, pluginDistIndexJs: string)`
- `cleanupWorkspace(path: string, keep: boolean)`
- `prepareWorkspace` 的固定输出根路径必须是 `tests/opencode/e2e/workspaces/${caseId}`（禁止使用系统临时目录）
- 写入精确结构 `opencode.json`：

```json
{
  "plugin": ["file:///ABSOLUTE/PATH/TO/dist/index.js"]
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `bun test tests/opencode/e2e/opencode-dist-load.test.ts`
Expected: PASS（workspace 创建、配置写入、清理行为符合预期）

- [ ] **Step 5: Commit**

```bash
git add tests/opencode/e2e/helpers/workspace.ts tests/opencode/e2e/opencode-dist-load.test.ts
git commit -m "test: automate e2e workspace provisioning and plugin mount config"
```

### Task 3.5: 引入最小挂载 profile 抽象（当前仅 `opencode-dist`）

**Files:**
- Create: `tests/opencode/e2e/helpers/mount-profile.ts`
- Modify: `tests/opencode/e2e/helpers/workspace.ts`
- Modify: `tests/opencode/e2e/opencode-dist-load.test.ts`

- [ ] **Step 1: 写失败测试（profile 约束）**

新增断言：

```ts
expect(resolveMountProfile("opencode-dist").name).toBe("opencode-dist")
expect(() => resolveMountProfile("unknown" as never)).toThrow()
```

- [ ] **Step 2: 运行测试确认失败**

Run: `bun test tests/opencode/e2e/opencode-dist-load.test.ts`
Expected: FAIL（profile 抽象未实现）

- [ ] **Step 3: 实现最小 profile 抽象**

实现：

- `type MountProfileName = "opencode-dist"`
- `resolveMountProfile(name)`
- 由 profile 负责生成 `opencode.json` 内容
- `prepareWorkspace` 与主测试流程统一通过 profile 生成挂载配置

- [ ] **Step 4: 运行测试确认通过**

Run: `bun test tests/opencode/e2e/opencode-dist-load.test.ts`
Expected: PASS（当前仅支持 `opencode-dist`，并保留后续 `claude-dist` 扩展位）

- [ ] **Step 5: Commit**

```bash
git add tests/opencode/e2e/helpers/mount-profile.ts tests/opencode/e2e/helpers/workspace.ts tests/opencode/e2e/opencode-dist-load.test.ts
git commit -m "test: add mount profile abstraction with opencode-dist baseline"
```

### Task 4: 实现 CLI 执行层（OPENCODE_CLI 契约 + 超时 + cwd）

**Files:**
- Create: `tests/opencode/e2e/helpers/cli.ts`
- Modify: `tests/opencode/e2e/opencode-dist-load.test.ts`

- [ ] **Step 1: 写失败测试（CLI 选择规则）**

覆盖以下场景：

- 未设置 `OPENCODE_CLI` 且无 fallback 开关 -> 失败
- 开启 fallback 且存在 `opencode` -> 可执行

- [ ] **Step 2: 运行测试确认失败**

Run: `bun test tests/opencode/e2e/opencode-dist-load.test.ts`
Expected: FAIL（CLI helper 未实现）

- [ ] **Step 3: 实现最小 CLI helper**

实现：

- `resolveOpencodeCli(env)`
- `runCommand({ command, args, cwd, timeoutMs })`
- 错误消息包含：command/cwd/exitCode/stdout/stderr/timeoutMs

- [ ] **Step 4: 运行测试确认通过**

Run: `bun test tests/opencode/e2e/opencode-dist-load.test.ts`
Expected: PASS（CLI 策略与错误模型稳定）

- [ ] **Step 5: Commit**

```bash
git add tests/opencode/e2e/helpers/cli.ts tests/opencode/e2e/opencode-dist-load.test.ts
git commit -m "test: add deterministic opencode cli resolution and command runner"
```

### Task 5: 实现结构化断言层（config/skill/agent）

**Files:**
- Create: `tests/opencode/e2e/helpers/assertions.ts`
- Modify: `tests/opencode/e2e/opencode-dist-load.test.ts`

- [ ] **Step 1: 写失败测试（JSON 解析与必需字段）**

新增断言：

```ts
expect(() => parseJsonOutput("not-json")).toThrow()
expect(() => assertDebugAgentShape({})).toThrow()
expect(() => assertDebugSkillShape([{}])).toThrow()
expect(() =>
  assertRequiredAgentFromDist(
    { name: "harness-init", mode: "all", prompt: "file:///tmp/agent.md" },
    "harness-init",
    "/repo/dist/builtin/agents/",
  ),
).toThrow()
expect(() =>
  assertRequiredSkillsFromDist(
    [{ name: "harness-env-skill", location: "file:///tmp/skill.md" }],
    ["harness-env-skill", "harness-repo-skill", "harness-agents-doc-skill"],
    "/repo/dist/builtin/skills/",
  ),
).toThrow()
```

- [ ] **Step 2: 运行测试确认失败**

Run: `bun test tests/opencode/e2e/opencode-dist-load.test.ts`
Expected: FAIL（断言 helper 未实现）

- [ ] **Step 3: 实现最小断言 helper**

实现：

- `parseJsonOutput(stdout: string)`
- `assertDebugConfigHasPlugin(config, distPath)`
- `assertRequiredSkillsFromDist(skills, requiredSkills, expectedPrefix)`
- `assertRequiredAgentFromDist(agent, requiredAgent, expectedPromptPrefix)`

实现责任必须明确包含：

- `assertRequiredAgentFromDist` 必须校验 `mode === "primary"`。
- `assertRequiredSkillsFromDist` 必须在“名称命中但来源路径不在 dist 前缀”时抛错。
- `assertRequiredAgentFromDist` 必须在“名称命中但 prompt 来源路径不在 dist 前缀”时抛错。

- [ ] **Step 4: 运行测试确认通过（含负例）**

Run: `bun test tests/opencode/e2e/opencode-dist-load.test.ts`
Expected: PASS（结构化断言稳定，且同名污染负例触发失败行为已被覆盖）

- [ ] **Step 5: Commit**

```bash
git add tests/opencode/e2e/helpers/assertions.ts tests/opencode/e2e/opencode-dist-load.test.ts
git commit -m "test: add structured assertions for opencode debug outputs"
```

### Task 6: 打通主 E2E 用例（真实构建 + 真实 CLI）

**Files:**
- Modify: `tests/opencode/e2e/opencode-dist-load.test.ts`

- [ ] **Step 1: 写失败测试（端到端主流程）**

主测试名：

```ts
test("opencode-dist-loads-agent-and-skills-from-repo-dist", async () => {
  // build -> prepare workspace -> run debug commands -> assert
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `bun test tests/opencode/e2e/opencode-dist-load.test.ts --timeout 180000`
Expected: FAIL（流程尚未串联）

- [ ] **Step 3: 接入构建命令并断言结果**

实现并断言：

- 执行 `bun run build`，超时 `120s`
- 断言退出码为 `0`
- 断言 `dist/index.js` 存在

- [ ] **Step 4: 串联 workspace 准备并断言挂载文件**

实现并断言：

- 调用 `prepareWorkspace`
- `workspacePath` 必须以 `tests/opencode/e2e/workspaces/${CASE_ID}` 前缀开头
- workspace 下存在 `opencode.json`
- `opencode.json.plugin` 包含 `file:///.../dist/index.js`

- [ ] **Step 5: 执行并断言 `debug config`**

实现并断言：

- 执行 `<OPENCODE_CLI> debug config`，超时 `30s`
- 退出码为 `0`
- stdout 可解析为 JSON 对象
- 包含 `.../dist/index.js` 挂载证据
- 记录并断言执行 `cwd === workspacePath`

- [ ] **Step 6: 执行并断言 `debug skill` + `debug agent`**

实现并断言：

- 执行 `debug skill` 与 `debug agent harness-init`（各 `30s`）
- 覆盖“名称存在 + 来源路径命中 dist 前缀 + agent mode 为 primary”

- [ ] **Step 7: 处理清理分支并断言目录状态**

实现并断言：

- `E2E_KEEP_WORKSPACE=1` 时 workspace 保留
- 默认情况下 workspace 被清理

- [ ] **Step 8: 运行测试确认通过**

Run: `bun test tests/opencode/e2e/opencode-dist-load.test.ts --timeout 180000`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add tests/opencode/e2e/opencode-dist-load.test.ts
git commit -m "test: implement black-box opencode dist e2e runtime verification"
```

### Task 7: 迁移现有单测到 `tests/opencode/unit`

**Files:**
- Move: `tests/builtin-content.test.ts` -> `tests/opencode/unit/builtin-content.test.ts`
- Move: `tests/config-handler.test.ts` -> `tests/opencode/unit/config-handler.test.ts`
- Move: `tests/index.test.ts` -> `tests/opencode/unit/index.test.ts`

- [ ] **Step 1: 执行迁移并修正 import 路径**

按新目录修复 `../src/...` 相对路径。

- [ ] **Step 2: 运行 unit 测试确认通过**

Run: `bun test tests/opencode/unit`
Expected: PASS

- [ ] **Step 3: 运行全量测试确认通过**

Run: `bun test --timeout 180000`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add tests/opencode/unit tests
git commit -m "test: reorganize unit tests under tests/opencode/unit"
```

### Task 8: 文档更新（测试使用说明）

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 写失败测试（如有 README 断言则先补）**

若已有 README 结构断言，先补失败断言；若无可跳过该步。

- [ ] **Step 2: 更新 README 的测试章节**

新增：

- `OPENCODE_CLI` 必填说明
- 可选 `E2E_ALLOW_CLI_FALLBACK=1`
- `E2E_KEEP_WORKSPACE=1`
- 运行命令：`bun test tests/opencode/e2e/opencode-dist-load.test.ts`

- [ ] **Step 3: 运行全量测试确认通过**

Run: `bun test --timeout 180000`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: describe opencode dist e2e setup and execution"
```

### Task 9: 最终验证与交付清单

**Files:**
- Modify: `docs/superpowers/specs/2026-03-31-opencode-dist-e2e-design.md`（仅在验收口径有必要补充时）

- [ ] **Step 1: 运行目标 E2E（保留现场模式）**

Run: `E2E_KEEP_WORKSPACE=1 OPENCODE_CLI=<path> bun test tests/opencode/e2e/opencode-dist-load.test.ts --timeout 180000`
Expected: PASS，并可检查保留 workspace 内容。

- [ ] **Step 2: 运行全量测试**

Run: `OPENCODE_CLI=<path> bun test --timeout 180000`
Expected: PASS

- [ ] **Step 3: 清理保留现场并二次确认**

Run: `OPENCODE_CLI=<path> bun test tests/opencode/e2e/opencode-dist-load.test.ts --timeout 180000`
Expected: PASS（默认自动清理）

- [ ] **Step 4: 准备交付说明**

输出内容包含：

- 新增/迁移文件列表
- 一条可直接运行的 E2E 命令
- 一条可直接运行的全量测试命令
- 已知限制（当前仅实现 `opencode-dist`，`claude-dist` 仅预留）
