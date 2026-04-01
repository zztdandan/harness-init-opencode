---
name: harness-git-worktree
description: Initialize and manage main git project, submodule topology, and .worktrees lifecycle in harness workspace.
---

# harness-git-worktree

## 守则

- 该技能负责主管理项目接入与后续 git/worktree 管理，贯穿初始化与日常维护。
- Gate B 为硬门禁：未明确主管理项目目录前，不得执行仓库改造动作。
- 所有潜在破坏性操作（删除、重置、覆盖）必须二次确认。
- 任何用户未明确的仓库策略（远端、分支、子模块关系）不得由技能自行猜测定稿。

## 初始化

1. 接收并校验主管理项目路径，确认其在当前 harness workspace 可管理范围内。
2. 若目标目录不是 git 仓库：
   - 初始化 git
   - 生成基础 `.gitignore`
   - 完成首次提交
3. 建立 `.worktrees/` 并确保其被 ignore，作为多分支并行开发区。
4. 建立/校验 submodule 管理关系，保证 harness 工作区与主管理项目边界清晰。
5. 采集远端偏好（主远端/附加远端）并写入 `tmp/repo.json`。

## 管理

1. 维护 `.worktrees/` 生命周期：新建、回收、重命名策略需可追踪。
2. 维护主库与子库关系，确保结构变更后仍满足协作边界。
3. 定期复核 ignore、远端配置、分支约定，避免管理漂移。
4. 当用户请求新增子项目或拆分仓库时，优先给出 topology 影响说明再执行。

## 安全规则

- 默认采用最小变更原则，不对未知仓库状态做强制修复。
- 遇到门禁冲突或事实不一致时，立即回退到提问阶段。
