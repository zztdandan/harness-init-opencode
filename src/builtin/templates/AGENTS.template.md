# AGENTS Handbook ({workspace_name})

> Purpose: this file is the persistent bootstrap context for OpenCode in this repo.
> 说明：这是写作提示模板，不是渲染脚本。最终 `AGENTS.md` 由 agent 根据当时环境与用户决策直接编写。

**MUSTDO** 编写代码时必须保留足够注释以支持 review，可补充但不得删除有价值注释。

## 1) Project Tree & Task Status (authoritative)

状态标记：`✅ 已完成` / `🟡 进行中` / `⚪ 未开始` / `🚧 阻塞` / `📌 参考`

```text
{project_tree}
```

## 2) Git Topology & Collaboration Rules (must follow)

### 2.1 Superproject

{superproject_notes}

### 2.2 Submodules

{submodule_notes}

### 2.3 Worktree 策略

统一采用 `.worktrees/` 组织临时开发工作区。

```text
{workspace_root}/
├── {main_project}/
└── .worktrees/
    ├── {feature_a}/
    └── {feature_b}/
```

**各库能力分配与修改模式**：

| 工作区 | 路径 | 用途 | 修改策略 |
|--------|------|------|----------|
| **主库** | `{main_project}/` | 日常功能迭代 | ✅ 主要开发库，所有稳定功能在此提交 |
| **实验区** | `.worktrees/acp-impl/` | 临时特性开发与实验性改动 | ✅ 新特性验证、排畸测试、实验性代码 |
| **临时库** | `.worktrees/<feature-xxx>/` | 特定功能开发 | ✅ 基于 main 新建 worktree，完成后可删除 |

**工作流规则**：

1. **主库开发**：`{main_project}/` 目录作为主要开发库，日常功能在此迭代
2. **实验在 worktree**：新特性验证、排畸测试、实验性改动在 `.worktrees/acp-impl/` 中进行
3. **稳定后合并**：实验区验证通过后，合并到主库 main 分支
4. **排畸验证**：对上游仓库的兼容性测试在 worktree 中进行
5. **贡献流程**：
   - 修复上游问题 -> 在 `.worktrees/` 下基于上游同步分支新建临时 worktree
   - 完成修复 -> 提交到个人 fork -> 发起 PR 到上游
   - 合并后删除临时 worktree
6. **🚨 Worktree 摘出范围（强制）**：后续任何 worktree 摘出/导出操作，仅允许摘出工程子项目路径；禁止摘出整个超级项目，避免把文档、部署子库与其他子模块误带出。

## 3) Python Environment & Tooling

### 3.0 Bootstrap phase vs steady state

- Bootstrap：允许按探测链路降级并记录事实（`uv -> venv -> python`）
- Steady state：确认 `uv` 与 `.venv` 后，统一执行 uv-first 规范

### 3.1 统一虚拟环境

统一虚拟环境路径不是模板固定值，**由 agent 根据探测结果决定**，并写入最终 AGENTS.md。

建议规则：

1. 若选择 `uv`：
   - 每个 session 开始时设置 `UV_PROJECT_ENVIRONMENT=.venv`
   - 依赖管理使用 `uv sync` / `uv add`
2. 若降级为 Python venv：
   - 使用 `python -m venv .venv`
   - 会话内执行 `source .venv/bin/activate`

最终稳态以 uv-first 为目标，venv/pure python 仅作为 bootstrap 兼容路径。

### 3.2 会话启动一次性环境校验（每轮对话一次）

每轮对话启动时，仅执行一次以下步骤：

1. 执行环境校验脚本（输出当前事实）：
   - `bash scripts/check-agent-env.sh`
2. 若存在环境变量初始化脚本，则在当前 shell 中加载：
   - `source scripts/init-agent-env.sh`

约束：

- `check-agent-env.sh` 负责输出，不承担 `source` 语义。
- `init-agent-env.sh` 负责导出环境变量，不承担探测说明输出。
- 脚本内容必须与最新环境探测结果一致（如 `uv` 命中、venv 路径、`PYTHONPATH` 约定）。
- 若主管理项目为 Go 项目，可在该段落追加 Go 环境说明（版本、GOROOT/GOPATH/GOBIN 来源、工具链安装状态）。

## 4) Debug & E2E

{debug_notes}

## 5) README Maintenance

根目录 `README.md` 作为项目手册，必须维护以下内容：

### 5.1 必备章节

```markdown
# {workspace_name}

## Environment Setup
- Python/uv 安装指南
- 虚拟环境配置（.venv）
- 依赖安装命令

## Development Workflow
- Worktree 开发模式说明
- 主库 vs 开发库 vs 临时库
- Git 操作流程

## Debug & Run
- VS Code 调试配置使用
- E2E 测试运行方法
- 常见问题排查

## Project Structure
- 目录结构说明
- 子库关系图
```

### 5.2 更新触发条件

以下情况必须同步更新 `README.md`：

1. 环境变量或配置变更
2. 依赖包版本升级（特别是 breaking changes）
3. 调试配置调整（`launch.json` 修改）
4. Worktree 结构变化
5. 运行命令或参数变更

## 6) Implementation Boundaries

{boundary_notes}

## 7) AGENTS.md Auto-Update Mechanism

每次完成 doc-driven 或 issue-driven 变更（且由用户提交）时，必须在 Project Tree & Task Status（Section 1）更新状态。

### 7.1 Mandatory update actions

1. 更新 Section 1 的树状状态（完成/进行中/未开始/阻塞/参考）
2. 新增设计文档或 issue 文档时，补到 Section 1 树里
3. 对每个 issue，在 Section 1 对应节点下维护一句话状态：
   - 已解决：`✅ 已解决：...`
   - 未解决：`⚠ 未解决：...`
4. 不再维护独立 Open Items 与 Change Log，统一以 Section 1 为唯一状态源

### 7.2 Definition of done

仅当满足以下条件才可标记 `✅`：

- 代码/文档已落地到工作区
- 相关验证命令已执行
- Section 1 的对应节点状态与一句话说明已更新
