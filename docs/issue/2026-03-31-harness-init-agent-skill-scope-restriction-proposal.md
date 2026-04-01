# 提案：仅限制 harness-init agent 的 skill 与工具范围（不影响全局）

日期：2026-03-31  
状态：提议（暂不实施）

## 背景

当前插件会注入 `skills.paths` 与 `harness-init` agent。项目希望后续实现：

- 仅对 `harness-init` 生效的 skill 白名单
- 仅对 `harness-init` 生效的工具适用范围约束
- 不改变其他 agent 的能力与全局配置行为

## 问题定义

若通过全局 `permission.skill` 或收紧全局 `skills.paths` 实现，会误伤其他 agent。

目标应调整为：在 `agent.harness-init.permission` 下做局部限制，保持 `skills.paths` 继续追加，确保生态兼容。

## 目标与非目标

### 目标

1. `harness-init` 仅允许加载：
   - `harness-env-skill`
   - `harness-repo-skill`
   - `harness-agents-doc-skill`
2. 非白名单 skill 对 `harness-init` 隐藏并拒绝加载。
3. 对 `harness-init` 设置工具级限制（例如 `task/webfetch/todowrite` deny）。
4. 其他 agent 保持既有行为不变。

### 非目标

- 不在本提案阶段变更 opencode 上游行为。
- 不移除或重构全局 skills 发现机制。
- 不强制将插件设为默认 agent。

## 建议改造步骤（后续开发项）

1. 明确策略
   - 确认 `harness-init` 的最小必需工具集。
   - 确认 skill 白名单与默认动作（建议 `"*": "deny"` + 三个 `allow`）。

2. 调整注入位置
   - 在 `src/handlers/config-handler.ts` 的 `next.agent[HARNESS_INIT_AGENT]` 下新增/合并 `permission`。
   - 保持 `skills.paths` 追加逻辑不变。
   - 去除（或下调）全局 `next.permission.skill` 的放开逻辑，避免全局副作用。

3. 兼容性处理
   - 采用 merge 策略，避免覆盖用户对 `harness-init` 已存在的其他配置。
   - 保持幂等：重复注入结果稳定。

4. 提示词软约束补充
   - 在 `src/builtin/agents/harness-init.md` 增加一段 Tool Policy，声明仅使用白名单 skill 与允许工具。
   - 该步骤为软约束，真正限制以 `permission` 为准。

5. 单测与回归
   - `tests/opencode/unit/config-handler.test.ts` 新增断言：
     - 仅 `harness-init` 拥有 skill 白名单限制。
     - 其他 agent 不受影响。
     - `skills.paths` 仍为追加行为。
     - 重复执行幂等。

6. 调试验证
   - 使用 `opencode debug agent harness-init` 验证：
     - `permission.skill` 规则符合预期。
     - 目标工具为禁用或 ask/deny 状态。
   - 使用 `opencode debug agent build` 验证 build 未被误伤。

7. 文档更新
   - 在 `README.md` 的 Notes 补充“agent 局部权限”设计说明。
   - 记录与全局权限策略边界，避免后续误改。

## 验收标准（建议）

1. `harness-init` 看不到并无法加载非白名单 skill。
2. 非 `harness-init` agent 的 skill 可见性与能力不变。
3. `skills.paths` 仍支持外部扩展路径追加。
4. 单测与现有 E2E 全部通过。

## 风险与注意事项

- 若仍保留全局 `permission.skill` 放开逻辑，可能抵消局部限制意图。
- 规则顺序遵循“后匹配优先”，需注意 merge 后最终顺序。
- 工具权限与提示词约束冲突时，以权限系统结果为准。
