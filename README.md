# dedge-harness-init-guide

一个双平台插件项目：支持 **OpenCode** 和 **Claude** 两种加载方式，注入 `agent + skills`，提供 harness 初始化主 agent，用于从 0 构建可交接的 agent 工作区。

## What this plugin does

- 运行时注入主 agent（`harness-init`），不改写用户配置
- 注入内置 skills（环境探测、仓库组织、AGENTS.md 编写）
- 默认不抢占用户常规会话（仅注册，不设默认 agent）
- **双平台支持**：
  - OpenCode: 通过 config hook 动态注入
  - Claude: 通过 marketplace.json 声明式加载

## Plugin capabilities

- **Gate A**：当前目录已是 git 根仓库时，强制征求用户处理方案
- **Gate B**：必须明确主管理项目目录才能继续
- 非门禁步骤使用默认推荐，减少无效交互
- 统一 `.worktrees/` 策略与文档骨架

## Quick start

### OpenCode 插件

#### 1) 安装依赖

```bash
bun install
```

#### 2) 构建插件

```bash
bun run build
```

#### 3) 在 OpenCode 配置插件路径

`opencode.json` 示例：

```json
{
  "plugin": [
    "file:///ABSOLUTE/PATH/TO/dedge-harness-init-guide/dist/harness_init.js"
  ]
}
```

### Claude 插件

#### 1) 构建 Claude 插件

```bash
bun run build:claude
```

#### 2) 链接到 Claude

```bash
ln -s $(pwd)/dist-claude ~/.claude/skills/harness-init-plugin
```

#### 3) 使用

在 Claude 对话中调用：
```
/harness-init
```

详细说明见 [CLAUDE_PLUGIN.md](./CLAUDE_PLUGIN.md)

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
    "file:///ABSOLUTE/PATH/TO/dedge-harness-init-guide/dist/harness_init.js"
  ]
}
```

## 挂载成功自检（推荐）

以下自检步骤只读，不会初始化目录。

### 1) 看解析后的配置是否包含本插件

```bash
opencode debug config
```

重点检查：

- `plugin` 数组里包含 `file:///.../dedge-harness-init-guide/dist/harness_init.js`
- `agent.harness-init` 已注入
- `skills.paths` 包含 `.../dist/builtin/skills`
- `permission.skill` 包含：`harness-agent-env`、`harness-git-worktree`、`harness-docs`

### 2) 看启动日志是否实际加载插件

```bash
opencode debug config --print-logs --log-level DEBUG
```

重点检查日志中是否出现：

- `service=plugin path=file:///.../dedge-harness-init-guide/dist/harness_init.js loading plugin`

出现该行通常可判定插件已被 runtime 成功加载。

### 3) 快速查看注入 agent 详情

```bash
opencode debug agent harness-init
```

若能看到 `prompt` 指向 `.../dist/builtin/agents/harness-init.md`，说明 agent 注入生效。

### 4) 安全提示

- `opencode debug config` 输出可能包含 provider 的 `apiKey`，请勿将完整输出直接贴到公开渠道。

## 已知问题：sourceinstall 版本的 `@opencode-ai/plugin` 依赖告警

在某些 sourceinstall 版本下，可能看到类似日志：

- `No version matching "0.0.0-sourceinstall-..." found for specifier "@opencode-ai/plugin"`

这通常是 OpenCode 在安装 `.opencode/package.json` 依赖时，将 `@opencode-ai/plugin` 锁到当前二进制版本号（例如 `0.0.0-sourceinstall-*`），而该版本并未发布到 npm registry 导致。

影响评估：

- 该告警默认是 `warn`，不阻断 file URL 插件加载。
- 若你的 `debug config` 结果已包含本插件注入项（见上文自检项），可判定挂载仍然成功。

建议修复（OpenCode 侧）：

- 对 `0.0.0-*` 或 preview/sourceinstall 构建，安装 `@opencode-ai/plugin` 时使用 `*`/`latest`，不要使用不可发布的精确版本号。

## Project layout

- `src/index.ts`：插件入口（默认导出插件对象）
- `src/handlers/config-handler.ts`：运行时注入与幂等 merge
- `src/builtin/agents/harness-init.md`：主编排 agent 提示词
- `src/builtin/skills/*`：内置技能文档
- `src/builtin/templates/AGENTS.template.md`：AGENTS 写作模板（提示模板，不是渲染脚本）
- `tests/opencode/unit/*`：单元与内容约束测试
- `tests/opencode/e2e/*`：OpenCode CLI 黑盒测试（dist 挂载）
- `tests/claude/e2e/*`：为后续 Claude E2E 预留

## Development commands

- `bun test`：运行测试
- `bun run typecheck`：TypeScript 类型检查
- `bun run build`：构建插件并打包内置资源

### 运行 OpenCode dist E2E

必需环境变量：

- `OPENCODE_CLI`：固定版本的 opencode 可执行路径（建议在 CI 显式配置）

可选环境变量：

- `E2E_ALLOW_CLI_FALLBACK=1`：允许在未设置 `OPENCODE_CLI` 时回退到 `opencode`
- `E2E_KEEP_WORKSPACE=1`：失败或成功后保留 `tests/opencode/e2e/workspaces/<case-id>` 现场

示例：

```bash
OPENCODE_CLI=/ABSOLUTE/PATH/TO/opencode bun test tests/opencode/e2e/opencode-dist-load.test.ts --timeout 180000
```

## Notes

- 本项目不注入自定义 tool，聚焦 `agent + skills` 注入
- `AGENTS.md` 最终由 agent 按现场信息编写，不依赖模板渲染脚本
