# Claude 插件加载指南

本项目支持两种编译方式：
- **OpenCode 插件**：编译到 `dist/`，通过 `opencode.json` 加载
- **Claude 插件**：编译到 `dist-claude/`，通过 Claude 插件系统加载

## 构建 Claude 插件

```bash
bun run build:claude
```

构建产物位于 `dist-claude/` 目录。

## 加载到 Claude

### 方式 1：符号链接（推荐开发使用）

```bash
ln -s /home/base/repo/dedge/dedge-harness-init-guide/dist-claude ~/.claude/skills/harness-init-plugin
```

### 方式 2：复制到 Claude 插件目录

```bash
cp -r dist-claude ~/.claude/plugins/cache/dedge/harness-init/latest
```

然后在 `~/.claude/settings.json` 中启用插件：

```json
{
  "enabledPlugins": {
    "harness-init@dedge": true
  }
}
```

## 插件结构

```
dist-claude/
├── .claude-plugin/
│   └── marketplace.json          # 插件元数据
└── skills/
    ├── harness-init/             # 主 agent（作为 skill）
    ├── harness-agent-env/        # 环境初始化与管理
    ├── harness-git-worktree/     # 仓库与 worktree 管理
    └── harness-docs/             # 文档治理
```

## 使用方式

在 Claude 对话中调用：

```
/harness-init
```

或直接描述需求：

```
帮我初始化一个 harness 工作区
```

Claude 会自动识别并调用 `harness-init` skill。

## 验证插件加载

检查 Claude 是否成功加载插件：

```bash
# 查看已加载的 skills
ls ~/.claude/skills/
```

应该能看到 `harness-init-plugin` 目录。

## 与 OpenCode 插件的区别

| 特性 | OpenCode 插件 | Claude 插件 |
|------|--------------|-------------|
| 加载方式 | config hook 动态注入 | marketplace.json 声明式 |
| Agent 支持 | 通过 config 注入 | 作为 skill 包装 |
| 构建命令 | `bun run build` | `bun run build:claude` |
| 输出目录 | `dist/` | `dist-claude/` |
| 配置文件 | `opencode.json` | `~/.claude/settings.json` |

## 开发建议

- 源码修改后需要重新运行 `bun run build:claude`
- 使用符号链接可以避免每次都复制文件
- Skills 的 YAML frontmatter（name + description）是必需的
