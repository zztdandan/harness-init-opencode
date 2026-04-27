# OpenCode Plugin Development Reference Examples

日期：2026-04-16  
用途：作为 `OPENCODE_PLUGIN_DEVELOPMENT_GUIDE.md` 的配套“可直接迁移”示例文档

本文不再依赖本仓库真实文件路径。你可以把下面示例直接复制到任意新仓库，作为通用插件骨架使用。

---

## 1. 目标与使用方式

这份文档解决一个常见问题：

> 文档只写“看某个文件”，但不提供可运行代码，离开原仓库就无法复用。

因此，本文每个示例都给出：

1. 可落地的代码片段；
2. 代码背后的通用设计意图；
3. 你在其他业务场景可直接替换的部分。

---

## 2. 通用插件骨架（可直接创建）

```text
your-opencode-plugin/
  src/
    index.ts
    plugin-factory.ts
    handlers/
      config-handler.ts
      event-handler.ts
    tools/
      scaffold-file.ts
    builtin/
      agents/
        general-assistant.md
      skills/
        component-scaffold/
          SKILL.md
          reference/
            naming-convention.md
      templates/
        component-template.md
  tests/
    unit/
      config-handler.test.ts
    e2e/
      opencode-dist-load.test.ts
  package.json
  tsconfig.json
  README.md
```

这个结构的关键是把“运行时代码”和“随插件分发的内容资产”分层。

---

## 3. 示例一：最小入口（`src/index.ts`）

```ts
import { fileURLToPath } from "node:url"

import { createGenericPlugin, resolveBuiltinPaths } from "./plugin-factory"

const runtimeFile = fileURLToPath(import.meta.url)
const runtimePaths = resolveBuiltinPaths(runtimeFile)

export default async function plugin() {
  return createGenericPlugin(runtimePaths)
}
```

为什么这样写：

- 入口保持很薄，便于调试；
- 不写死绝对路径，源码加载和 dist 加载都能工作；
- 真正逻辑下沉到 `plugin-factory.ts`。

---

## 4. 示例二：插件工厂与路径解析（`src/plugin-factory.ts`）

```ts
import { dirname, resolve } from "node:path"

import type { Plugin } from "@opencode-ai/plugin"

import { applyConfigMerge } from "./handlers/config-handler"
import { createScaffoldFileTool } from "./tools/scaffold-file"

export type RuntimePaths = {
  builtinRoot: string
  builtinSkillsDir: string
  builtinAgentsDir: string
  builtinTemplatesDir: string
}

export function resolveBuiltinPaths(runtimeFile: string): RuntimePaths {
  const runtimeDir = dirname(runtimeFile)
  const builtinRoot = resolve(runtimeDir, "./builtin")

  return {
    builtinRoot,
    builtinSkillsDir: resolve(builtinRoot, "./skills"),
    builtinAgentsDir: resolve(builtinRoot, "./agents"),
    builtinTemplatesDir: resolve(builtinRoot, "./templates"),
  }
}

export function createGenericPlugin(paths: RuntimePaths): Plugin {
  return {
    name: "generic_component_plugin",

    async config(inputConfig) {
      // 关键：OpenCode 的 config hook 当前不消费返回值，
      // 必须把 merge 结果回写到 inputConfig 才会生效。
      const next = await applyConfigMerge(inputConfig, {
        builtinSkillsDir: paths.builtinSkillsDir,
        agentName: "general-assistant",
        agentFile: resolve(paths.builtinAgentsDir, "general-assistant.md"),
      })

      Object.assign(inputConfig, next)
    },

    async tools() {
      return [createScaffoldFileTool()]
    },
  }
}
```

可替换点：

- `name` 换成你的插件名；
- `agentName` 与 `agentFile` 换成你的 agent；
- `tools()` 中增删工具即可扩展能力。

---

## 5. 示例三：Config 增量合并（`src/handlers/config-handler.ts`）

```ts
import { readFile } from "node:fs/promises"

type MergeOptions = {
  builtinSkillsDir: string
  agentName: string
  agentFile: string
}

type Frontmatter = {
  description?: string
  mode?: string
}

function parseFrontmatter(markdown: string): Frontmatter {
  if (!markdown.startsWith("---\n")) return {}
  const end = markdown.indexOf("\n---\n", 4)
  if (end < 0) return {}

  const block = markdown.slice(4, end)
  const result: Frontmatter = {}

  for (const line of block.split("\n")) {
    const [key, ...rest] = line.split(":")
    if (!key || rest.length === 0) continue
    const value = rest.join(":").trim()
    if (key.trim() === "description") result.description = value
    if (key.trim() === "mode") result.mode = value
  }

  return result
}

export async function applyConfigMerge(inputConfig: any, options: MergeOptions) {
  const next = structuredClone(inputConfig ?? {})

  // 1) skills.paths: 只追加缺失路径
  const existingPaths = Array.isArray(next.skills?.paths) ? [...next.skills.paths] : []
  if (!existingPaths.includes(options.builtinSkillsDir)) {
    existingPaths.push(options.builtinSkillsDir)
  }
  next.skills = {
    ...(next.skills ?? {}),
    paths: existingPaths,
  }

  // 2) agent: 只补充插件自己的 agent，不覆盖用户其他 agent
  const raw = await readFile(options.agentFile, "utf8")
  const meta = parseFrontmatter(raw)
  const content = raw.replace(/^---\n[\s\S]*?\n---\n/, "").trim()

  next.agent = {
    ...(next.agent ?? {}),
    [options.agentName]: {
      description: meta.description ?? "Generic development assistant",
      mode: meta.mode ?? "subagent",
      prompt: content,
    },
  }

  // 3) permission: 仅补默认值，不覆盖用户显式配置
  next.permission = {
    ...(next.permission ?? {}),
    bash: next.permission?.bash ?? "ask",
    webfetch: next.permission?.webfetch ?? "deny",
  }

  return next
}
```

这段代码给出的通用结论：

1. 插件做的是“合并”，不是“接管”；
2. 路径、agent、权限都应该是补充式写入；
3. 幂等（重复执行不重复注入）必须体现在代码里。

---

## 6. 示例四：通用 Tool（`src/tools/scaffold-file.ts`）

```ts
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"

type ScaffoldInput = {
  workspaceRoot: string
  relativePath: string
  content: string
  overwrite?: boolean
}

function assertSafePath(relativePath: string): void {
  if (relativePath.startsWith("/") || relativePath.includes("..")) {
    throw new Error("relativePath must stay inside workspace")
  }
}

export function createScaffoldFileTool() {
  return {
    name: "scaffold_file",
    description: "Create a file in workspace with guardrails",
    inputSchema: {
      type: "object",
      properties: {
        workspaceRoot: { type: "string" },
        relativePath: { type: "string" },
        content: { type: "string" },
        overwrite: { type: "boolean" },
      },
      required: ["workspaceRoot", "relativePath", "content"],
    },
    async execute(input: ScaffoldInput) {
      assertSafePath(input.relativePath)
      const absolute = resolve(input.workspaceRoot, input.relativePath)

      await mkdir(dirname(absolute), { recursive: true })
      await writeFile(absolute, input.content, {
        encoding: "utf8",
        flag: input.overwrite ? "w" : "wx",
      })

      return {
        ok: true,
        file: absolute,
      }
    },
  }
}
```

通用实践点：

- 输入 schema 明确；
- 路径防越界（防止写出 workspace）；
- 输出结构化，便于后续 agent 链路消费。

---

## 7. 示例五：Agent Prompt 资产（`src/builtin/agents/general-assistant.md`）

```md
---
description: Generic plugin development assistant
mode: subagent
---

You are an assistant that helps users build reusable OpenCode plugins.

Rules:
1. Prefer merge-safe config updates.
2. Keep runtime entry thin and predictable.
3. Validate plugin behavior with black-box checks.
4. Avoid business-specific naming in shared templates.
```

为什么这是通用资产：

- 没有绑定任何业务词汇；
- 强调的是工程行为准则；
- 可以作为任意行业插件的默认 agent 基线。

---

## 8. 示例六：Skill 模板（`src/builtin/skills/component-scaffold/SKILL.md`）

```md
---
name: component-scaffold
description: Initialize and maintain reusable component assets
---

## Principles

- This skill owns component scaffold assets.
- It supports both initialization and maintenance.
- It must perform minimal, verifiable changes.

## Initialize

Use when scaffold files do not exist.

Steps:
1. Read current repository structure.
2. Create minimum component files.
3. Add baseline docs and tests.
4. Verify files compile or parse.

## Maintain

Use when scaffold exists but drifts from current standards.

Steps:
1. Read existing files first.
2. Preserve valid structure.
3. Apply minimal incremental updates.
4. Re-run validation checks.

## Validation

1. Required files exist.
2. Naming and exports follow conventions.
3. Tests or smoke checks pass.
```

可迁移要点：

- skill 不写业务“答案”，而写“执行策略”；
- 初始化与维护必须分开描述，避免每次重写；
- Validation 是 skill 可执行性的关键。

---

## 9. 示例七：构建脚本（`package.json`）

```json
{
  "name": "your-opencode-plugin",
  "type": "module",
  "main": "dist/plugin.js",
  "scripts": {
    "build": "bun build src/index.ts --outfile dist/plugin.js --target bun --format esm && mkdir -p dist/builtin && cp -R src/builtin/agents dist/builtin/ && cp -R src/builtin/skills dist/builtin/ && cp -R src/builtin/templates dist/builtin/",
    "test": "bun test"
  }
}
```

核心提醒：

- 只编译 `ts` 代码还不够；
- `builtin/` 资产必须复制到 `dist/`；
- 交付件应该能脱离源码目录运行。

---

## 10. 示例八：单元测试（`tests/unit/config-handler.test.ts`）

```ts
import { describe, expect, it } from "bun:test"

import { applyConfigMerge } from "../../src/handlers/config-handler"

describe("applyConfigMerge", () => {
  it("appends skill path only once", async () => {
    const base = { skills: { paths: ["/x/skills"] } }

    const once = await applyConfigMerge(base, {
      builtinSkillsDir: "/x/skills",
      agentName: "general-assistant",
      agentFile: "tests/fixtures/general-assistant.md",
    })

    const twice = await applyConfigMerge(once, {
      builtinSkillsDir: "/x/skills",
      agentName: "general-assistant",
      agentFile: "tests/fixtures/general-assistant.md",
    })

    expect(twice.skills.paths).toEqual(["/x/skills"])
  })
})
```

这个测试体现的是“契约测试”：验证行为承诺，而不是绑定实现细节。

---

## 11. 示例九：黑盒 E2E（`tests/e2e/opencode-dist-load.test.ts`）

```ts
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve } from "node:path"
import { describe, expect, it } from "bun:test"

import { $ } from "bun"

describe("opencode dist load", () => {
  it("loads plugin from dist", async () => {
    const ws = await mkdtemp(resolve(tmpdir(), "opencode-e2e-"))
    const pluginPath = resolve(process.cwd(), "dist/plugin.js")

    await writeFile(
      resolve(ws, "opencode.json"),
      JSON.stringify({ plugin: [`file://${pluginPath}`] }, null, 2),
      "utf8",
    )

    const result = await $`opencode debug config`.cwd(ws).quiet()
    const json = JSON.parse(result.stdout.toString())

    expect(json.plugin).toContain(`file://${pluginPath}`)
    expect(json.skills.paths.length).toBeGreaterThan(0)
  })
})
```

这里验证的是“真实运行时确实加载了构建产物”，不是“某个函数返回了预期值”。

---

## 12. 示例十：README 可发布模板（`README.md`）

下面给的是“可发布版本”模板，不是极简占位模板。目标是让新读者不看源码也能上手。

````md
# Your OpenCode Plugin

OpenCode plugin for <your-domain>. It injects <skills/agents/tools/hooks> and keeps config merge-safe.

## What It Does / Does Not Do

### Does

- Injects `skills.paths` with plugin builtin assets.
- Registers `<agent/tool/hook>` for `<your use case>`.
- Supports both source loading and dist loading.

### Does Not

- Does not manage external service bootstrap.
- Does not overwrite user-owned config branches.

## Quick Start

### 1) Install and build

```bash
bun install
bun run test
bun run build
```

### 2) Mount plugin in `opencode.json`

Recommended (dist):

```json
{
  "plugin": [
    "file:///ABSOLUTE/PATH/TO/your-plugin/dist/plugin.js"
  ]
}
```

Local iteration (source):

```json
{
  "plugin": [
    "file:///ABSOLUTE/PATH/TO/your-plugin/src/index.ts"
  ]
}
```

## Verify Plugin Is Loaded

Run in target workspace:

```bash
opencode debug config
```

Check at least:

1. `plugin` includes your `file://.../plugin.js` (or `src/index.ts`).
2. `skills.paths` includes `.../builtin/skills`.
3. If you register agent/tool, corresponding metadata appears.

When debugging skill visibility issues, also run:

```bash
opencode debug skill --print-logs
```

If your plugin relies on `config` hook, this command can directly reveal whether skills were actually discovered.

Expected output snippet (example):

```json
{
  "plugin": ["file:///.../dist/plugin.js"],
  "skills": {
    "paths": [".../dist/builtin/skills"]
  }
}
```

## Runtime Semantics

- Config update is merge-safe, not overwrite.
- Repeated load is idempotent.
- Builtin assets are loaded from runtime-resolved `builtin` directory.
- Failures in optional hooks degrade gracefully (<customize if not true>).

## Constraints and Prerequisites

- Requires `<external CLI/service/env>` if related skills need it.
- Uses `<hooks>` only.
- Requires absolute `file://` plugin path.

## Troubleshooting

- Plugin not visible in `debug config`: check `opencode.json` path and `file://` format.
- Plugin visible but capability missing: check dist assets copied to `dist/builtin`.
- Capability visible but runtime fails: check external dependency readiness.

## Development Commands

- `bun run test`
- `bun run build`
- `bun run clean`
````

迁移时只替换业务语义（插件能力、依赖、故障项），不要删掉“Verify / Runtime Semantics / Troubleshooting”这三节。

---

## 13. 如何按业务场景替换这些示例

你只需要替换三类内容：

1. 业务语义：agent prompt、skill 说明、template 文本；
2. 工具能力：`tools/*.ts` 的输入输出与执行逻辑；
3. 运行时权限：`config` 里默认 permission 策略。

你不应替换的核心模式：

1. 入口薄层 + 工厂组装；
2. config 增量 merge + 幂等；
3. dist 复制 builtin 资产；
4. unit 契约测试 + 黑盒 E2E。

---

## 14. 一句话结论

这份示例文档提供的是“可复制的工程骨架 + 可运行代码”，你可以直接迁移到任何业务插件开发中，而不依赖当前仓库的具体业务文件。
