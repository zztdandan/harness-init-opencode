---
name: harness-agent-env
description: Initialize and continuously manage harness workspace runtime bootstrap assets. Use this skill whenever user mentions agent environment/runtime setup, session bootstrap, check-agent-env.sh, shell_source.sh, session_env.json, AGENTS.md session start checks, uv/venv/python, bun/node, bash/zsh selection, or Go 1.20/1.24/1.26 environment prep.
---

# harness-agent-env

## 守则

本技能负责维护三类“可持续生效”的资产，确保后续会话在 plugin 退出挂载后，仍可通过既定前置机制恢复环境：

1. `scripts/check-agent-env.sh`
2. `scripts/shell_source.sh`
3. `scripts/session_env.json`

补充：`AGENTS.md` 相关固定文本以“## AGENTS.md 集成（固定段落）”为唯一规范来源；其他章节仅引用，不重复展开。



## 技能工作模式：初始化 & 管理

### 1) 初始化（从零开始）

触发条件：任一核心资产缺失、AGENTS.md 缺失固定段落、或用户明确要求首次建立环境基线。

必须完成：

1. 环境探测（Python → JavaScript → Shell）
2. 生成/写入三类资产：`scripts/check-agent-env.sh`、`scripts/shell_source.sh`、`scripts/session_env.json`
3. 在 `AGENTS.md` 注入固定启动段落（按“AGENTS.md 集成（固定段落）”逐字写入）
4. 写入 `.tmp/env.json`（初始化阶段必须写）

### 2) 管理（已有项目规整）

触发条件：核心资产已存在，需修复、收敛、补充信息、对齐规范。或校验环境失败或输出结果与用户要求不符，需调整以满足harness 工作要求。

必须完成：

1. 复核三类资产与当前事实是否一致
2. 增量修改资产和 AGENTS.md 固定段落（固定段落仍以“AGENTS.md 集成（固定段落）”为唯一文本源）
3. 是否写 `.tmp/env.json` 由模型判断（可写可不写），但若写入则必须与当前事实一致

## 基础环境探测规范
用户可以指定、提示这些环境，优先遵循用户提示。

探测链路（初始化/重做阶段）：

- Python：`uv -> conda -> venv -> python -> python3`
- JavaScript：`bun -> node`
- Shell：`bash -> zsh`

即优先探测更现代的工具链（如 uv、bun、bash），若不可用再探测传统选项（conda、venv、node、zsh），最后才是系统默认（python/python3）。

说明：`check-agent-env.sh` 是探测环境后的验证及 stdio 输出环境情况的脚本，并不是探测脚本，只输出“初始化或重做阶段已选定链路 + session_env.json 已设定环境变量”。

## 技能工作流程

1. 由 agent 根据技能提示，完成语言环境探测后，维护 `shell_source.sh`、`session_env.json` 与 `check-agent-env.sh` 三类资产：

  - `scripts/session_env.json`：维护 bash 工具自动注入的环境变量键值
  - `scripts/shell_source.sh`：维护 bash 工具执行前自动 `source` 的脚本逻辑（例如函数定义、PATH 拼接、辅助别名）
  - `scripts/check-agent-env.sh`：每 session 输出语言环境事实，并附带 `session_env.json` 设定变量清单（TOML），维护及编写规范见下文

2. 在 harness 工作区的 AGENTS.md 中，维护固定段落（内容来源仅限“AGENTS.md 集成（固定段落）”）。
3. 维护完成后，执行 `check-agent-env.sh` 做最终校验，确认输出与规范一致；若不一致则回到第 1 步继续收敛。


## shell_source 与 session_env 约定

### `scripts/session_env.json`

固定职责：

1. 只维护“bash 工具自动注入”的环境变量映射
2. 使用结构化 schema 包装环境变量映射
3. 与 `check-agent-env.sh` 输出中的 `session_env` 段保持一致
4. 禁止混入探测日志、说明文本、注释字段

额外编写与维护规范：
- JSON 正式结构固定为：
```json
{
  "schema": "harness-shell-env/v1",
  "env": {
    "VAR_NAME": "value",
    "PATH_EXTRA": "/opt/custom/bin"
  }
}
```
- `env` 中键为环境变量名，值写字符串（数值/布尔若出现需转字符串）
- 仅兼容读取历史“简单 KV”旧格式；维护时必须写回正式 schema 结构，不再新产出旧格式
- 在探测有 uv 环境时，设定 uv 相关环境变量（如 `UV_PROJECT_ENVIRONMENT`），设置为绝对路径
- 在用户要求有某些二进制工具需要使用时，不在此json维护 PATH 相关变量，而是维护在 `shell_source.sh` 中的 PATH 拼接逻辑里。
- 传统 python 虚拟环境（venv）不通过环境变量传递路径，而是通过 `check-agent-env.sh` 输出的 `python.command` 字段传递可调用命令路径。


### `scripts/shell_source.sh`

固定职责：

1. 只维护“source 后生效但非纯环境变量映射”的逻辑
2. 允许定义函数、PATH 组装、shell helper，以及用户要求的其他逻辑
3. 保持可重复 source 的幂等性
4. 不承担探测报告输出职责
5. 该脚本**不得**承担对`scripts/session_env.json` 的解析和 export 工作，而将这个工作交由 agent 的自动化 hook 完成

## check-agent-env 约定与编写指南

该脚本的目的是每 session 一次统一校验环境是否仍然有效，并输出结果供模型理解当前状态。

该脚本在编写时，agent 需基于环境探测结果及 bash 前置效果综合确认语言环境使用方式与既定结果一致，并以 TOML 输出当前环境状态。

固定要求：

1. 仅检测已选中语言环境的工具链（Python/Javascripts/Shell/补充语言）及版本信息，比如已经选择了 uv 就不再在脚本中检测 python python3 .venv/bin/python 等
2. 在默认 bash 前置机制已生效的前提下输出结果，即结果需体现 `scripts/session_env.json` 注入后的环境变量，以及 `scripts/shell_source.sh` source 后的可用状态
3. `command` 可以是短命令或绝对路径，不带参数
4. 若已在 PATH 中，`command` 直接写短命令；否则写绝对路径
5. 必须新增输出 `session_env` 段，打印 `scripts/session_env.json` 中全部设定变量
6. 不输出建议、安装提示、冗余日志
7. 该脚本**不进行**任何环境变量的export，或环境切换操作，仅是环境结果的校验

脚本的 stdio输出规范与示例见：

- `reference/check-output/ENV_CHECK_OUTPUT_SPEC.md`

### `check-agent-env` 伪代码

下面给出的是“按已选定结果生成脚本”的模板化伪代码，重点是**基于前置探测事实做校验**，不是重新探测或回退。伪代码仅供参考，实际脚本按照当时情况实际进行。

关键语义（强制）：

- 下述 `if/else` 与 `resolve_*` 属于“维护/编写阶段”的生成逻辑，不是 `check-agent-env.sh` 运行时逻辑。
- 最终生成后的 `check-agent-env.sh` 必须是“单一路径校验脚本”：只包含已选中事实对应的探测语句。
- 例如已选 `python.selected=uv` 时，脚本运行期只能执行 `uv --version`（或等价既定命令），不得再出现 `python/python3/conda/.venv/bin/python` 的存在性判断或候补分支。

#### 总体模板

```text
main:
  读取 {workspace}/scripts/session_env.json
  若缺失 / 不可读 / 非法 JSON / schema 无法识别:
    stderr: "session_env.json invalid"
    exit 1

  读取已选中事实（示意）：
    {python.selected}, {python.command.detected}
    {javascript.selected}, {javascript.command.detected}
    {shell.selected}, {shell.command.detected}
    {extra_languages...}

  初始化 TOML 缓冲
  写入 schema_version = "1"

  按“已选中事实”依次校验并写段（单语言失败不提前退出）：
    write_python_section_from_fact(...)
    write_javascript_section_from_fact(...)
    write_shell_section_from_fact(...)
    write_extra_sections_from_fact(...)

  写入 [session_env.vars]（原样回显 session_env.json 全量键值）
  stdout 一次性输出 TOML
  仅在脚本本身异常（例如 session_env.json 非法）时非 0 退出；
  单一语言不可用时仍输出完整结果并 0 退出
```

已选中事实最小约定（用于让脚本可持续维护，不限定具体落盘介质）：

- Python / JavaScript / Shell 至少包含：`selected` 与 `command.detected`
- `selected` 必须来自本技能允许值（例如 Python: `uv|conda|venv|python|python3`）
- `command.detected` 必须可映射为“短命令或绝对路径”输出语义

执行期禁止项（强制）：

- 禁止在 `check-agent-env.sh` 运行期做候补探测（例如“bun 不存在就改查 node”）。
- 禁止在 `check-agent-env.sh` 运行期做多候选存在性枚举（例如 `command -v bun node`、`type -a`、`which`、`find`）。
- 禁止在 `check-agent-env.sh` 运行期改写“已选中事实”（`selected` 与 `command`）。

#### 路径处理模板（核心，维护阶段）

```text
resolve_command_for_output_in_generation({detected_command}):
  # {detected_command} 可能是："uv"、"node"、"bash"、".venv/bin/python"、"/abs/path/python"

  若维护阶段确认 {detected_command} 在 PATH 中可直接调用:
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
- 更建议设置一些环境变量代替长绝对路径，使得命令路径是环境变量+短路径的结合体，甚至利用 source 脚本定义别名函数等方式让输出更简洁（例如输出 `python`，但实际执行时通过环境变量或 source 脚本让 `python` 实际调用到 `/home/base/repo/<project>/.venv/bin/python`）
- 全程只围绕前面探测结论里的 `{detected_command}` 做校验，不新增候补命令。
- 上述路径归一化在维护阶段完成；最终 `check-agent-env.sh` 运行时直接使用已固化的 `command` 与探测语句。

#### Python 段模板（按 selected 拆分，单模板单入口）

使用规则（强制）：

- 维护时先确定 `python.selected`，然后只使用对应的单一模板。
- 禁止写成 `if/else if` 多分支运行时逻辑。

**模板 A：`python.selected = "uv"`**

```text
write_python_section_for_uv({python.command.detected}):
  执行 {python.version_probe = "{python.command.detected} --version"}
  若失败则标记该语言 unavailable，并继续后续语言段写入
  {python.command.output} = resolve_command_for_output({python.command.detected})
  写 [python]
  写 selected = "uv"
  写 command = {python.command.output}
  写 version = {python.version.stdout_raw}
```

**模板 B：`python.selected = "conda"`**

```text
write_python_section_for_conda({python.command.detected}):
  执行 {python.version_probe = "{python.command.detected} --version"}
  若失败则标记该语言 unavailable，并继续后续语言段写入
  {python.command.output} = resolve_command_for_output({python.command.detected})
  写 [python]
  写 selected = "conda"
  写 command = {python.command.output}
  写 version = {python.version.stdout_raw}
```

**模板 C：`python.selected = "venv"`**

```text
write_python_section_for_venv({python.command.detected}):
  # 典型 detected_command 可能是 ".venv/bin/python" 或其绝对路径
  执行 {python.version_probe = "{python.command.detected} --version"}
  若失败则标记该语言 unavailable，并继续后续语言段写入
  {python.command.output} = resolve_command_for_output({python.command.detected})
  写 [python]
  写 selected = "venv"
  写 command = {python.command.output}
  写 version = {python.version.stdout_raw}
```

**模板 D：`python.selected = "python"`**

```text
write_python_section_for_python({python.command.detected}):
  执行 {python.version_probe = "{python.command.detected} --version"}
  若失败则标记该语言 unavailable，并继续后续语言段写入
  {python.command.output} = resolve_command_for_output({python.command.detected})
  写 [python]
  写 selected = "python"
  写 command = {python.command.output}
  写 version = {python.version.stdout_raw}
```

**模板 E：`python.selected = "python3"`**

```text
write_python_section_for_python3({python.command.detected}):
  执行 {python.version_probe = "{python.command.detected} --version"}
  若失败则标记该语言 unavailable，并继续后续语言段写入
  {python.command.output} = resolve_command_for_output({python.command.detected})
  写 [python]
  写 selected = "python3"
  写 command = {python.command.output}
  写 version = {python.version.stdout_raw}
```

强约束：

- 已选 `uv` 就只校验 `{python.command.detected}` 对应的 uv 入口，不再检查 `conda/python/python3/.venv/bin/python`。
- 已选 `venv` 就只校验既定 venv 入口（哪怕是 `.venv/bin/python`），不再回退 `uv` 或系统 python。

#### JavaScript 段模板（按 selected 拆分，单模板单入口）

使用规则（强制）：

- 维护时先确定 `javascript.selected`，然后只使用对应的单一模板。
- 禁止写成 `if/else if` 多分支运行时逻辑。

**模板 A：`javascript.selected = "bun"`**

```text
write_javascript_section_for_bun({javascript.command.detected}):
  执行 {javascript.version_probe = "{javascript.command.detected} --version"}
  若失败则标记该语言 unavailable，并继续后续语言段写入
  {javascript.command.output} = resolve_command_for_output({javascript.command.detected})
  写 [javascript]
  写 selected = "bun"
  写 command = {javascript.command.output}
  写 version = {javascript.version.stdout_raw}
```

**模板 B：`javascript.selected = "node"`**

```text
write_javascript_section_for_node({javascript.command.detected}):
  执行 {javascript.version_probe = "{javascript.command.detected} --version"}
  若失败则标记该语言 unavailable，并继续后续语言段写入
  {javascript.command.output} = resolve_command_for_output({javascript.command.detected})
  写 [javascript]
  写 selected = "node"
  写 command = {javascript.command.output}
  写 version = {javascript.version.stdout_raw}
```

#### Shell 段模板（按 selected 拆分，单模板单入口）

使用规则（强制）：

- 维护时先确定 `shell.selected`，然后只使用对应的单一模板。
- 禁止写成 `if/else if` 多分支运行时逻辑。

**模板 A：`shell.selected = "bash"`**

```text
write_shell_section_for_bash({shell.command.detected}):
  执行 {shell.version_probe = "{shell.command.detected} --version"}
  若失败则标记该语言 unavailable，并继续后续语言段写入
  {shell.command.output} = resolve_command_for_output({shell.command.detected})
  写 [shell]
  写 selected = "bash"
  写 command = {shell.command.output}
  写 version = {shell.version.stdout_raw_or_first_line}
```

**模板 B：`shell.selected = "zsh"`**

```text
write_shell_section_for_zsh({shell.command.detected}):
  执行 {shell.version_probe = "{shell.command.detected} --version"}
  若失败则标记该语言 unavailable，并继续后续语言段写入
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
  若失败则标记该语言 unavailable，并继续后续语言段写入
  {lang.command.output} = resolve_command_for_output({lang.command.detected})
  写 [{lang.name}]
  写 selected = {lang.selected}
  写 command = {lang.command.output}
  写 version = {lang.version.stdout_raw}
```

补充语言字段名与附加约束优先服从各自 reference；但“只校验既定事实、单语言失败不提前退出、无冗余日志”不变。

额外强约束（执行期）：

- 最终脚本中每个语言段只能有一个既定入口探测语句（`<detected_command> <version_arg>`）。
- 不允许在运行期基于“命令是否存在”切换到其他入口。

#### `session_env` 段模板

```text
write_session_env_vars({session_env_json_object}):
  写 [session_env.vars]
  对每个 {key, value}:
    写 {key} = "{toml_escaped(value)}"
```

这里回显的是 `scripts/session_env.json` 的设定值，不做推导、不补字段、不漏字段。

#### 典型事实组合示例（模板思路）

1. `{python.selected=uv, python.command.detected=uv}` + `{javascript.selected=bun}` + `{shell.selected=bash}`：仅校验三者既定入口并输出
2. `{python.selected=venv, python.command.detected=.venv/bin/python}` + `{javascript.selected=node}` + `{shell.selected=bash}`：Python 只校验该 venv 入口，并把 `command` 输出为短命令或绝对路径
3. `{python.selected=python, python.command.detected=/opt/py/bin/python}` + `{javascript.selected=node}` + `{shell.selected=zsh}`：按既定绝对路径校验，不做候补
4. 启用 Go 等补充语言：在基础三段后追加独立语言段，不混入基础段



### `check-agent-env` 失败处理

- 不做额外漂移检测与漂移输出。
- 单一语言环境检测失败时，不提前退出；继续完成其余语言段并输出完整 TOML。
- 语言不可用信息应体现在对应语言段字段值中，不输出冗余提示文本。
- 注意将 agent 是否继续执行后续任务的自主权交给 agent 与用户判断。
- 若 `scripts/session_env.json` 缺失或格式错误，应直接报错并非 0 退出。


## 补充其他语言环境规范

除了常规的 python node bash 探测结果外，本技能支持在满足条件时，确认额外的语言环境。

### Go 补充规范（满足条件时启用，非必选）

当出现以下任一场景时，本技能可以维护 Go 语言环境：

1. 主管理项目是 Go 项目
2. 用户明确要求初始化/重做 Go 环境
3. 与用户正确核对了 Go 的版本且本技能支持此版本

如果agent确认维护go 语言环境， agent **必须**阅读下面的文件以了解细节

- `reference/go/GO_ENV_REFERENCE.md`
- `reference/go/check-output/ENV_CHECK_OUTPUT_SPEC.md`

Go check 输出规范是对主规范的补充，不替代主规范。

补充约束：Go 场景下，agent 在维护 `check-agent-env.sh` 时必须先完成 `GOBIN/GOTOOLDIR` 工具清单固化，再按固化清单输出 `go.tools.*`（每项包含 `command` 与 `version`），会话运行阶段不再做目录枚举发现。

## AGENTS.md 集成（固定段落）
说明：本段是给“harness 初始化完成后、在该工作区内运行的业务 agent”使用的运行约束，不用于限制 `harness-init` agent 在维护本技能资产时的实现动作。


必须逐字维护以下段落（不允许改写、删改、同义替换）：

```markdown
### 会话启动一次性环境校验（每轮对话仅一次）

每个上下文session中，**仅执行一次以下步骤**：

执行环境校验脚本：`bash scripts/check-agent-env.sh`

约束：
- `scripts/shell_source.sh` 与 `scripts/session_env.json` 影响 bash 前置行为，仅允许通过 `harness-agent-env` 维护。
- 若缺失 `harness-agent-env` 管理，不允许agent修改这两个前置资产。不要求业务 agent 在会话中显式执行或显式说明其调用细节。
- 不允许agent主动使用 bash 工具 调用 `scripts/shell_source.sh` 与 `scripts/session_env.json` 资产 ，必须由agent运行时自动注入
```

## 校验说明（强制）

每次初始化或管理 `AGENTS.md` 后，必须执行以下校验并给出通过/不通过结论：

1. `AGENTS.md` 中必须存在且仅存在一个标题为 `### 会话启动一次性环境校验（每轮对话仅一次）` 的段落。
2. 该段落正文必须与“AGENTS.md 集成（固定段落）”中的 markdown 块逐字一致（含标点、空格、大小写与代码标记）。
3. 若 AGENTS.md 其他位置出现与该段语义重复或冲突的环境启动说明，必须删除重复/冲突内容，仅保留该标题下的一处完整说明。
4. 若任一项不通过，先修复 AGENTS.md 再进行后续流程。

## 输出结构（.tmp/env.json）

初始化阶段必须写入 `.tmp/env.json`，管理阶段按需写入。结构至少包含：

- 探测顺序与命中结果
- missing 列表
- Go（若触发）版本/关键路径/来源
- `scripts.check`、`scripts.shell_source`、`scripts.session_env` 路径
- `phase`（bootstrap/manage）
- `timestamp`
