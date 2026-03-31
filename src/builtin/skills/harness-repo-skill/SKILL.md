---
name: harness-repo-skill
description: Setup main project integration and repository topology, output structured workspace for agent handoff.
---

# harness-repo-skill

## 目标

完成主项目接入与仓库拓扑整理，输出可交接给其他 agent 的结构化 workspace。

## 强制门禁

- Gate B：在任何仓库改造前，必须明确主管理项目目录。
- 用户未明确时，回到提问，禁止执行后续步骤。

## 处理原则

1. 输入来源不限（clone、本地目录、挂载、下载等），统一归一为“当前 workspace 内的目录”。
2. 如果该目录不是 git 仓库：
   - 初始化 git
   - 生成基础 `.gitignore`
   - 完成第一次提交
3. 建立 `.worktrees/`，并写入 ignore。
4. 建立并维护 submodule 管理关系。
5. 采集远端偏好（主远端/附加远端）并写入 `tmp/repo.json`。

## 安全规则

- 破坏性操作必须二次确认。
- 不因猜测替代用户决策。
