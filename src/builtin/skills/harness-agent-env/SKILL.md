---
name: harness-agent-env
description: Initialize and continuously manage harness workspace runtime bootstrap assets. Use this skill whenever user mentions agent environment/runtime setup, session bootstrap, check-agent-env.sh, init-agent-env.sh, AGENTS.md session start checks, uv/venv/python, bun/node, bash/zsh selection, or Go 1.20/1.24 environment prep.
---

# harness-agent-env

## 守则

本技能负责维护两类“可持续生效”的资产，确保后续会话在 plugin 退出挂载后，仍可仅靠脚本完成环境恢复：

1. `scripts/init-agent-env.sh` + `scripts/check-agent-env.sh`
2. `AGENTS.md` 中“会话启动一次性环境校验”固定段落

### 脚本执行约束

这套脚本被设计为“每轮对话一次性执行”，且必须严格按照以下顺序执行：

1. `source scripts/init-agent-env.sh`
2. `bash scripts/check-agent-env.sh`

顺序不可反转。`init` 负责注入环境，`check` 负责输出已注入后的事实。

##  技能工作模式：初始化 & 管理

### 1) 初始化（从零开始）

触发条件：脚本缺失、AGENTS.md 缺失固定段落、或用户明确要求首次建立环境基线。

必须完成：

1. 环境探测（Python → JavaScript → Shell）
2. 生成/写入 `scripts/init-agent-env.sh` 与 `scripts/check-agent-env.sh`
3. 在 `AGENTS.md` 注入固定启动段落
4. 写入 `.tmp/env.json`（初始化阶段必须写）

### 2) 管理（已有项目规整）

触发条件：脚本已存在，需修复、收敛、补充信息、对齐规范。

必须完成：

1. 复核脚本与当前事实是否一致
2. 增量修改脚本和 AGENTS.md 固定段落
3. 是否写 `.tmp/env.json` 由模型判断（可写可不写），但若写入则必须与当前事实一致

## 基础环境探测规范

探测链路（初始化/重做阶段）：

- Python：`uv -> venv -> python`
- JavaScript：`bun -> node`
- Shell：`bash -> zsh`

即优先探测更现代的工具链（如 uv、bun、bash），若不可用再探测传统选项（venv、node、zsh），最后才是系统默认（python）。

说明：`check-agent-env.sh` 不做全量探测，只输出“初始化或重做阶段已选定的可用链路”。

## 技能工作流程

由 agent 完成环境探测后，生成 `init-agent-env.sh` 和 `check-agent-env.sh` 两个脚本。生成的两个脚本用于之后让 agent 每轮对话一次性执行，在当前探测结果的情况下，无需每轮对话都探测这些语言环境，就拥有这些语言环境的调用指示以及配置好的全套环境变量。

在 harness 工作区的 AGENTS.md 中，维护一个固定段落，明确规定每轮对话一次性执行的脚本和步骤。

## init-agent-env 功能约定

`scripts/init-agent-env.sh` 仅负责环境注入，不负责探测报告输出。

固定职责：

1. 根据初始化/重做阶段确定的探测环境结果，导出环境变量（如运行时选择、目录变量、语言工具链变量）
2. 在需要时进行 PATH 注入，确保后续 `check-agent-env.sh` 能按既定链路输出稳定命令
3. 仅保留可被 `source` 安全重复执行的逻辑，保证幂等
4. 不输出探测过程、不输出建议文案，不承担状态展示职责

脚本目的：

- 为后续会话提供“无脑加载即可恢复”的环境基线
- 使 `check-agent-env.sh` 在当前 shell 可以输出事实结果（TOML）

## check-agent-env 约定（强约束）

编制脚本的目的是，每轮对话一次，统一地检查之前配置好的环境是否仍然有效，并输出检查结果供模型方便地理解语言环境的当前状态。

该脚本在编写时，agent根据环境探查结果以及`scripts/init-agent-env.sh` 的注入结果综合后，使用脚本确认语言环境的使用方式仍与之前的环境探测结果一致，并以 TOML 格式输出当前环境状态。



该脚本正常输出结果必须符合下面要求。但是若 某个语言检查环境失败，那么必须以严格警告形式输出失败的信息，并要求模型不得使用该语言环境。

固定要求：

1. 仅输出已选中语言环境的工具链（Python/JavaScript/Shell/补充语言）及版本信息
2. 固定使用 `command` 字段表示“当前目录可调用命令”
3. `command` 可以是短命令或绝对路径，不带参数
4. 若已在 PATH 中，`command` 直接写短命令；否则写绝对路径
5. 不输出建议、安装提示、冗余日志

输出规范与示例见：

- `reference/check-output/ENV_CHECK_OUTPUT_SPEC.md`


## 补充语言规范

除了常规的 python node bash 探测结果外，本技能支持在满足条件时，在`init-agent-env`和`check-agent-env`脚本中注入与确认额外的语言环境。
### Go 补充规范（满足条件时启用，非必选）

当出现以下任一场景时，本技能可以维护 go 语言环境：

1. 主管理项目是 Go 项目
2. 用户明确要求初始化/重做 Go 环境
3. 与用户正确核对了 go 的版本且本技能支持此版本

Go 对脚本行为的补充约束（init/check 需要做什么）全部下沉至 reference，且仅在 Go 初始化/重做场景阅读：

- `reference/go/GO_ENV_REFERENCE.md`
- `reference/go/check-output/ENV_CHECK_OUTPUT_SPEC.md`

Go check 输出规范是对主规范的补充，不替代主规范。

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
- Go（若触发）版本/关键路径/来源
- `scripts.check` 与 `scripts.init` 路径
- `phase`（bootstrap/manage）
- `timestamp`
