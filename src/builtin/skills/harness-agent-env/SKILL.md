---
name: harness-agent-env
description: Initialize and manage runtime environment for harness agent workspaces. Use this skill when setting up a new harness workspace, detecting Python/JavaScript/Shell/Go toolchains, creating environment baseline scripts (check-agent-env.sh, init-agent-env.sh), troubleshooting environment issues, or when user mentions "agent environment", "runtime setup", "environment detection", "uv", "venv", "bun", "Go toolchain", or asks to prepare development environment for agents.
---

# harness-agent-env

## 执行规则

1. **探测顺序固定**：必须按 Python → JavaScript → Shell → Go（可选）顺序探测，每步记录结果到 tmp/env.json
2. **证据留存**：每次探测必须保存命令输出和版本信息，不得基于假设跳过探测
3. **脚本幂等性**：生成的 check-agent-env.sh 和 init-agent-env.sh 必须可重复执行
4. **缺失项处理**：工具缺失时记录到 missing 数组，给出安装建议，但不阻断流程
5. **输出结构化**：所有探测结果写入 tmp/env.json，供其他技能和主 agent 复用
6. **脚本约定**：在项目 scripts/ 目录维护环境脚本，每轮对话启动时仅执行一次

## 初始化

1. 按顺序探测可用环境：
   - Python：`uv -> venv -> python`
   - JavaScript：`bun -> node`
   - Shell：`zsh -> bash`
2. 首次初始化必须写入 `tmp/env.json`，至少包含：探测顺序、命中结果、缺失项、最终建议。
3. 若命中 `uv`，初始化建议以 uv-first 为目标；若未命中，记录降级路径与恢复计划。
4. `venv_path` 由主 agent 在执行期决定并回写，不使用模板硬编码。
5. 初始化后（或用户要求重新探测后）必须建立/更新管理基线脚本：
   - `scripts/check-agent-env.sh`：只做环境校验与信息输出（可直接执行）
   - `scripts/init-agent-env.sh`：只做环境变量初始化（用于 `source`）
6. `check-agent-env.sh` 输出应与探测事实一致，至少包含：
   - 当前已命中的环境工具链摘要（可覆盖 Python/JavaScript/Shell，但不要求一次性穷尽未来所有环境）
   - 与当前命中项相关的关键路径与运行时信息（如 venv 路径、可执行路径、当前 shell）
   - 本轮建议与稳态建议（例如“当前为 uv-first，建议保持 .venv”）
7. `init-agent-env.sh` 仅放可 `source` 的导出逻辑，例如：
   - Python 相关：`UV_PROJECT_ENVIRONMENT`、`PYTHONPATH`
   - JavaScript/Node 相关：按需要导出 `PATH` 扩展、`BUN_INSTALL`、`NODE_OPTIONS`
   - Shell/通用相关：按需要导出项目级运行变量
   - 具体导出项由 agent 基于探测事实决定，禁止无依据硬编码

## Go 环境（可选探测）

### 触发条件

Go 环境探测仅在以下条件同时满足时触发：

1. 基础环境探测（Python → JavaScript → Shell）已完成
2. 主管理项目（harness workspace 管理的项目）是 Go 项目
3. scripts/ 目录已创建

判断方法：读取 harness 工作区配置或由主 agent 明确告知主管理项目语言类型。**不是**检查当前harness 工作区目录的 go.mod/go.sum，而是检查主管理项目的 go.mod/go.sum。

### Go 路径配置策略

按以下优先级获取 Go 环境路径：

1. **优先询问用户**（首次配置时）：
   - 项目使用的 Go 版本（1.20 或 1.24）
   - GOROOT 路径
   - GOPATH 路径
   - GOBIN 路径
   - Go 私有模块设置（GOPRIVATE/GONOPROXY/GONOSUMDB）
   - Go module cache 位置（GOMODCACHE）

2. **默认位置探测**（用户未提供时）：
   - Go 1.20 GOROOT: `/home/base/.gvm/gos/go1.20.14`
   - Go 1.24 GOROOT: `/home/base/.gvm/gos/go1.24.1`
   - GOPATH: `/home/base/repo/go120_mod` 或 `/home/base/repo/go124_mod`
   - GOBIN: `${GOPATH}/bin`

3. **环境变量回退**（默认位置不存在时）：
   ```bash
   go version  # 检查对应版本
   go env GOROOT GOPATH GOBIN GOMODCACHE
   ```

4. **系统无 Go 时**：进入 Go 安装流程

### Go 流程规则

1. 在初始化/维护阶段，先执行 Go 环境探查，再决定是否安装或调整
2. `scripts/check-agent-env.sh` 与 `scripts/init-agent-env.sh` 作为统一入口：
   - 前者负责汇总并输出 Go 环境状态
   - 后者负责 `source` Go 相关环境变量
   - 二者可调取 reference 脚本，不重复实现同类逻辑
3. 对于 reference 中已提供的脚本（switch/install），按其语义调用：
   - `switch_*` 必须 `source`
   - `install_*` 使用 `bash`
4. 若未发现可用 Go 环境，则进入 Go 环境安装流程；若已存在 Go，则按版本选择对应工具安装脚本
5. 安装/调整动作仅在初始化或维护阶段触发；日常会话启动只运行两条统一脚本做校验、输出与变量注入，不重复安装

### Reference 文档

Go 环境脚本和详细说明位于：`reference/dedge-dev-env/GO_ENV_REFERENCE.md`
- 该文档提供 Go 1.20/1.24 环境切换脚本的使用说明
- 仅在 Go 项目初始化时读取此文档
- 非 Go 项目不进入 Go 环境准备流程，只保留基础环境检查

## 管理

### 脚本维护目标

本技能的核心目标是生成并维护两个脚本：

1. **scripts/check-agent-env.sh**：环境校验与信息输出（可直接执行）
2. **scripts/init-agent-env.sh**：环境变量初始化（用于 `source`）

这两个脚本使得 agent 在每轮对话启动时无需重新加载本技能，仅通过执行脚本即可完成环境确认与初始化。

### 脚本内容要求

**check-agent-env.sh** 必须输出：
- 当前已命中的环境工具链摘要（Python/JavaScript/Shell，Go 项目时包含 Go）
- 关键路径与运行时信息（如 venv 路径、可执行路径、当前 shell）
- 本轮建议与稳态建议（例如"当前为 uv-first，建议保持 .venv"）
- Go 项目时：Go 版本、GOROOT/GOPATH/GOBIN、路径来源（用户提供/默认/go env）、工具链安装状态

**init-agent-env.sh** 仅放可 `source` 的导出逻辑：
- Python 相关：`UV_PROJECT_ENVIRONMENT`、`PYTHONPATH`
- JavaScript/Node 相关：按需导出 `PATH` 扩展、`BUN_INSTALL`、`NODE_OPTIONS`
- Go 相关（Go 项目时）：`GOROOT`、`GOPATH`、`GOBIN`、`GOPRIVATE`、`GOMODCACHE` 等
- 具体导出项由 agent 基于探测事实决定，禁止无依据硬编码

### 增量维护

1. 环境变化（新增工具、版本迁移、路径变更）需更新 `tmp/env.json` 和两个脚本
2. 持续推动稳态：优先收敛到 `uv + .venv`、`bun`、`bash/zsh` 的可维护组合
3. 当环境现状与既有规范冲突时，先报告差异，再给出最小影响修复建议
4. 每次重检后同步更新脚本，保证脚本输出与当前事实一致

### AGENTS.md 集成

在 AGENTS.md 的 Python Environment 章节添加固定段落（参考 AGENTS.template.md）：

```markdown
### 会话启动一次性环境校验（每轮对话一次）

每轮对话启动时，仅执行一次以下步骤：

1. 执行环境校验脚本：`bash scripts/check-agent-env.sh`
2. 加载环境变量：`source scripts/init-agent-env.sh`

若脚本不存在或执行失败，使用 harness-agent-env 技能管理。
```

此段落使得后续对话无需重新加载本技能，直接通过脚本完成环境初始化。

## 输出格式

tmp/env.json 完整示例：

```json
{
  "python": {
    "order": ["uv", "venv", "python"],
    "selected": "uv",
    "missing": [],
    "venv_path": "/path/to/project/.venv",
    "version": "3.11.0",
    "uv_version": "0.1.0"
  },
  "js": {
    "order": ["bun", "node"],
    "selected": "bun",
    "missing": [],
    "version": "1.0.0",
    "path": "/usr/local/bin/bun"
  },
  "shell": {
    "order": ["zsh", "bash"],
    "selected": "bash",
    "missing": ["zsh"],
    "current": "/bin/bash",
    "version": "5.1.16"
  },
  "go": {
    "detected": true,
    "version": "1.24.1",
    "goroot": "/home/base/.gvm/gos/go1.24.1",
    "gopath": "/home/base/repo/go124_mod",
    "gobin": "/home/base/repo/go124_mod/bin",
    "goprivate": "gitlab-c7n.lgdxtech.com",
    "gomodcache": "/home/base/repo/go124_mod/pkg/mod",
    "source": "user_provided"
  },
  "scripts": {
    "check": "scripts/check-agent-env.sh",
    "init": "scripts/init-agent-env.sh"
  },
  "phase": "bootstrap",
  "final_recommendation": "uv + .venv, bun, bash, Go 1.24",
  "timestamp": "2026-04-01T08:40:07.982Z"
}
```

字段说明：
- `source` 可选值：`user_provided`（用户提供）、`default`（默认位置）、`go_env`（环境变量）、`installed`（新安装）
- Go 部分仅在 Go 项目时出现
- `venv_path` 由主 agent 在执行期决定并回写
