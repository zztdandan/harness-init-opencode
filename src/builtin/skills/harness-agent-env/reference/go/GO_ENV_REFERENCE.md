# Go 环境维护文档

本文档提供 Go 1.20 和 Go 1.24 环境探测与工具安装的脚本说明，供 `harness-agent-env` 在初始化或重做 Go 环境时使用。

这些脚本用于快速准备 dedge 开发环境，支持多版本 Go 切换和私有模块配置。

**注意**：每个管理项目只使用一个 Go 版本（1.20 或 1.24），不会同时配置两个版本。


## check 输出补充规范

Go 启用时，`check-agent-env.sh` 的输出补充要求见：

- `check-output/ENV_CHECK_OUTPUT_SPEC.md`

该补充规范只在 Go 场景下生效，不应污染非 Go 基础输出约定。

## go环境额外技能工作流程

当满足 go场景触发条件时，进行以下步骤：

1. 确认用户需要维护的是 go 语言的哪套版本环境，若用户要求非本技能支持的 1.20 1.24 版本环境，则告知用户当前版本不受支持，由用户自行维护资产，退出 go 语言环境维护流程
2. 软门禁：要求用户给出 几个关键的 go环境配置，即 `GOBIN` go 执行文件路径，`GOPROXY` 配置，`GOPRIVATE` 配置，以及 go该版本的独立模块缓存路径（`GOMODCACHE`），用户同样可以给出其他他认为需要的 go 环境配置项，但是没有上述几项关键，agent 可自动从下文默认路径中直接使用。
   - 优先使用用户给出的内容
   - 若用户不给出，则按照下文的默认路径探测
   - 若默认路径下探测结果不存在或不符合版本，则按照环境发现流程探测
3. 在探测好所有环境后，增补 `scripts/shell_env.json`：维护 bash 工具自动注入的go运行环境变量键值，包含所有关键 go env 环境变量（go语言的所有环境均可通过环境变量设置，故仅需维护这个文件即可注入所有探测到的go环境）
3. 使用参考脚本中的工具相关脚本，检测及补充 go 工具的安装（工具安装前需临时设置好所有环境，根据上个步骤的最后探测结果）
4. 若没有特殊要求，跳过增补维护`scripts/shell_source.sh`：go的几乎所有参数均通过环境变量配置，若用户没有特殊要求，这个脚本没有 go相关配置需要维护
5. `scripts/check-agent-env.sh`：根据 `check-output/ENV_CHECK_OUTPUT_SPEC.md` 的规范编写探测脚本，输出 Go 环境的探测结果
   - 在编写/维护脚本阶段，必须先探索并固化两个目录：
     - `GOBIN`（如 `${GOPATH}/bin`）
     - `GOTOOLDIR`（通常 `${GOROOT}/pkg/tool/${GOOS}_${GOARCH}`）
   - 基于上述目录生成“Go 工具清单 + 探测方式”到脚本内（或等价的静态配置），会话运行时只执行清单里的探测语句，不再重新枚举目录。
   - 输出至少包括每个工具的 `command` 与 `version`；不支持版本输出的工具使用 `probe=exists` 并按补充输出规范格式化。
6. 在 harness 工作区的 AGENTS.md 中，无需为 go语言维护额外文字及段落，遵从主规范的维护即可
7. 由于主流程中已经存在 运行`scripts/check-agent-env.sh`的相关流程，go环境维护仅需确认额外的go环境结果是否正确即可


## 环境发现流程（用户不指定，默认设定探测不到）

当默认路径不存在时，请参考以下顺序发现 Go 环境：

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

6. **定位 Go 工具目录（GOTOOLDIR）**：
```bash
go env GOTOOLDIR GOOS GOARCH
```

7. **维护阶段枚举并固化工具清单（仅在维护阶段执行）**：
```bash
ls -1 "${GOBIN}"
ls -1 "${GOTOOLDIR}"
```

说明：会话执行 `check-agent-env.sh` 时，不应再次通过 `ls/find/type -a` 做目录发现；只运行已固化工具清单对应的探测命令。

**版本选择规则**：
- Go 1.20 项目：选择 `go version` 输出以 `go1.20` 开头的 Go 二进制
- Go 1.24 项目：选择 `go version` 输出以 `go1.24` 开头的 Go 二进制
- 优先使用 `go env` 的 GOPATH/GOBIN；如果为空，使用发现的工具所在目录
- 多个候选冲突时，询问用户确认

## 脚本参考

- `scripts/install_go120_tools.sh`: 安装 Go 1.20 兼容工具,已锁定工具版本确认1.20兼容性
- `scripts/install_go124_tools.sh`: 安装 Go 1.24 工具,工具版本与 1.24 兼容
- `scripts/go_env_common.sh`: 共享的路径解析和环境设置工具函数

**工具安装脚本**（使用 `bash` 执行）：
参数由前面探索过程中得出的 go 环境参数得知
```bash
bash scripts/install_go120_tools.sh [goroot] [gopath] [gobin]
bash scripts/install_go124_tools.sh [goroot] [gopath] [gobin]
```

参数说明：
- 所有参数可选
- 未提供参数时，脚本按 环境变量 → 默认路径 顺序解析
- Agent 应将用户提供或探测到的路径作为参数传递


## 脚本设置的通用环境变量默认值

当用户未提供任何参数（不传 `<goroot> <gopath> <gobin>`，且未设置 `DEDGE_GO*_GOROOT/GOPATH/GOBIN`）时，`switch_go120.sh`、`switch_go124.sh` 与 `install_go*_tools.sh` 使用的缺省值，以及应该设置到 `shell_env.json`的环境变量如下。

### Go 1.20 缺省值

- `GOROOT=/home/base/.gvm/gos/go1.20.14`
- `GOPATH=/home/base/repo/go120_mod`
- `GOBIN=${GOPATH}/bin`（即 `/home/base/repo/go120_mod/bin`）
- `GOTOOLCHAIN=local`
- `GOPROXY=https://goproxy.cn,direct`
- `GOPRIVATE=gitlab-c7n.lgdxtech.com`
- `GONOPROXY=gitlab-c7n.lgdxtech.com`
- `GONOSUMDB=gitlab-c7n.lgdxtech.com`
- `GOSUMDB=sum.golang.org`
- `GO111MODULE=on`
- `CGO_ENABLED=1`
- `GOMODCACHE`：脚本未显式导出，沿用 Go 默认值（通常为 `${GOPATH}/pkg/mod`）

### Go 1.24 缺省值

- `GOROOT=/home/base/.gvm/gos/go1.24.1`
- `GOPATH=/home/base/repo/go124_mod`
- `GOBIN=${GOPATH}/bin`（即 `/home/base/repo/go124_mod/bin`）
- `GOTOOLCHAIN=local`
- `GOPROXY=https://goproxy.cn,direct`
- `GOPRIVATE=gitlab-c7n.lgdxtech.com`
- `GONOPROXY=gitlab-c7n.lgdxtech.com`
- `GONOSUMDB=gitlab-c7n.lgdxtech.com`
- `GOSUMDB=sum.golang.org`
- `GO111MODULE=on`
- `CGO_ENABLED=1`
- `GOMODCACHE`：脚本未显式导出，沿用 Go 默认值（通常为 `${GOPATH}/pkg/mod`）

**补充约定**：`GOPRIVATE`、`GONOPROXY`、`GONOSUMDB` 默认为 `gitlab-c7n.lgdxtech.com`。仅当用户明确要求其他私有模块域名或代理策略时，Agent 才在 `scripts/shell_env.json`中设置其他值

**强制校验**: 必须在 `shell_env.json` 中显式维护上述所有缺省环境变量，不得使用系统默认参数，要求在 `scripts/check-agent-env.sh` 中`[shell_env.vars]`成功打出这些环境变量(这部分的打印不是读取环境变量而是显式读取 `shell_env.json`kv的 )方算生效

## Go 工具清单固化规则（新增）

为保证会话首轮可直接获得 Go 工具状态，`check-agent-env.sh` 在 Go 场景下必须遵循以下规则：

1. 维护阶段一次性完成工具发现，并固化为脚本中的静态清单（或等价静态数据结构）。
2. 工具来源分两类：
   - `gobin`：用户安装工具（如 `gopls`、`goimports`、`golangci-lint`、`dlv`，以及其他已安装工具）
   - `gotooldir`：Go toolchain 工具（如 `compile`、`link`、`vet`、`cover` 等）
3. 每个工具必须预定义：
   - `command`（短命令或绝对路径）
   - `probe`（`version` 或 `exists`）
4. 会话执行阶段仅允许按清单执行探测，不允许动态扩展清单。
5. 输出格式遵循 `check-output/ENV_CHECK_OUTPUT_SPEC.md` 的 `go.tools.*` 结构，确保每项均有 `command` 与 `version` 字段。

### 推荐探测命令模板

- `probe=version`：优先 `<command> version`，其次 `<command> --version`
- `probe=exists`：仅检测可执行文件存在与可执行权限（`-x`）

探测失败统一写 `version = "unavailable"`，并继续输出其他工具结果。

## 重要规则

- `switch_*` 脚本必须使用 `source` 执行，不能用 `bash`
- `install_*` 脚本使用 `bash` 执行
- 脚本不会改变当前工作目录
- 脚本会自动创建 GOPATH 和 GOBIN 目录（如果不存在）
- 脚本会将 `${GOROOT}/bin` 和 `${GOBIN}` 添加到 PATH 前端
