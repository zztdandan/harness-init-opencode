# harness-agents-doc-skill

## 目标

基于模板与 tmp 事实生成最终 AGENTS.md，并保证其可执行、可审查、可持续更新。

## 强制要求

- 必须包含 MUSTDO 区块。
- MUSTDO 中必须包含：
  - 代码注释应保持可 review 可读性
  - 编写后不得删除有价值注释

## 必备章节

1. Project Tree & Task Status
2. Git Topology & Collaboration Rules
3. Submodule 与 `.worktrees/` 策略
4. Python Environment & Tooling
5. Bootstrap phase vs steady state
6. Debug & E2E
7. Docs 维护机制
8. Implementation Boundaries
9. AGENTS.md Auto-Update Mechanism
10. README 维护规范（5.1 必备章节 + 5.2 更新触发条件）

## 输入与输出

- 输入：`tmp/doc-input.json` + `src/builtin/templates/AGENTS.template.md`
- 输出：根目录 `AGENTS.md`

注意：模板仅用于提示结构，不要求也不提供渲染脚本。`AGENTS.md` 由 agent 按实时上下文直接撰写。

输出必须写入：

- Gate A/Gate B 的决策摘要
- 环境探测链路与最终推荐
- submodule / `.worktrees/` 结构
- Section 1 作为唯一状态源的维护规则（7.1/7.2）
