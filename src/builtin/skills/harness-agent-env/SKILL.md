---
name: harness-agent-env
description: Initialize and continuously manage harness workspace runtime bootstrap assets. Use this skill whenever user mentions agent environment/runtime setup, session bootstrap, check-agent-env.sh, init-agent-env.sh, AGENTS.md session start checks, uv/venv/bun/node/zsh/bash detection, Go 1.20/1.24 environment prep, or asks to make every conversation runnable even without reloading this skill. Always use this skill for both first-time setup and later cleanup/normalization of existing projects.
---

# harness-agent-env

## 核心目标（必须贯彻）

本技能负责维护两类“可持续生效”的资产，确保后续对话即使不重新加载本技能，也能完成环境准备：

1. `scripts/init-agent-env.sh` + `scripts/check-agent-env.sh`
2. `AGENTS.md` 中“会话启动一次性环境校验”固定段落

### 会话启动顺序（强约束）

每轮对话启动时只执行一次，顺序必须是：

1. `source scripts/init-agent-env.sh`
2. `bash scripts/check-agent-env.sh`

顺序不可反转。`init` 负责注入环境，`check` 负责基于已注入状态输出事实与建议。

## 工作模式：初始化 vs 管理

### 1) 初始化（从零开始）

触发条件：脚本缺失、AGENTS.md 缺失固定段落、或用户明确要求首次建立环境基线。

必须完成：

1. 环境探测（Python → JavaScript → Shell → 其他可选）
2. 生成/写入 `scripts/init-agent-env.sh` 与 `scripts/check-agent-env.sh`
3. 在 `AGENTS.md` 注入固定启动段落
4. 写入 `.tmp/env.json`（初始化阶段必须写）

### 2) 管理（已有项目规整）

触发条件：脚本已存在，需修复、收敛、补充信息、对齐规范。

必须完成：

1. 复核脚本与当前事实是否一致
2. 增量修改脚本和 AGENTS.md 固定段落
3. 是否写 `.tmp/env.json` 由模型判断（可写可不写），但若写入则必须与当前探测事实一致

## 执行规则

1. **探测顺序固定**：Python → JavaScript → Shell → Go
2. **证据留存**：保留探测命令与版本依据，禁止“猜测式”写入
3. **幂等性**：`init/check` 可重复执行，不得因重复执行而污染环境
4. **缺失项处理**：记录 missing 并给安装建议，不阻断整体流程
5. **事实优先**：`check` 输出必须与当前已生效环境一致

## 基础环境探测规范

按顺序探测：

- Python：`uv -> venv -> python`
- JavaScript：`bun -> node`
- Shell：`zsh -> bash`

生成脚本要求：

- `scripts/init-agent-env.sh`：只放可 `source` 的初始化逻辑（变量导出、PATH 注入、必要的 source 调用）
- `scripts/check-agent-env.sh`：只做状态校验与信息输出（可直接执行）

`check` 至少输出：

1. 各链路命中结果与版本
2. 关键路径（如 venv、可执行路径、当前 shell）
3. 本轮建议与稳态建议

## Go 环境规范（可选规范）

### 触发条件

满足任一条件即进入 Go 流程：

1. 主管理项目是 Go 项目（依据主管理项目 `go.mod`/`go.sum` 或主 agent 明确说明）
2. 用户明确要求准备 Go 1.20/1.24 环境

注意：判定对象是“主管理项目”，不是 harness 管理仓自身目录。

### Go 版本与路径决策

按优先级：

1. 用户明确提供（版本、GOROOT/GOPATH/GOBIN、私有模块配置、GOMODCACHE）
2. 默认路径（1.20 对应 `/home/base/.gvm/gos/go1.20.14`，1.24 对应 `/home/base/.gvm/gos/go1.24.1`）
3. `go env`/PATH 发现（作为兜底事实来源）

### Go 初始化落地要求（强约束）

当 Go 版本已经明确（1.20 或 1.24）后，`init-agent-env.sh` 必须包含“真实初始化动作”，禁止仅做 no-op 回填。

允许两种实现方式（二选一）：

1. **推荐方式：调用 reference 脚本**
   - 将 `switch_go120.sh` / `switch_go124.sh`（及依赖 `go_env_common.sh`）拷贝到项目 `scripts/`，或通过稳定相对路径直接引用 reference
   - 在 `init-agent-env.sh` 中使用 `source` 调用对应 `switch_*` 脚本
2. **内联方式：融入等价逻辑**
   - 仅当无法稳定引用脚本时，才可将 switch 的等价逻辑内联到 `init-agent-env.sh`
   - 逻辑必须等价于 reference 的真实切换行为（设置 GOROOT/GOPATH/GOBIN、PATH、GOPRIVATE 等）

禁止行为：

- 明确 Go 版本后，仅执行 `export GOROOT="$(go env GOROOT)"` 这类“读当前值再写回”的伪初始化
- 把 Go 初始化退化成纯信息输出

### switch/install 语义

- `switch_*` 必须通过 `source` 执行
- `install_*` 必须通过 `bash` 执行

### Go 状态输出要求（check）

Go 项目时，`check-agent-env.sh` 必须额外输出：

1. 当前 Go 版本与命中链路
2. GOROOT/GOPATH/GOBIN/GOMODCACHE
3. GOPRIVATE/GONOPROXY/GONOSUMDB
4. 初始化来源（`user_provided` / `default` / `go_env` / `installed`）
5. 是否通过 `switch_*` 或等价内联逻辑完成初始化

## AGENTS.md 集成（固定段落）

必须维护以下段落（允许小幅文案差异，但顺序不可变）：

```markdown
### 会话启动一次性环境校验（每轮对话一次）

每轮对话启动时，仅执行一次以下步骤：

1. 加载环境变量：`source scripts/init-agent-env.sh`
2. 执行环境校验脚本：`bash scripts/check-agent-env.sh`

若脚本不存在或执行失败，使用 harness-agent-env 技能管理。
```

## 输出结构（.tmp/env.json）

初始化阶段必须写入 `.tmp/env.json`，管理阶段按需写入。结构至少包含：

- 探测顺序与命中结果
- missing 列表
- Go（若触发）版本/路径/来源
- `scripts.check` 与 `scripts.init` 路径
- `phase`（bootstrap/manage）
- `final_recommendation`
- `timestamp`

`source` 字段可选值：`user_provided` / `default` / `go_env` / `installed`。

## 参考资料

Go 相关脚本与说明位于：`reference/dedge-dev-env/GO_ENV_REFERENCE.md`。
