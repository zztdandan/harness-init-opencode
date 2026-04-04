# OpenCode 综合插件指南（Tool + Skill + Agent + Subagent）

日期：2026-03-26  
更新：2026-03-27

## 1. 这份文档解决什么问题

这是一份可复用到其他项目的实施指南，目标是：

1. 使用者只在 `opencode.json` 配置一条 `plugin` 路径。
2. 插件在运行时自动注入并启用 `tool + skill + agent + subagent`。
3. 支持两种交付方式：
   - 编译包加载（推荐，适合团队和稳定交付）
   - 源码级加载（开发调试快）

---

## 2. 先回答关键问题：必须编译吗？

不必须。**编译与否都可以做到运行时注入**。

- `oh-my-openagent`：通常走编译产物 `dist/harness_init.js`。
- `superpowers`：可以直接加载源码插件文件并在 `config` hook 注入。

决定因素不是“编译不编译”，而是这两点：

1. OpenCode 能否成功加载你的插件入口（源码或编译产物）。
2. 你的 `config` hook 是否在运行时把 skills/agents/permissions 注入配置对象。

推荐原则：

- 给他人复用：优先编译包。
- 自己开发联调：可先源码加载，稳定后再编译。

---

## 3. 总体架构（一次性加载，运行时注入）

使用者的 `opencode.json` 只保留：

```json
{
  "plugin": [
    "file:///ABSOLUTE/PATH/TO/your-plugin/dist/harness_init.js"
  ]
}
```

其余能力由插件内部完成：

1. `tool` hook：注册 `memory_remember/memory_search/memory_forget`。
2. `config` hook：注入 `skills.paths`、`agent`、`permission`。
3. （可选）插件内部加载 builtin skill/agent 资源。

注意：运行时注入不写回磁盘，因此 `opencode.json` 看不到 `skills.paths` 是正常现象。

---

## 4. 每个部分应该怎么写

## 4.1 Tool（能力）

最小建议：3 个工具。

- `memory_remember`：写入长期记忆。
- `memory_search`：关键词检索。
- `memory_forget`：按 id 删除。

写法要求：

1. 参数 schema 明确（content/tags/limit/id）。
2. 工具内部自行处理权限请求（read/edit）。
3. 返回值简洁，metadata 尽量结构化。
4. 幂等和去重逻辑放在工具或调用策略里。

## 4.2 Skill（策略）

skill 负责“如何正确使用工具”，建议内置一个 `memory-playbook`。

必须包含：

1. 先检索再写入。
2. 只保存稳定事实（决策、约束、长期偏好）。
3. 拒绝保存 secrets。

## 4.3 Subagent（专职执行）

建议 `memory-operator` 只开 memory 相关工具和 `skill`。

约束建议：

- 关闭 `bash/write/edit`。
- 允许 `memory_*`。
- 非 trivial 操作先加载 `memory-playbook`。

## 4.4 主 Agent（编排）

建议主 agent（如 `build`）做两件事：

1. 编码任务自己做。
2. 记忆任务委派 `memory-operator`（通过 `task`）。

这样能保持上下文干净，并保证记忆治理一致。

---

## 5. 目录组织建议

## 5.1 推荐结构

```text
your-plugin/
  src/
    index.ts
    handlers/
      config-handler.ts
    tools/
      memory-remember.ts
      memory-search.ts
      memory-forget.ts
    builtin/
      skills/
        memory-playbook/SKILL.md
      agents/
        build.md
        memory-operator.md
  dist/
    harness_init.js
  package.json
  tsconfig.json
```

说明：

- `src/index.ts`：插件单入口默认导出。
- `handlers/config-handler.ts`：运行时注入 skills/agents/permissions。
- `src/builtin/*`：内置模板内容（由插件注入，不要求用户手工放置）。

---

## 6. 运行时注入参考（核心）

下面这段是“one-line plugin install”的关键：

```ts
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const builtinSkillsDir = path.resolve(__dirname, "../skills")

export function createConfigHandler() {
  return async (inputConfig: any) => {
    const next = structuredClone(inputConfig ?? {})

    // 1) runtime inject skills path
    const paths = Array.isArray(next.skills?.paths) ? next.skills.paths : []
    if (!paths.includes(builtinSkillsDir)) {
      next.skills = next.skills ?? {}
      next.skills.paths = [...paths, builtinSkillsDir]
    }

    // 2) runtime inject agents
    next.agent = {
      ...(next.agent ?? {}),
      build: { description: "Primary execution agent with memory delegation", mode: "primary" },
      "memory-operator": { description: "Handles long-term project memory operations", mode: "subagent" },
    }

    // 3) runtime inject permissions
    next.permission = {
      ...(next.permission ?? {}),
      skill: { ...(next.permission?.skill ?? {}), "memory-playbook": "allow" },
      task: { ...(next.permission?.task ?? {}), "memory-operator": "allow" },
    }

    return next
  }
}
```

实现要求：

1. 幂等注入（避免重复追加）。
2. merge 而非覆盖用户原配置。
3. 路径基于插件文件位置计算，避免硬编码绝对路径。

---

## 7. 编译包方案（推荐）

适用：给其他项目长期复用。

`package.json` 示例：

```json
{
  "name": "private-memory-plugin",
  "private": true,
  "type": "module",
  "main": "dist/harness_init.js",
  "scripts": {
    "build": "bun build src/index.ts --outdir dist --target bun --format esm",
    "typecheck": "tsc --noEmit"
  }
}
```

构建：

```bash
bun install
bun run build
```

使用方配置：

```json
{
  "plugin": [
    "file:///ABSOLUTE/PATH/TO/your-plugin/dist/harness_init.js"
  ]
}
```

---

## 8. 源码级加载方案（开发联调）

适用：你自己快速迭代，边改边测。

使用方配置：

```json
{
  "plugin": [
    "file:///ABSOLUTE/PATH/TO/your-plugin/src/index.ts"
  ]
}
```

说明：

1. 能否直接加载 TS 取决于当前 OpenCode 运行环境与加载器能力。
2. 如果环境对 TS 直载不稳定，改回编译包 `dist/harness_init.js`。
3. 源码加载同样可以运行时注入，不影响“一次性加载”机制。

---

## 9. 全局与项目两种接入

## 9.1 全局

文件：`~/.config/opencode/opencode.json`

```json
{
  "plugin": [
    "file:///ABSOLUTE/PATH/TO/your-plugin/dist/harness_init.js"
  ]
}
```

## 9.2 项目级

文件：`<project>/opencode.json`

```json
{
  "plugin": [
    "file:///ABSOLUTE/PATH/TO/your-plugin/dist/harness_init.js"
  ]
}
```

停用方式：

1. 注释或删除对应 `plugin` 条目。
2. 需要彻底移除时删除插件目录。

---

## 10. 验收清单

1. 只配一条 `plugin` 后，能看到 `memory_*` tools。
2. 不额外配置 `skills.paths` 也能加载 `memory-playbook`。
3. 主 agent 能委派 subagent。
4. `opencode.json` 不会被插件改写。
5. 注释/删除 `plugin` 条目后能力消失。

---

## 11. 常见坑位

1. 误以为必须写回 `opencode.json` 才算生效。
2. 注入逻辑覆盖了用户原有 `agent/permission` 配置。
3. 没做幂等，导致 `skills.paths` 重复追加。
4. 编译后路径变化，`builtinSkillsDir` 指向失效。
5. 改完源码后没有重启会话，仍在旧实例。

---

## 12. 给其他项目复用时的最小模板

你至少要提供：

1. 单入口插件：`src/index.ts`（默认导出）
2. 三个 tools：`remember/search/forget`
3. 一个 skill：`memory-playbook`
4. 两个 agent：`build` + `memory-operator`
5. 一个 `config` hook：负责运行时注入 + 幂等 merge
6. 一份接入说明：只配 `plugin` 路径，其他自动注入

到这里，就能稳定实现“源码或编译包都可加载；一次配置，运行时全能力生效”。
