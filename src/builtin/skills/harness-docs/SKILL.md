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

1. 读取 `tmp/doc-input.json` 与 `src/builtin/templates/AGENTS.template.md`。
2. 生成根目录 `AGENTS.md`，并确保包含以下核心章节：
   - Project Tree & Task Status
   - Git Topology & Collaboration Rules
   - Submodule 与 `.worktrees/` 策略
   - Python Environment & Tooling
   - Bootstrap phase vs steady state
   - Docs 维护机制
3. 强制包含 MUSTDO 区块，且至少包含：
   - 代码注释需可 review、可读
   - 已有有价值注释不得随意删除
4. 初始化输出必须写入 Gate A/Gate B 决策摘要、环境链路推荐与结构说明。
5. 在环境章节（优先覆盖当前已探测到的 Python/JavaScript/Shell 能力，并允许后续扩展）下必须包含“会话启动一次性环境校验”小段落，明确：
   - 每轮对话启动时仅执行一次 `bash scripts/check-agent-env.sh`
   - 需要环境变量时执行 `source scripts/init-agent-env.sh`
   - 若主管理项目为 Go 项目，补充 Go 环境小段落（版本、路径来源策略、工具链安装状态）

## 管理

1. 对 AGENTS.md 与 docs 目录执行持续治理：结构统一、状态同步、触发即更新。
2. 每次关键变更（环境、拓扑、协作规则）后，更新对应章节与状态源。
3. 维护 `docs/issue/`、`docs/pr/`、`docs/ontology/`、`docs/superpowers/` 的目录一致性与索引可读性。
4. 当模板与现实冲突时，以运行时事实为准，并在文档中标注差异处理结论。

## 输入与输出

- 输入：`tmp/doc-input.json` + `src/builtin/templates/AGENTS.template.md`
- 输出：根目录 `AGENTS.md`

注意：模板仅提供结构提示，不提供渲染脚本，最终文本由 agent 按现场上下文直接撰写。
