# check-agent-env 输出主规范（TOML）

本文档定义 `check-agent-env.sh` 的主输出格式，适用于基础环境（Python/JavaScript/Shell）以及 `shell_env.json` 变量回显。

## 生效范围

- 所有项目通用。
- 当前是主规范，包含 Python/JavaScript/Shell 三种语言环境的检查输出，以及 `script/shell_env.json` 中变量清单输出。
- 不包含可选其他语言，其他语言输出规范见 `reference/<language>/check-output/ENV_CHECK_OUTPUT_SPEC.md`。

## 约束

1. `check-agent-env.sh` 的 stdout 必须为 TOML。
2. 禁止输出额外说明文本、建议、安装提示。
3. 仅输出初始化或重做阶段已选定的链路。
4. `command` 表示当前目录可调用命令：
   - 在 PATH 内可直接调用时写短命令（如 `uv`、`bun`、`bash`）
   - 不可直接调用时写绝对路径
5. `command` 不带参数。
6. 必须输出 `shell_env` 段，打印 `script/shell_env.json` 中全部变量。
7. 任一单语言探测失败不得中断整体输出；必须继续完成全部语言段输出。
8. 单语言探测失败时，对应语言段 `version` 统一写 `"unavailable"`。

## 固定结构

```toml
schema_version = "1"

[python]
selected = "uv"        # 可为 uv | conda | venv | python | python3
command = "uv"         # 如实反应使用 哪个命令（可能带路径）运行的 python环境入口
version = "..."        # 如实反应使用 命令查看 version 后的返回值

[javascript]
selected = "bun"       # bun | node
command = "bun"
version = "..."

[shell]
selected = "bash"      # bash | zsh
command = "bash"
version = "..."


[shell_env.vars]
# 如实反应读取 script/shell_env.json 后的全部变量键值对
UV_PROJECT_ENVIRONMENT = "/abs/path/to/workspace/.venv"

```


## 禁止项

- 不得输出调试日志、彩色提示、推荐文案。
- 若某语言环境不可用，不得中断整个探测进程；该语言段 `version` 写 `"unavailable"`。
- 不得遗漏 `shell_env.vars` 中任一已设定变量。
