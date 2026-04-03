# check-agent-env 输出主规范（TOML）

本文档定义 `check-agent-env.sh` 的主输出格式，适用于基础环境（Python/JavaScript/Shell）。

## 生效范围

- 所有项目通用。
- 当前是主规范，仅包含 Python/JavaScript/Shell 三种语言环境的检查输出。
- 不包含可选其他语言，其他语言输出规范见 `reference/<language>/check-output/ENV_CHECK_OUTPUT_SPEC.md`。

## 约束

1. `check-agent-env.sh` 的 stdout 必须为 TOML。
2. 禁止输出额外说明文本、建议、安装提示。
3. 仅输出初始化或重做阶段已选定的可用链路。
4. `command` 表示当前目录可调用命令：
   - 在 PATH 内可直接调用时写短命令（如 `uv`、`bun`、`bash`）
   - 不可直接调用时写绝对路径
5. `command` 不带参数。

## 固定结构

```toml
schema_version = "1"

[python]
selected = "uv"        # uv | venv | python
command = "uv"
version = "..."

[javascript]
selected = "bun"       # bun | node
command = "bun"
version = "..."

[shell]
selected = "bash"      # bash | zsh
command = "bash"
version = "..."
```

## 失败处理

- 不做额外漂移检测与漂移输出。
- 若脚本执行发现环境不可用或与预期不符，应直接报错，打出日志，并在 stdio中警告 agent不得使用该语言环境
## 禁止项

- 不得输出调试日志、彩色提示、推荐文案。
- 若某语言环境不可用，不得中断整个探测进程
