# OpenCode Plugin Development Reference Examples

日期：2026-04-14  
用途：作为 `docs/OPENCODE_PLUGIN_DEVELOPMENT_GUIDE.md` 的配套示例文档，提供来自本仓库的真实代码参考

这份文档刻意保留较多实例。它的作用不是告诉后续 agent “照着做同一个业务插件”，而是让后续 agent 能看到：

**一个真实的 OpenCode 插件仓库，在源码层、构建层、测试层到底是怎么接起来的。**

---

## 1. Example: Minimal Runtime Entry

文件：`src/index.ts`

```ts
import { fileURLToPath } from "node:url"

import { createHarnessInitPlugin, resolveBuiltinPaths } from "./plugin-factory"

const runtimeFile = fileURLToPath(import.meta.url)
const runtimePaths = resolveBuiltinPaths(runtimeFile)

const plugin = async () => createHarnessInitPlugin(runtimePaths)

export default plugin
```

这个例子说明了什么：

1. 入口文件可以非常薄；
2. builtin 资产路径应基于运行时文件位置解析；
3. 插件具体装配逻辑应该放在工厂层，而不是入口层。

可迁移经验：

- 入口越薄，越便于同时支持源码加载与 dist 加载；
- 入口尽量不要掺杂大量业务逻辑；
- 真正复杂的逻辑放在 `plugin-factory.ts` 或 handlers 中。

---

## 2. Example: Config Merge Handler

文件：`src/handlers/config-handler.ts`

这个文件展示了 OpenCode 插件中最常见、也最容易写错的一类逻辑：**运行时配置注入与 merge**。

它体现了几个关键技巧：

1. 先 clone 输入配置，不直接假设原对象结构；
2. `skills.paths` 只在缺失时追加；
3. 注入目标 agent 时不影响其他 agent；
4. 默认权限只补缺省值，不覆盖用户显式配置；
5. 先解析 agent frontmatter，再生成运行时 agent 配置。

代表片段：

```ts
const existingPaths = Array.isArray(next.skills?.paths)
  ? [...next.skills.paths]
  : []

if (!existingPaths.includes(options.builtinSkillsDir)) {
  existingPaths.push(options.builtinSkillsDir)
}

next.skills = {
  ...(next.skills ?? {}),
  paths: existingPaths,
}
```

应提炼出的通用经验：

- 插件对 config 的操作，本质上是在做“增量注入”，不是“配置接管”；
- 如果你的插件没有完全拥有某个配置分支，就不要覆盖它；
- `skills.paths`、`agent.*`、`permission.*` 都应优先使用追加或浅层 merge。

---

## 3. Example: Agent Prompt with Frontmatter

文件：`src/builtin/agents/harness-init.md`

头部示例：

```md
---
description: Harness workspace initializer and manager orchestrator
mode: primary
---
```

这个例子说明：

1. agent 的元数据可以与 prompt 文本放在同一个 markdown 文件里；
2. prompt 内容可以像文档一样维护和审阅；
3. 运行时代码可以解析 frontmatter 后再注入 OpenCode 配置。

可迁移经验：

- 不建议把大型 prompt 直接写成 TypeScript 字符串；
- markdown 文件更利于版本审查、内容 diff、非代码成员协作；
- frontmatter 是管理 `description`、`mode` 等字段的自然方式。

---

## 4. Example: Skill Packaging Pattern

文件：

- `src/builtin/skills/harness-agent-env/SKILL.md`
- `src/builtin/skills/harness-git-worktree/SKILL.md`
- `src/builtin/skills/harness-docs/SKILL.md`

这些 skill 的业务内容并不通用，但结构非常值得参考。

它们共同体现了：

1. 每个 skill 都拥有清晰的资产边界；
2. 每个 skill 都定义了必须做什么和不能做什么；
3. 每个 skill 都强调校验或验收；
4. 至少有一个 skill 显式支持初始化与持续管理两种模式。

真正可复用的不是业务词汇，而是这种结构：

- 守则 / Principles
- 初始化 / Initialize
- 管理 / Maintain
- 校验 / Validation
- 输入输出 / Inputs and Outputs

可迁移经验：

- skill 最好写成“谁拥有资产、怎么改、怎么验收”的文档；
- 对成熟项目，只会初始化不会维护的 skill 价值有限；
- skill 的重点不是写得很长，而是让 agent 执行时减少歧义。

---

## 5. Example: Multi-Plugin Build in One Repository

文件：`package.json`

构建脚本片段：

```json
{
  "scripts": {
    "build": "bun build src/index.ts --outfile dist/harness_init.js --target bun --format esm && bun build src/shell-env-prepare-index.ts --outfile dist/harness_shell_env_prepare_plugin.js --target bun --format esm && mkdir -p dist/builtin && cp -R src/builtin/agents dist/builtin/ && cp -R src/builtin/skills dist/builtin/ && cp -R src/builtin/templates dist/builtin/"
  }
}
```

这个例子说明：

1. 一个仓库可以产出多个插件入口；
2. 多个插件可以共享一份 `dist/builtin/` 资产；
3. 构建阶段不一定复杂，关键是输出命名清晰、资产复制稳定。

可迁移经验：

- 多插件仓库适合共享测试、共享资产、共享发布链路的场景；
- 但它只是一个可选工程组织模式；
- 不应把“多入口”误写成所有插件项目都必须采用的架构。

---

## 6. Example: Session and Shell Runtime State

文件：

- `src/shell-env-prepare-index.ts`
- `src/shell-env-prepare-plugin-factory.ts`
- `src/handlers/shell-env-session-handler.ts`
- `src/handlers/shell-env-hook-handler.ts`

这个例子展示了一类很重要的插件能力：**会话级状态加载与后续 hook 复用**。

它体现了：

1. 插件可以在 session 创建时加载状态；
2. 这些状态可以通过 factory closure 在多个 hook 间共享；
3. 外部 JSON 进入运行时前，应先做过滤与规范化；
4. shell 相关行为不一定要粗暴改写整条命令，也可以走环境注入或受控前置策略。

代表片段：

```ts
const state = {
  envCache: {},
  worktreeRoot: options.worktreeRoot,
  cacheLoaded: false,
}
```

可迁移经验：

- `plugin-factory.ts` 很适合承载 session 级状态；
- 只要状态生命周期清楚，factory closure 是比全局单例更安全的选择；
- 任何从工作区读取进来的数据都不应直接信任。

---

## 7. Example: Schema-Based Asset Parsing

文件：`src/handlers/shell-env-session-handler.ts`

示例片段：

```ts
if (payload.schema !== SESSION_ENV_SCHEMA) {
  return {}
}

if (!isRecord(payload.env)) {
  return {}
}
```

这个例子说明：

1. 插件消费工作区资产时，最好定义明确 schema；
2. 解析必须严格；
3. 失败时可以降级为空，而不是直接污染运行时；
4. 如有历史包袱，可保留有限向后兼容。

可迁移经验：

- 工作区中的 JSON、模板、脚本，对插件来说都应视为“外部输入”；
- 外部输入必须有契约；
- schema 是降低长期维护成本的重要手段。

---

## 8. Example: Unit Test Contracts

文件：

- `tests/opencode/unit/config-handler.test.ts`
- `tests/opencode/unit/index.test.ts`
- `tests/opencode/unit/shell-env-prepare-plugin.test.ts`

这些测试真正验证的是“插件承诺的行为”，而不是只验证实现细节。

它们覆盖了：

1. merge 行为是否正确；
2. 幂等性是否成立；
3. prompt 解析是否稳定；
4. schema 边界是否处理正确；
5. hook 暴露面与运行时行为是否符合设计。

代表性断言包括：

- `skills.paths` 只注入一次；
- 用户现有 config 不被破坏；
- 不强制设置默认 agent；
- 非法 JSON 时安全降级；
- 某类资产缺失时，不注入对应环境变量。

可迁移经验：

- unit test 应直接对应插件对用户的稳定承诺；
- 不要只围绕内部函数写“实现型测试”；
- 幂等性和 merge 安全性值得单独写测试。

---

## 9. Example: Black-Box OpenCode E2E

文件：

- `tests/opencode/e2e/opencode-dist-load.test.ts`
- `tests/opencode/e2e/helpers/assertions.ts`
- `tests/opencode/e2e/helpers/cli.ts`
- `tests/opencode/e2e/helpers/workspace.ts`
- `tests/opencode/e2e/helpers/path-utils.ts`

这个例子展示了如何验证：**OpenCode 真实运行时是否加载了你刚构建出来的插件。**

主要流程：

1. 先构建 dist；
2. 在 `tests/` 下创建独立 workspace；
3. 生成局部 `opencode.json`；
4. 调用真实 `opencode debug ...` 命令；
5. 解析 JSON 输出并断言运行时结果。

挂载配置示例：

```json
{
  "plugin": [
    "file:///ABSOLUTE/PATH/TO/dist/harness_init.js"
  ]
}
```

这个例子最值得借鉴的一点是：

**断言不是只看名字，而是同时看名字和来源路径。**

可迁移经验：

- 真实 E2E 必须证明“OpenCode 加载的是你构建出来的那个插件”；
- 只按名称匹配会出现同名污染；
- 路径比较前应做 URL 解析、realpath 和分隔符规范化。

---

## 10. Example: README Topics Worth Reusing

文件：`README.md`

当前仓库 README 值得参考的不是业务内容，而是它覆盖的主题范围：

1. 每个插件入口做什么；
2. Quick Start；
3. `opencode.json` 挂载示例；
4. 运行时约束；
5. 版本与 Roadmap；
6. 开发和 E2E 命令。

可迁移经验：

- 插件 README 应该面向“使用者 + 维护者”双重读者；
- 使用者关心怎么挂载、会生效什么；
- 维护者关心怎么构建、怎么测试、怎么排障。

---

## 11. Example: How to Reuse These Examples Correctly

建议复制的东西：

1. runtime code 与 builtin assets 的分层；
2. merge-safe 的 config 注入模式；
3. dist 阶段明确复制 builtin 资产；
4. 黑盒运行时测试思路；
5. skill 的初始化 + 维护双模式结构。

不建议直接照抄的东西：

1. 业务 prompt 内容；
2. agent 名称；
3. skill 名称；
4. 当前仓库是否多插件；
5. 当前仓库的业务目录假设。

最后一句经验非常重要：

这些实例真正可复用的地方，是它们的**工程结构与验证方法**，不是它们的业务词汇。
