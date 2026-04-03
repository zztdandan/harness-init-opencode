# Go 环境脚本参考文档

本文档提供 Go 1.20 和 Go 1.24 环境切换与工具安装的脚本说明，供 `harness-agent-env` 在初始化或重做 Go 环境时使用。

这些脚本用于快速准备 dedge 开发环境，支持多版本 Go 切换和私有模块配置。

**注意**：每个管理项目只使用一个 Go 版本（1.20 或 1.24），不会同时配置两个版本。

## 提供的脚本

- `scripts/switch_go120.sh`: 切换 shell 到 Go 1.20 环境
- `scripts/switch_go124.sh`: 切换 shell 到 Go 1.24 环境
- `scripts/install_go120_tools.sh`: 安装 Go 1.20 兼容工具
- `scripts/install_go124_tools.sh`: 安装 Go 1.24 工具
- `scripts/go_env_common.sh`: 共享的路径解析和环境设置工具函数

## check 输出补充规范

Go 启用时，`check-agent-env.sh` 的输出补充要求见：

- `check-output/ENV_CHECK_OUTPUT_SPEC.md`

该补充规范只在 Go 场景下生效，不应污染非 Go 基础输出约定。

## 路径配置策略

脚本支持三种路径来源（按优先级）：

1. **命令行参数**：直接传入 `<goroot> <gopath> <gobin>`
2. **环境变量**：`DEDGE_GO120_GOROOT`、`DEDGE_GO120_GOPATH`、`DEDGE_GO120_GOBIN`（或 124 版本）
3. **默认路径**：
   - Go 1.20 GOROOT: `/home/base/.gvm/gos/go1.20.14`
   - Go 1.24 GOROOT: `/home/base/.gvm/gos/go1.24.1`
   - GOPATH: `/home/base/repo/go120_mod` 或 `/home/base/repo/go124_mod`
   - GOBIN: `${GOPATH}/bin`

**Agent 使用建议**：
- 优先询问用户获取路径配置（GOROOT/GOPATH/GOBIN/GOPRIVATE/GOMODCACHE）
- 用户未提供时，先尝试默认路径
- 默认路径不存在时，使用 `go env` 获取当前环境配置
- 将用户提供或探测到的路径作为参数传递给脚本

## 环境发现流程（当默认路径失效时）

当默认路径不存在时，按以下顺序发现 Go 环境：

1. **检查当前活动的 Go 运行时**：
```bash
command -v go
go version
go env GOROOT GOPATH GOBIN GOMODCACHE
```

2. **枚举 PATH 中所有 Go 二进制**：
```bash
type -a go
```

3. **探测常见安装管理器位置**：
```bash
ls -d ~/.gvm/gos/go* ~/.asdf/installs/golang/* ~/sdk/go* /usr/local/go /opt/homebrew/Cellar/go/*/libexec 2>/dev/null
```

4. **有界搜索用户目录**：
```bash
find ~ -maxdepth 6 -type f -path '*/bin/go' 2>/dev/null
```

5. **发现工具二进制推断 GOBIN**：
```bash
command -v gopls goimports golangci-lint dlv 2>/dev/null
```

**版本选择规则**：
- Go 1.20 项目：选择 `go version` 输出以 `go1.20` 开头的 Go 二进制
- Go 1.24 项目：选择 `go version` 输出以 `go1.24` 开头的 Go 二进制
- 优先使用 `go env` 的 GOPATH/GOBIN；如果为空，使用发现的工具所在目录
- 多个候选冲突时，询问用户确认

## 脚本调用方式

**切换环境脚本**（必须使用 `source`）：
```bash
source scripts/switch_go120.sh [goroot] [gopath] [gobin]
source scripts/switch_go124.sh [goroot] [gopath] [gobin]
```

**工具安装脚本**（使用 `bash` 执行）：
```bash
bash scripts/install_go120_tools.sh [goroot] [gopath] [gobin]
bash scripts/install_go124_tools.sh [goroot] [gopath] [gobin]
```

参数说明：
- 所有参数可选
- 未提供参数时，脚本按 环境变量 → 默认路径 顺序解析
- Agent 应将用户提供或探测到的路径作为参数传递

## 可选环境变量

可通过环境变量预设路径（脚本会自动检查）：

- `DEDGE_GO120_GOROOT`, `DEDGE_GO120_GOPATH`, `DEDGE_GO120_GOBIN`
- `DEDGE_GO124_GOROOT`, `DEDGE_GO124_GOPATH`, `DEDGE_GO124_GOBIN`

## 脚本设置的通用环境变量

`go_env_common.sh` 中的 `setup_go_env_common` 函数会设置以下环境变量：

- `GOTOOLCHAIN=local`
- `GOPROXY=https://goproxy.cn,direct`
- `GOPRIVATE=gitlab-c7n.lgdxtech.com`（默认值）
- `GONOPROXY=gitlab-c7n.lgdxtech.com`
- `GONOSUMDB=gitlab-c7n.lgdxtech.com`
- `GOSUMDB=sum.golang.org`
- `GO111MODULE=on`
- `CGO_ENABLED=1`

**注意**：`GOPRIVATE` 等私有模块设置默认为 `gitlab-c7n.lgdxtech.com`。仅当用户明确要求使用不同的私有模块配置时，Agent 才需要在 `scripts/init-agent-env.sh` 中覆盖这些值。

## 重要规则

- `switch_*` 脚本必须使用 `source` 执行，不能用 `bash`
- `install_*` 脚本使用 `bash` 执行
- 脚本不会改变当前工作目录
- 脚本会自动创建 GOPATH 和 GOBIN 目录（如果不存在）
- 脚本会将 `${GOROOT}/bin` 和 `${GOBIN}` 添加到 PATH 前端
