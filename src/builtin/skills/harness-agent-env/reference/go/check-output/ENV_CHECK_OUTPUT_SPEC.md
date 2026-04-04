# Go 场景 check 输出补充规范（TOML）

本文档是 `check-agent-env.sh` 输出规范在 Go 场景下的补充说明。

主规范见：`../../check-output/ENV_CHECK_OUTPUT_SPEC.md`。

失败处理完全继承主规范（不做额外漂移检测；单语言失败不提前退出；仅脚本异常时非 0 退出）。

## 生效范围

- 仅在 Go 环境已启用时生效。
- 非 Go 场景不要求输出 `[go]` 与 `[go.env]`。

## 约束

1. `check-agent-env.sh` 的 stdout 必须为 TOML（继承主规范）。
2. 不得输出额外说明文本、建议、安装提示。
3. `command` 字段表示在 harness 工作区，进行 source 以及环境变量注入后的语言环境调用路径

## Go 补充 `check-agent-env.sh` 输出结构

Go 启用时必须包含：

```toml
# .... 前置内容
[go]
enabled = true
command = "go"
version = "go1.24.1"

[shell_env.vars]
# 所有 Go 环境设定已维护在 shell_env.json 中，会一起输出
```
