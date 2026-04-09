---
name: harness-git-worktree
description: Initialize and manage main git project, submodule topology, and .worktrees lifecycle in harness workspace.
---

# harness-git-worktree

## 守则

- 该技能负责“主管理项目”接入与后续 git/worktree 管理，覆盖初始化与持续治理。
- 所有潜在破坏性操作（删除、重置、覆盖）必须二次确认。
- 任何用户未明确的仓库策略（远端、分支、子模块关系）不得由技能自行猜测定稿。
- 本技能关注的是主管理项目 git 库及其 `.worktrees/` 机制，不替代 `harness-docs` 与 `harness-agent-env` 的职责。

## 远端 remote 强制校验（前置 + 后置）

该校验是初始化和管理都必须执行的固定步骤：

1. **前置校验（执行配置前）**
   - 先获取用户指定的远端目标（至少包含远端名与 URL；如未给出，先提问补齐）。
   - 校验主管理项目当前 remote 事实：`git remote -v`。
   - 若发现 remote 指向本地仓库路径（如 `../repo`、`/home/...`、`file://...`），判定为不合规。

2. **后置校验（执行配置后）**
   - 再次读取 `git remote -v`，确认最终配置与用户说明一致。
   - 必须确认“主管理项目 remote 指向远端仓库地址”，而不是内联本地项目。
   - 若不一致，先修正 remote，再结束流程。

3. **判定标准（强制）**
   - 合规：远端 URL 为可协作的远端仓库地址（如 `https://...` 或 `git@...`）。
   - 不合规：本地路径型 remote（相对路径、绝对路径、`file://`）。
   - 当用户明确要求本地路径 remote 且与既定协作规则冲突时，需先提示风险并二次确认。

## 初始化

1. 接收并校验主管理项目路径，确认其在当前 harness workspace 可管理范围内。
2. 先执行“远端 remote 前置校验”：确认用户指定远端信息已明确，且当前 remote 事实可审计。
3. 若目标目录不是 git 仓库：
   - 初始化 git
   - 生成基础 `.gitignore`
   - 完成首次提交
4. 建立 `.worktrees/` 并确保其被 ignore，作为多分支并行开发区。
5. 建立/校验 submodule 管理关系，保证 harness 工作区与主管理项目边界清晰。
6. 按用户说明配置主远端/附加远端，必要时补齐 upstream 关系。
7. 写入 `.tmp/repo.json`（记录主管理项目路径、remote 名称、remote URL、默认分支、worktree 根路径）。
8. 执行“远端 remote 后置校验”：确认 remote 已为远端地址且与用户要求一致。

## 管理

1. 管理动作前，先做“远端 remote 前置校验”：
   - remote 是否仍与用户约定一致
   - 是否出现本地路径型 remote 漂移
2. 维护 `.worktrees/` 生命周期：新建、回收、重命名策略需可追踪。
3. 维护主库与子库关系，确保结构变更后仍满足协作边界。
4. 定期复核 ignore、远端配置、分支约定，避免管理漂移。
5. 当用户请求新增子项目或拆分仓库时，先给出 topology 影响说明再执行。
6. 管理动作后，执行“远端 remote 后置校验”，校验失败则继续收敛，直至合规。

## 校验说明（强制）

每次初始化或管理完成后，至少输出一次以下校验结论（满足/不满足 + 原因）：

1. 主管理项目路径是否明确、可访问、且与 Harness 工作区边界清晰。
2. `.worktrees/` 是否存在且仅承担主管理项目并行开发落点。
3. `git remote -v` 是否与用户说明一致（remote 名称、URL、用途）。
4. remote URL 是否为远端仓库地址，未出现本地路径型 remote。
5. 若不满足，是否已给出修复动作与剩余待办。

## 输入与输出

- 输入（初始化）：用户提供的主管理项目路径、远端偏好（remote 名称/URL/默认分支）、现有仓库事实。
- 输入（管理）：主管理项目现状（`git remote -v`、分支、worktree、submodule）、用户新增约束。
- 输出：主管理项目 git/worktree 配置事实 + `.tmp/repo.json`（若处于初始化或需要刷新状态）。

## 安全规则

- 默认采用最小变更原则，不对未知仓库状态做强制修复。
- 遇到门禁冲突、事实不一致、或用户说明不完整时，立即回到提问阶段。
- 未经用户确认，不做 destructive git 操作（如硬重置、强推、批量删除 worktree）。
