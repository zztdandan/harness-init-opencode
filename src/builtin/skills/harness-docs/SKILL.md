---
name: harness-docs
description: Initialize and manage AGENTS.md and harness documentation system with governance, update triggers, and lifecycle maintenance.
---

# harness-docs

## 守则

- 文档系统必须同时支撑初始化交付与长期管理，不只生成一次性文件。
- `AGENTS.md` 是可执行约束文档，内容需可审查、可追溯、可持续更新。
- 文档更新遵循事实优先：仅根据环境、仓库与流程的真实状态写入。
- 输出中必须显式记录门禁结论与关键结构决策。

## 初始化

1. 输入文件按兼容链路探测并读取：
   - `doc-input`：读取 `.tmp/doc-input.json`
   - 模板：优先 `src/builtin/templates/AGENTS.template.md`，不存在则回退 `dist/builtin/templates/AGENTS.template.md`
   - 若两条模板路径均不存在，不中断流程：按本技能约束 + 模板既定章节结构直接生成，并在输出中记录“模板文件缺失，使用结构化回退”。
2. 生成根目录 `AGENTS.md`，并严格遵循模板章节结构与标题命名（含编号与括号说明）。
3. Git 拓扑相关内容必须写在同一个大章 `## 2) Git Topology & Collaboration Rules (must follow)` 下，至少包含：
   - `### 2.1 Superproject`
   - `### 2.2 Submodules`
   - `### 2.3 Worktree 策略`
4. `### 2.3 Worktree 策略` 中必须完整保留以下关键块，不得省略：
   - `各库能力分配与修改模式` 表格
   - `工作流规则` 1~6 条
   - `🚨 Worktree 摘出范围（强制）` 规则
5. 环境章节不再在 `harness-docs` 内重复定义探测细节；环境探测与脚本内容由 `harness-agent-env` 统一负责。
6. `AGENTS.md` 仅保留会话启动的 env 入口说明：
   - `bash scripts/check-agent-env.sh`
   - `script/shell_source.sh` + `script/shell_env.json` 仅声明为 bash 前置影响资产（不在 AGENTS.md 维护显式执行步骤）
   其余 Python/JS/Shell/Go 探测细则以 `harness-agent-env` 的最新事实为准。
7. 强制包含 MUSTDO 区块，且至少包含：
   - 代码注释需可 review、可读
   - 已有有价值注释不得随意删除
8. 必须包含 `Project Tree & Task Status` 章节，并作为权威状态源维护。
9. 初始化输出必须写入 Gate A/Gate B 决策摘要、环境链路推荐与结构说明。
10. 若模板与历史生成结果冲突，优先执行模板；遇到历史遗留章节（如拆分成两个独立 git 章节、重复环境说明）时，按模板合并并清理重复段落。

## 管理

1. 管理阶段（初始化完成后）不再依赖 `.tmp/`；默认读取并增量维护根目录现有成品：`AGENTS.md`。
2. 对 AGENTS.md 与 docs 目录执行持续治理：结构统一、状态同步、触发即更新。
3. 每次关键变更（环境、拓扑、协作规则）后，更新对应章节与状态源。
4. 维护 `docs/issue/`、`docs/pr/`、`docs/ontology/`、`docs/superpowers/` 的目录一致性与索引可读性。
5. 当模板与现实冲突时，以运行时事实为准，并在文档中标注差异处理结论。
6. 管理阶段输入优先级：
   - P0（权威事实）：根目录 `AGENTS.md`、`scripts/check-agent-env.sh`、`script/shell_source.sh`、`script/shell_env.json`、当前仓库 git 结构
   - P1（参考约束）：模板文件（若可见）
   - P2（历史初始化输入）：`.tmp/doc-input.json`（仅在存在时参考，不作为硬依赖）

## 输入与输出

- 输入（初始化）：`.tmp/doc-input.json` + `src/builtin/templates/AGENTS.template.md | dist/builtin/templates/AGENTS.template.md`
- 输入（管理）：根目录 `AGENTS.md`（必读）+ `scripts/check-agent-env.sh` + `script/shell_source.sh` + `script/shell_env.json` + docs/gittree 事实；`.tmp/` 仅在存在时参考
- 输出：根目录 `AGENTS.md`

注意：模板仅提供结构提示，不提供渲染脚本，最终文本由 agent 按现场上下文直接撰写。
