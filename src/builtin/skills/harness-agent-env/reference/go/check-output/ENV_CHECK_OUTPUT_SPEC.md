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
4. Go 启用时必须输出 `go.tools` 子树，用于一次性展示 Go 工具可用性。
5. `go.tools` 仅使用“维护阶段已固化”的工具清单，不在每次会话运行时重新枚举目录。

## Go 补充 `check-agent-env.sh` 输出结构

Go 启用时必须包含：

```toml
# .... 前置内容
[go]
enabled = true
command = "go"
version = "go1.24.1"
gobin = "/home/base/repo/go124_mod/bin"
gotooldir = "/home/base/.gvm/gos/go1.24.1/pkg/tool/linux_amd64"

[go.tools.gopls]
source = "gobin"
command = "/home/base/repo/go124_mod/bin/gopls"
probe = "version"
version = "gopls v0.18.1"

[go.tools."golangci-lint"]
source = "gobin"
command = "/home/base/repo/go124_mod/bin/golangci-lint"
probe = "version"
version = "golangci-lint has version v1.64.8"

[go.tools.compile]
source = "gotooldir"
command = "/home/base/.gvm/gos/go1.24.1/pkg/tool/linux_amd64/compile"
probe = "exists"
version = "exists"

[shell_env.vars]
# 所有 Go 环境设定已维护在 shell_env.json 中，会一起输出
```

说明：

- `source` 取值：`gobin` 或 `gotooldir`。
- `probe` 取值：`version` 或 `exists`。
- 若 `probe = "version"` 且命令不可用，`version = "unavailable"`。
- 若 `probe = "exists"`：存在时 `version = "exists"`，不存在时 `version = "unavailable"`。
- 对于包含连字符的工具名，TOML 键必须使用引号（如 `"golangci-lint"`）。
