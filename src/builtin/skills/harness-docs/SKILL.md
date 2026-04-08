---
name: harness-docs
description: Initialize and manage AGENTS.md and harness documentation system with governance, update triggers, and lifecycle maintenance.
---

# harness-docs

## 守则

- 文档系统必须同时支撑初始化交付与长期管理，不只生成一次性文件。
- `AGENTS.md` 是可执行约束文档，内容需可审查、可追溯、可持续更新。
- 文档更新遵循事实优先：仅根据环境、仓库与流程的真实状态写入。
- 输出中必须显式记录关键结构决策。

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
4. `## 0) 用语约定` 必须存在，并准确包含以下定义（建议逐字保留模板文本，不得改写语义）：
   - `Harness 工作区：指的是当前 AGENTS.md所在目录，该目录是 agent 应启动时的工作目录，包含 agent 所需所有运行配置与运行时`
   - `主管理项目：本 agent 实际要进行管理及操作的 git项目，该项目是纯代码项目，内部不含 agent 工作运行时与 agent 辅助相关内容，是纯粹的工程化代码。请注意在进行 worktree摘出时，摘出的是主管理项目 git库而不是工作区 git库`
   - 两条定义必须回答“哪个目录是 Harness 工作区、哪个目录是主管理项目”，且主管理项目必须给出明确路径（绝对路径或仓库相对路径均可）
5. `### 2.3 Worktree 策略` 中必须完整保留以下关键块，不得省略：
   - `各库能力分配与修改模式` 表格
   - `工作流规则` 1~6 条
   - `🚨 Worktree 摘出范围（强制）` 规则
   - 明确字段 `Harness 工作区` 与 `主管理项目`，并写明主管理项目绝对/仓库相对路径
   - 明确规则：`.worktrees/` 仅作为 `主管理项目` 的功能开发 worktree 落点；禁止将 `Harness 工作区` 检出到 `.worktrees/` 进行功能开发
   - 明确规则：`.worktrees/` 开发仅允许检出主管理项目；不得在 `.worktrees/` 中并行检出其他项目
6. 环境章节不再在 `harness-docs` 内重复定义探测细节；环境探测与脚本内容由 `harness-agent-env` 统一负责。
7. `AGENTS.md` 仅保留会话启动的 env 入口说明：
   - `bash scripts/check-agent-env.sh`
   - `scripts/shell_source.sh` + `scripts/session_env.json` 仅声明为 bash 前置影响资产（不在 AGENTS.md 维护显式执行步骤）
   其余 Python/JS/Shell/Go 探测细则以 `harness-agent-env` 的最新事实为准。
8. 强制包含 MUSTDO 区块，且至少包含：
   - 代码注释需可 review、可读
   - 已有有价值注释不得随意删除
9. 必须包含 `Project Tree & Task Status` 章节，并作为权威状态源维护。
10. 若模板与历史生成结果冲突，优先执行模板；遇到历史遗留章节（如拆分成两个独立 git 章节、重复环境说明）时，按模板合并并清理重复段落。

## 校验说明（强制）

每次生成或治理 `AGENTS.md` 后，必须执行以下最小语义校验并在输出中给出结论（满足/不满足 + 原因）。
注意：本节只定义“如何验收”，不重复初始化章节的写作说明；校验对象以“初始化”第 4/5 条为准。

1. `AGENTS.md` 必须存在 `## 0) 用语约定` 章节，并准确出现字段：`Harness 工作区`、`主管理项目`。
2. `Harness 工作区` 与 `主管理项目` 的定义必须与模板关键段落语义一致；优先逐字复用模板文本，禁止省略核心限定语义（尤其是“worktree 摘出的是主管理项目 git库而不是工作区 git库”）。
3. 上述定义必须明确给出“哪个路径是主管理项目”（禁止仅写名称不写路径）。
4. 必须存在明确文字规则：`.worktrees/` 仅用于主管理项目；禁止将 Harness 工作区检出到 `.worktrees/`；并保留“禁止检出其他项目”的约束语义。
5. 若任一项缺失或语义不满足，优先补齐文档再进入后续流程；如当次无法完成，需在输出中明确列出待补齐项与原因。

## 管理

1. 管理阶段（初始化完成后）不再依赖 `.tmp/`；默认读取并增量维护根目录现有成品：`AGENTS.md`。
2. 对 AGENTS.md 执行持续治理：结构统一、状态同步、触发即更新。请注意，若接手一个已经有其他结构的 AGENTS.md，在不改动它叙事逻辑的基础上，维护本技能要求的内容，**而不是完全删除与重编排该文件**。
3. 管理阶段采用“最小增量改动”：优先复用既有定义与段落，不重复新增与“初始化”同义的说明文本；仅在缺失/冲突时补写。
4. 每次关键变更（环境、拓扑、协作规则）后，更新对应章节与状态源。
5. 本技能需维护 docs 外部骨架：确保 `docs/issue/`、`docs/pr/`、`docs/ontology/`、`docs/superpowers/` 目录存在（建议各目录保留 `.gitkeep` 以便版本追踪）；除目录存在性外，不承担其内部内容治理，子目录细则由对应专用技能负责。
6. 当模板与现实冲突时，以运行时事实为准，并在文档中标注差异处理结论。
7. 管理阶段输入优先级：
   - P0（权威事实）：根目录 `AGENTS.md`现状、`scripts/check-agent-env.sh`、`scripts/shell_source.sh`、`scripts/session_env.json`、当前仓库 git 结构
   - P1（参考章节）：模板文件 `src/builtin/templates/AGENTS.template.md | dist/builtin/templates/AGENTS.template.md` （若可见）
   - P2（历史初始化输入）：`.tmp/doc-input.json`（仅在存在时参考，不作为硬依赖）

## 输入与输出

- 输入（初始化）：`.tmp/doc-input.json` + `src/builtin/templates/AGENTS.template.md | dist/builtin/templates/AGENTS.template.md`
- 输入（管理）：根目录 `AGENTS.md`（必读）+ `scripts/check-agent-env.sh` + `scripts/shell_source.sh` + `scripts/session_env.json` + 当前仓库 git tree 事实 + `src/builtin/templates/AGENTS.template.md | dist/builtin/templates/AGENTS.template.md` 供结构性参考；`.tmp/` 仅在存在时参考
- 输出：根目录 `AGENTS.md`

注意：模板仅提供结构提示，不提供渲染脚本，最终文本由 agent 按现场上下文直接撰写。
