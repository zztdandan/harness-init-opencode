# Go 场景 check 输出补充规范（TOML）

本文档是 `check-agent-env.sh` 输出规范在 Go 场景下的补充说明。

主规范见：`../../check-output/ENV_CHECK_OUTPUT_SPEC.md`。

失败处理完全继承主规范（不做额外漂移检测；异常直接报错并非 0 退出）。

## 生效范围

- 仅在 Go 环境已启用时生效。
- 非 Go 场景不要求输出 `[go]` 与 `[go.env]`。

## 约束

1. `check-agent-env.sh` 的 stdout 必须为 TOML（继承主规范）。
2. 不得输出额外说明文本、建议、安装提示。
3. `command` 字段表示在 harness 工作区的调用路径：
   - 在 PATH 内可直接调用时写短命令（如 `go`）
   - 不可直接调用时写绝对路径（如 `/home/base/.gvm/gos/go1.24.1/bin/go`）
4. `command` 不带参数。

## Go 段固定键

Go 启用时必须包含：

```toml
[go]
enabled = true
command = "go"
version = "go1.24.1"

[go.env]
GOROOT = "/home/base/.gvm/gos/go1.24.1"
GOPATH = "/home/base/repo/go124_mod"
GOBIN = "/home/base/repo/go124_mod/bin"
GOMODCACHE = "/home/base/repo/go124_mod/pkg/mod"
GOPRIVATE = "gitlab-c7n.lgdxtech.com"
GONOPROXY = "gitlab-c7n.lgdxtech.com"
GONOSUMDB = "gitlab-c7n.lgdxtech.com"
```

## 与基础段关系

基础段（`[python]`、`[javascript]`、`[shell]`）遵循主规范；本补充文档只约束 Go 增量字段。
