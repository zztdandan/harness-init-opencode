---
name: harness-agent-env
description: Initialize and continuously manage harness workspace runtime bootstrap assets. Use this skill whenever user mentions agent environment/runtime setup, session bootstrap, check-agent-env.sh, shell_source.sh, shell_env.json, AGENTS.md session start checks, uv/venv/python, bun/node, bash/zsh selection, or Go 1.20/1.24 environment prep.
---

# harness-agent-env

## 守则

本技能负责维护三类“可持续生效”的资产，确保后续会话在 plugin 退出挂载后，仍可通过既定前置机制恢复环境：

1. `scripts/check-agent-env.sh`
2. `script/shell_source.sh`
3. `script/shell_env.json`

补充：`AGENTS.md` 仅维护会话启动校验入口与前置约束，不再维护 `shell_source.sh` / `shell_env.json` 的显式执行步骤。

### 会话执行约束

每轮对话启动时，仅执行一次：

1. `bash scripts/check-agent-env.sh`

`script/shell_source.sh` 与 `script/shell_env.json` 由 harness 作为 bash 前置机制自动生效；不要求 agent 在会话中显式执行或显式说明其调用细节。

## 技能工作模式：初始化 & 管理

### 1) 初始化（从零开始）

触发条件：任一核心资产缺失、AGENTS.md 缺失固定段落、或用户明确要求首次建立环境基线。

必须完成：

1. 环境探测（Python → JavaScript → Shell）
2. 生成/写入三类资产：`scripts/check-agent-env.sh`、`script/shell_source.sh`、`script/shell_env.json`
3. 在 `AGENTS.md` 注入固定启动段落（仅保留校验入口和前置约束）
4. 写入 `.tmp/env.json`（初始化阶段必须写）

### 2) 管理（已有项目规整）

触发条件：核心资产已存在，需修复、收敛、补充信息、对齐规范。或校验环境失败或输出结果与用户要求不符，需调整以满足harness 工作要求。

必须完成：

1. 复核三类资产与当前事实是否一致
2. 增量修改资产和 AGENTS.md 固定段落
3. 是否写 `.tmp/env.json` 由模型判断（可写可不写），但若写入则必须与当前事实一致

## 基础环境探测规范
用户可以指定、提示这些环境，优先遵循用户提示。

探测链路（初始化/重做阶段）：

- Python：`uv -> venv -> python`
- JavaScript：`bun -> node`
- Shell：`bash -> zsh`

即优先探测更现代的工具链（如 uv、bun、bash），若不可用再探测传统选项（venv、node、zsh），最后才是系统默认（python）。

说明：`check-agent-env.sh` 是探测环境后的验证及 stdio 输出环境情况的脚本，并不是探测脚本，只输出“初始化或重做阶段已选定的可用链路 + shell_env.json 已设定环境变量”。

## 技能工作流程

1. 由 agent 根据技能提示，完成语言环境探测后，维护 `shell_source.sh`、`shell_env.json` 与 `check-agent-env.sh` 三类资产：

  - `script/shell_env.json`：维护 bash 工具自动注入的环境变量键值
  - `script/shell_source.sh`：维护 bash 工具执行前自动 `source` 的脚本逻辑（例如函数定义、PATH 拼接、辅助别名）
  - `scripts/check-agent-env.sh`：每 session 输出语言环境事实，并附带 `shell_env.json` 设定变量清单（TOML），维护及编写规范见下文

2. 在 harness 工作区的 AGENTS.md 中，维护固定段落：会话只跑校验脚本，且声明上述其他两个前置资产受 `harness-agent-env` 管理。
3. 在一个 Bash脚本中，完成临时 `shell_env.json`  环境变量注入，以及 `shell_source.sh` 的 source，在这个条件下，执行 `check-agent-env.sh` 输出环境探测结果，检查是否与要求相符，若相符本技能工作流程结束，否则回到第1步继续维护资产直到满足要求。


## shell_source 与 shell_env 约定

### `script/shell_env.json`

固定职责：

1. 只维护“bash 工具自动注入”的环境变量映射
2. 键为环境变量名，值为字符串
3. 与 `check-agent-env.sh` 输出中的 `shell_env` 段保持一致
4. 禁止混入探测日志、说明文本、注释字段

额外编写与维护规范：
- json形式为简单KV，即
```json
{
  "VAR_NAME": "value",
  "PATH_EXTRA": "/opt/custom/bin"
}
```
- 在探测有 uv 环境时，设定 uv 相关环境变量（如 `UV_PROJECT_ENVIRONMENT`），设置为绝对路径
- 在用户要求有某些二进制工具需要使用时，不在此json维护 PATH 相关变量，而是维护在 `shell_source.sh` 中的 PATH 拼接逻辑里。
- 传统 python 虚拟环境（venv）不通过环境变量传递路径，而是通过 `check-agent-env.sh` 输出的 `python.command` 字段传递可调用命令路径。


### `script/shell_source.sh`

固定职责：

1. 只维护“source 后生效但非纯环境变量映射”的逻辑
2. 允许定义函数、PATH 组装、shell helper，以及用户要求的其他逻辑
3. 保持可重复 source 的幂等性
4. 不承担探测报告输出职责

## check-agent-env 约定与编写指南

该脚本的目的是每 session 一次统一校验环境是否仍然有效，并输出结果供模型理解当前状态。

该脚本在编写时，agent 需基于环境探测结果及 bash 前置效果综合确认语言环境使用方式与既定结果一致，并以 TOML 输出当前环境状态。

固定要求：

1. 仅检测已选中语言环境的工具链（Python/JavaScript/Shell/补充语言）及版本信息，比如已经选择了 uv 就不再在脚本中检测 python python3 .venv/bin/python 等
2. 在默认 bash 前置机制已生效的前提下输出结果，即结果需体现 `script/shell_env.json` 注入后的环境变量，以及 `script/shell_source.sh` source 后的可用状态
3. `command` 可以是短命令或绝对路径，不带参数
4. 若已在 PATH 中，`command` 直接写短命令；否则写绝对路径
5. 必须新增输出 `shell_env` 段，打印 `script/shell_env.json` 中全部设定变量
6. 不输出建议、安装提示、冗余日志

脚本的 stdio输出规范与示例见：

- `reference/check-output/ENV_CHECK_OUTPUT_SPEC.md`

### `check-agent-env` 伪代码

下面给出的是“按已选定结果生成脚本”的模板化伪代码，重点是**基于前置探测事实做校验**，不是重新探测或回退。伪代码仅供参考，实际脚本按照当时情况实际进行

#### 总体模板

```text
main:
  读取 {workspace}/script/shell_env.json
  若缺失 / 不可读 / 非简单 KV JSON:
    stderr: "shell_env.json invalid"
    exit 1

  读取初始化阶段沉淀的已选中事实（示意）：
    {python.selected}, {python.command.detected}
    {javascript.selected}, {javascript.command.detected}
    {shell.selected}, {shell.command.detected}
    {extra_languages...}

  初始化 TOML 缓冲
  写入 schema_version = "1"

  按“已选中事实”依次校验并写段：
    write_python_section_from_fact(...)
    write_javascript_section_from_fact(...)
    write_shell_section_from_fact(...)
    write_extra_sections_from_fact(...)

  写入 [shell_env.vars]（原样回显 shell_env.json 全量键值）
  stdout 一次性输出 TOML
  exit 0
```

#### 路径处理模板（核心）

```text
resolve_command_for_output({detected_command}):
  # {detected_command} 可能是："uv"、"node"、"bash"、".venv/bin/python"、"/abs/path/python"

  若 {detected_command} 在 PATH 中可直接调用:
    command_output = 对应短命令
    # 例如 detected 是 "/usr/bin/node" 且 PATH 可找到 node，则输出 "node"

  否则:
    command_output = 绝对路径
    # 若 detected 是相对路径（例如 ".venv/bin/python"），先基于工作区转成绝对路径再输出

  返回 {command_output}
```

说明：

- `command` 字段最终只能是“短命令”或“绝对路径”，不能是相对路径。
- 即使实际校验时调用的是 `{workspace}/.venv/bin/python`，若该命令不在 PATH，输出也应是绝对路径。
- 全程只围绕前面探测结论里的 `{detected_command}` 做校验，不新增候补命令。

#### Python 段模板（按已选结果分支）

```text
write_python_section_from_fact({python.selected}, {python.command.detected}):
  if {python.selected} == "uv":
    执行 {python.version_probe = "{python.command.detected} --version"}
    失败则 stderr: "python environment check failed: uv unavailable"; exit 1
    {python.command.output} = resolve_command_for_output({python.command.detected})
    写 [python]
    写 selected = "uv"
    写 command = {python.command.output}
    写 version = {python.version.stdout_raw}

  else if {python.selected} == "venv":
    # 典型 detected_command 可能是 ".venv/bin/python" 或其绝对路径
    执行 {python.version_probe = "{python.command.detected} --version"}
    失败则 stderr: "python environment check failed: venv unavailable"; exit 1
    {python.command.output} = resolve_command_for_output({python.command.detected})
    写 [python]
    写 selected = "venv"
    写 command = {python.command.output}
    写 version = {python.version.stdout_raw}

  else if {python.selected} == "python":
    执行 {python.version_probe = "{python.command.detected} --version"}
    失败则 stderr: "python environment check failed: python unavailable"; exit 1
    {python.command.output} = resolve_command_for_output({python.command.detected})
    写 [python]
    写 selected = "python"
    写 command = {python.command.output}
    写 version = {python.version.stdout_raw}
```

强约束：

- 已选 `uv` 就只校验 `{python.command.detected}` 对应的 uv 入口，不再检查 `python/python3/.venv/bin/python`。
- 已选 `venv` 就只校验既定 venv 入口（哪怕是 `.venv/bin/python`），不再回退 `uv` 或系统 python。

#### JavaScript 段模板

```text
write_javascript_section_from_fact({javascript.selected}, {javascript.command.detected}):
  if {javascript.selected} == "bun":
    执行 {javascript.version_probe = "{javascript.command.detected} --version"}
    失败则 stderr: "javascript environment check failed: bun unavailable"; exit 1
    {javascript.command.output} = resolve_command_for_output({javascript.command.detected})
    写 [javascript]
    写 selected = "bun"
    写 command = {javascript.command.output}
    写 version = {javascript.version.stdout_raw}

  else if {javascript.selected} == "node":
    执行 {javascript.version_probe = "{javascript.command.detected} --version"}
    失败则 stderr: "javascript environment check failed: node unavailable"; exit 1
    {javascript.command.output} = resolve_command_for_output({javascript.command.detected})
    写 [javascript]
    写 selected = "node"
    写 command = {javascript.command.output}
    写 version = {javascript.version.stdout_raw}
```

#### Shell 段模板

```text
write_shell_section_from_fact({shell.selected}, {shell.command.detected}):
  if {shell.selected} == "bash":
    执行 {shell.version_probe = "{shell.command.detected} --version"}
    失败则 stderr: "shell environment check failed: bash unavailable"; exit 1
    {shell.command.output} = resolve_command_for_output({shell.command.detected})
    写 [shell]
    写 selected = "bash"
    写 command = {shell.command.output}
    写 version = {shell.version.stdout_raw_or_first_line}

  else if {shell.selected} == "zsh":
    执行 {shell.version_probe = "{shell.command.detected} --version"}
    失败则 stderr: "shell environment check failed: zsh unavailable"; exit 1
    {shell.command.output} = resolve_command_for_output({shell.command.detected})
    写 [shell]
    写 selected = "zsh"
    写 command = {shell.command.output}
    写 version = {shell.version.stdout_raw}
```

#### 补充语言模板

```text
write_extra_section_from_fact({lang.name}, {lang.selected}, {lang.command.detected}, {lang.version.arg}):
  执行 {"{lang.command.detected} {lang.version.arg}"}
  失败则 stderr: "{lang.name} environment check failed: {lang.selected} unavailable"; exit 1
  {lang.command.output} = resolve_command_for_output({lang.command.detected})
  写 [{lang.name}]
  写 selected = {lang.selected}
  写 command = {lang.command.output}
  写 version = {lang.version.stdout_raw}
```

补充语言字段名与附加约束优先服从各自 reference；但“只校验既定事实、失败即非 0 退出、无冗余日志”不变。

#### `shell_env` 段模板

```text
write_shell_env_vars({shell_env_json_object}):
  写 [shell_env.vars]
  对每个 {key, value}:
    写 {key} = "{toml_escaped(value)}"
```

这里回显的是 `script/shell_env.json` 的设定值，不做推导、不补字段、不漏字段。

#### 典型事实组合示例（模板思路）

1. `{python.selected=uv, python.command.detected=uv}` + `{javascript.selected=bun}` + `{shell.selected=bash}`：仅校验三者既定入口并输出
2. `{python.selected=venv, python.command.detected=.venv/bin/python}` + `{javascript.selected=node}` + `{shell.selected=bash}`：Python 只校验该 venv 入口，并把 `command` 输出为短命令或绝对路径
3. `{python.selected=python, python.command.detected=/opt/py/bin/python}` + `{javascript.selected=node}` + `{shell.selected=zsh}`：按既定绝对路径校验，不做候补
4. 启用 Go 等补充语言：在基础三段后追加独立语言段，不混入基础段



### `check-agent-env`运行失败处理

- 不做额外漂移检测与漂移输出。
- 若脚本执行发现设定在脚本中的运行结果出现失败，即判定为环境不可用，直接在 stdio中提示某个语言的环境检测失败不可用，并以非 0 退出。
- 注意将agent是否往下运行的自主权仍交给agent与用户判断，脚本
- 若 `script/shell_env.json` 缺失或格式错误，应直接报错并非 0 退出。


## 补充其他语言环境规范

除了常规的 python node bash 探测结果外，本技能支持在满足条件时，确认额外的语言环境。

### Go 补充规范（满足条件时启用，非必选）

当出现以下任一场景时，本技能可以维护 Go 语言环境：

1. 主管理项目是 Go 项目
2. 用户明确要求初始化/重做 Go 环境
3. 与用户正确核对了 Go 的版本且本技能支持此版本

Go 对 check 输出行为的补充约束全部下沉至 reference，且仅在需进行 Go 语言环境 初始化/重做场景阅读：

- `reference/go/GO_ENV_REFERENCE.md`
- `reference/go/check-output/ENV_CHECK_OUTPUT_SPEC.md`

Go check 输出规范是对主规范的补充，不替代主规范。

## AGENTS.md 集成（固定段落）

必须维护以下段落（允许小幅文案差异，意思不变）：

```markdown
### 会话启动一次性环境校验（每轮对话仅一次）

每轮对话启动时，**仅执行一次以下步骤**：

执行环境校验脚本：`bash scripts/check-agent-env.sh`

约束：
- `script/shell_source.sh` 与 `script/shell_env.json` 影响 bash 前置行为，仅允许通过 `harness-agent-env` 维护。
- 若缺失 `harness-agent-env` 管理，不允许agent修改这两个前置资产。
```

## 输出结构（.tmp/env.json）

初始化阶段必须写入 `.tmp/env.json`，管理阶段按需写入。结构至少包含：

- 探测顺序与命中结果
- missing 列表
- Go（若触发）版本/关键路径/来源
- `scripts.check`、`scripts.shell_source`、`scripts.shell_env` 路径
- `phase`（bootstrap/manage）
- `timestamp`
