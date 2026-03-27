# dedge-harness-init-guide

一个标准 OpenCode 插件项目：注入 `agent + skills`，提供 harness 初始化主 agent，用于从 0 构建可交接的 agent 工作区。

## What this plugin does

- 运行时注入主 agent（`harness-init`），不改写用户 `opencode.json`
- 注入内置 skills（环境探测、仓库组织、AGENTS.md 编写）
- 默认不抢占用户常规会话（仅注册，不设默认 agent）
- 支持源码加载与 dist 加载两种接入方式

## Plugin capabilities

- **Gate A**：当前目录已是 git 根仓库时，强制征求用户处理方案
- **Gate B**：必须明确主管理项目目录才能继续
- 非门禁步骤使用默认推荐，减少无效交互
- 统一 `.worktrees/` 策略与文档骨架

## Quick start

### 1) 安装依赖

```bash
bun install
```

### 2) 构建插件（用于 dist 加载）

```bash
bun run build
```

### 3) 在 OpenCode 配置插件路径

`opencode.json` 示例：

```json
{
  "plugin": [
    "file:///ABSOLUTE/PATH/TO/dedge-harness-init-guide/dist/index.js"
  ]
}
```

## Loading modes

- **源码加载（开发联调）**

```json
{
  "plugin": [
    "file:///ABSOLUTE/PATH/TO/dedge-harness-init-guide/src/index.ts"
  ]
}
```

- **dist 加载（稳定交付）**

```json
{
  "plugin": [
    "file:///ABSOLUTE/PATH/TO/dedge-harness-init-guide/dist/index.js"
  ]
}
```

## Project layout

- `src/index.ts`：插件入口（默认导出插件对象）
- `src/handlers/config-handler.ts`：运行时注入与幂等 merge
- `src/builtin/agents/harness-init.md`：主编排 agent 提示词
- `src/builtin/skills/*`：内置技能文档
- `src/builtin/templates/AGENTS.template.md`：AGENTS 写作模板（提示模板，不是渲染脚本）
- `tests/*`：行为与内容约束测试

## Development commands

- `bun test`：运行测试
- `bun run typecheck`：TypeScript 类型检查
- `bun run build`：构建插件并打包内置资源

## Notes

- 本项目不注入自定义 tool，聚焦 `agent + skills` 注入
- `AGENTS.md` 最终由 agent 按现场信息编写，不依赖模板渲染脚本
