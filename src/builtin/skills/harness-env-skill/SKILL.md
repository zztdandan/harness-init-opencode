# harness-env-skill

## 目标

统一探测当前工作机可用环境并形成结构化记录，供后续 AGENTS.md 生成使用。

## 探测顺序（必须）

1. Python 侧：`uv -> venv -> python`
2. JavaScript 侧：`bun -> node`
3. Shell 侧：`zsh -> bash`

## 执行规则

- 严格按顺序探测并记录命中与缺失。
- 缺失不阻断流程，写入 `tmp/env.json`。
- `venv_path` 由 agent 在执行期决定并回写文档，不使用模板静态占位。
- 输出必须区分两个阶段：
  - Bootstrap：允许降级并记录事实
  - Steady state：确认 `uv` 和 `.venv` 后执行 uv-first

## 输出格式

写入 `tmp/env.json`：

```json
{
  "python": {"order": ["uv", "venv", "python"], "selected": "uv", "missing": []},
  "js": {"order": ["bun", "node"], "selected": "bun", "missing": []},
  "shell": {"order": ["zsh", "bash"], "selected": "bash", "missing": ["zsh"]},
  "final_recommendation": "prepare uv bun bash"
}
```
