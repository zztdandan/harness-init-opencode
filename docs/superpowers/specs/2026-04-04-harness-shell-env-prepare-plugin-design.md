# Harness Shell Env Prepare Plugin Design

日期：2026-04-04  
状态：对话已确认，待进入实现计划阶段

## 1. 目标与范围

新增一个常驻启用的 OpenCode 插件 `harness_shell_env_prepare_plugin`，用于在每次 `bash` 工具执行前完成 shell 环境准备，补全当前 `harness_init` 只负责初始化与资产生成、但不负责稳定会话注入的闭环。

该插件必须：

- 只消费工作区内已存在的资产，不负责创建、修复或回写资产
- 在会话开始时读取 JSON 资产，并将环境变量固化为本会话内存态缓存
- 在每次 `bash` 前通过 `shell.env` 注入缓存中的环境变量
- 在每次 `bash` 前通过命令改写，在同一个 shell 中 `source` 固定脚本资产
- 整体采取宽松降级策略：资产缺失、解析失败、脚本失败都不阻断原始命令

本设计覆盖：

- 插件职责与生命周期
- 资产契约
- Hook 协作方式
- 缓存语义
- 命令改写策略
- 构建产物与测试边界

本设计不包含：

- 由该插件生成或修复 `scripts/session_env.json`
- 由该插件生成或修复 `scripts/shell_source.sh`
- 在会话中途监听文件变更并刷新 JSON 缓存
- 将 shell source 路径放入 JSON 配置中

## 2. 产品决策（最终）

- 新增插件名：`harness_shell_env_prepare_plugin`
- 交付形态：同时支持源码加载与 `dist` 编译产物加载
- 源码挂载入口：`src/shell-env-prepare-index.ts`
- dist 挂载入口：`dist/harness_shell_env_prepare_plugin.js`
- 构建方式：与 `harness_init` 共用一个 `build` 命令
- 构建产物：`dist/` 下同时输出两个 JS 入口
- `session_env.json` 结构：`{ schema, env }`
- `schema` 正式值：`harness-shell-env/v1`
- 固定 shell source 脚本路径：`scripts/shell_source.sh`
- `env` 缓存语义：会话开始时读取一次，之后整场会话只使用内存缓存
- `shell_source.sh` 语义：每次 `bash` 前实时 `source`，不缓存脚本内容
- 错误策略：全部宽松降级，不阻断原始 `bash`

## 3. 系统架构

### 3.1 插件边界

当前系统拆分为两个插件：

1. `harness_init`
   - 仅在初始化或调整时启用
   - 负责生成与维护技能资产、JSON 资产、脚本资产及 AGENTS.md 相关段落

2. `harness_shell_env_prepare_plugin`
   - 常驻启用
   - 负责读取既有资产，并在运行期对 `bash` 工具做环境准备

两者共享同一仓库、同一构建命令，但运行职责完全分离。

### 3.2 Hook 协作模型

本插件采用“多 hook + 共享状态”模式，而不是“hook 动态改写 hook”：

- `event` hook 监听 `session.created`：负责读取 `scripts/session_env.json` 并刷新内存缓存
- `shell.env`：负责将当前缓存写入 `output.env`
- `tool.execute.before`：负责在 `bash` 命令字符串前拼接 `source` 相关脚本的命令

即：

- 改写的是 hook 读取的数据，而不是 hook 函数体本身
- JSON 环境变量是“会话固化态”
- shell source 脚本是“命令实时态”

## 4. 资产契约

### 4.1 工作区资产

由 `harness_init` 维护、由常驻插件消费的资产如下：

- `scripts/session_env.json`
- `scripts/shell_source.sh`

这里的路径根统一定义为插件运行时上下文中的 `worktree`，即 Git 工作树根目录，而不是当前 shell 命令的 `cwd`。因此即使用户在子目录执行命令，资产仍固定解析为：

- `<worktree>/scripts/session_env.json`
- `<worktree>/scripts/shell_source.sh`

常驻插件只读取这些资产，不负责：

- 创建缺失文件
- 回写或修复非法内容
- 追加默认值
- 迁移旧格式

### 4.2 JSON Schema 契约

`scripts/session_env.json` 的正式结构如下：

```json
{
  "schema": "harness-shell-env/v1",
  "env": {
    "KEY": "value"
  }
}
```

字段约束：

- `schema`
  - 必填
  - 类型必须为字符串
  - 当前唯一合法值为 `harness-shell-env/v1`
- `env`
  - 必填
  - 类型必须为对象
  - 值表示本会话需要注入到 `output.env` 的环境变量集合

### 4.3 Shell 脚本契约

`scripts/shell_source.sh` 的约束如下：

- 路径固定且可审查
- 内容不进入 JSON
- 内容由初始化侧或人工维护
- 常驻插件每次 `bash` 前都按固定路径 `source` 它

这个脚本用于承载不能仅靠 KV 环境变量表达的 shell 语义，例如：

- 激活虚拟环境
- 追加 `PATH`
- 定义 shell 函数或别名
- 运行轻量且幂等的 shell 初始化逻辑

## 5. 运行时语义

### 5.1 会话启动阶段

插件在初始化时建立空缓存，并在 `event` hook 收到 `session.created` 时完成一次 JSON 装载：

1. 定位工作区下的 `scripts/session_env.json`
2. 尝试读取文件内容
3. 解析并校验 `schema`
4. 校验 `env` 是否为对象
5. 过滤非法 key 与不可用 value
6. 将结果固化到本会话内存缓存 `envCache`

若任一步失败，则：

- 不抛出 fatal 错误
- 将 `envCache` 退化为空对象
- 后续 `shell.env` 注入为空

### 5.2 每次 bash 前的 `shell.env`

每次触发 `bash` 之前：

- `shell.env` 只读取内存中的 `envCache`
- 将 `envCache` 合并到 `output.env`
- 当 `envCache` 中的 key 与 `output.env` 现有 key 冲突时，以 `envCache` 为准并覆盖原值
- 不重新读取 `scripts/session_env.json`

这保证：

- JSON 文件是“会话时快照”
- 中途编辑 JSON 不会影响本会话
- 每次命令前注入成本稳定且低

### 5.3 每次 bash 前的 `tool.execute.before`

`tool.execute.before` 只处理 `bash` 工具，不影响其他工具。

当目标工具为 `bash` 且存在非空原始 `args.command` 时，插件将命令改写为同一个 shell 中顺序执行的单条命令：

```sh
. "<worktree>/scripts/shell_source.sh" >/dev/null 2>&1 || true; <original command>
```

该设计必须满足：

- `source`/`.` 与原始命令处于同一个 shell 上下文
- 即便脚本不存在或执行失败，也不阻断原始命令
- 脚本内容不缓存，因此会话内修改 `scripts/shell_source.sh` 后，后续命令可立即生效

这里不能采用“先独立执行脚本，再单独执行原命令”的实现，因为那样 `source` 带来的 shell 状态不会传递到原命令。

## 6. 解析与过滤规则

### 6.1 顶层 JSON 校验

按以下顺序处理：

1. 文件不存在：跳过，`envCache = {}`
2. 文件读取失败：跳过，`envCache = {}`
3. JSON 解析失败：跳过，`envCache = {}`
4. 根值不是对象或为数组：跳过，`envCache = {}`
5. `schema !== "harness-shell-env/v1"`：跳过，`envCache = {}`
6. `env` 不是对象或为数组：跳过，`envCache = {}`

### 6.2 环境变量过滤

`env` 中的键值对按以下规则过滤：

- key 必须匹配：`^[A-Za-z_][A-Za-z0-9_]*$`
- value 为 `null` 或 `undefined` 时忽略
- 其余 value 统一通过 `String(value)` 转为字符串
- 最终仅将通过过滤的项写入 `envCache`

这样可以保证：

- 注入内容稳定、可预期
- 非法环境变量名不会污染运行期
- JSON 中的数字、布尔值也可显式降格为字符串环境变量

## 7. 错误处理策略

本插件整体采用非阻断设计。

### 7.1 Recoverable 情况

以下情况都视为可恢复：

- `scripts/session_env.json` 缺失
- `scripts/session_env.json` 非法
- `schema` 不匹配
- `env` 非对象
- 某些 `env` key/value 无效
- `scripts/shell_source.sh` 缺失
- `scripts/shell_source.sh` 执行失败

恢复方式统一为：

- JSON 侧：退化为不注入任何额外环境变量
- shell 侧：继续执行原始命令

### 7.2 不做的事情

为保持职责边界清晰，本插件不做以下补救动作：

- 不尝试生成默认 JSON
- 不尝试生成默认 shell 脚本
- 不在运行期修改用户资产文件
- 不根据失败原因切换到其他脚本路径

## 8. 构建与目录规划

### 8.1 源码目录

建议在现有源码布局上扩展第二个入口及其运行时处理器：

```text
src/
  index.ts
  shell-env-prepare-index.ts
  plugin-factory.ts
  shell-env-prepare-plugin-factory.ts
  handlers/
    config-handler.ts
    shell-env-session-handler.ts
    shell-env-hook-handler.ts
  builtin/
    agents/
    skills/
    templates/
```

说明：

- `harness_init` 继续使用现有入口与工厂
- 新插件使用独立入口与工厂，避免运行时职责混叠
- shell 环境准备相关逻辑再拆为“会话缓存装载”和“hook 改写”两类处理器

### 8.2 dist 产物

一次 `build` 后输出：

- `dist/harness_init.js`
- `dist/harness_shell_env_prepare_plugin.js`

同时继续复制 `builtin` 资产，以保持现有初始化插件的 dist 加载能力。

加载契约明确为：

- 源码级挂载时，消费者直接挂载 `src/shell-env-prepare-index.ts`
- dist 挂载时，消费者直接挂载 `dist/harness_shell_env_prepare_plugin.js`
- 本次设计不要求新增 npm package subpath exports；以文件路径挂载为准，保持与当前 `harness_init` 使用方式一致

## 9. 测试策略

### 9.1 单元测试

新增单测覆盖以下行为：

1. JSON 文件缺失时缓存为空
2. JSON 非法时缓存为空
3. `schema` 不匹配时缓存为空
4. `env` 非对象时缓存为空
5. key/value 过滤正确
6. 合法 `env` 被写入缓存
7. `shell.env` 只消费缓存，不重复读文件
8. `tool.execute.before` 仅改写 `bash` 命令
9. 改写结果使用同 shell 前缀形式
10. 原始命令在 source 失败时仍会继续执行

### 9.2 入口与构建测试

新增测试覆盖：

- 第二插件入口可创建并暴露预期 hook
- `resolveBuiltinPaths` / 新路径解析逻辑不影响现有入口
- `bun run build` 后同时存在两个 dist 入口

### 9.3 e2e 验证边界

如当前 e2e 框架可承载，增加以下验证：

- 新插件被挂载后可出现在运行时调试输出中
- 针对 `bash` 的执行前改写包含固定 `scripts/shell_source.sh` 前缀

若现有调试能力无法直接观察命令改写结果，则以单元测试保证命令字符串改写语义，避免为此引入过重的 e2e 基础设施。

## 10. 验收标准

1. 新增常驻插件 `harness_shell_env_prepare_plugin`
2. `build` 一次产出两个 dist 入口
3. 常驻插件不创建、不修复、不回写资产
4. 会话开始时读取 `scripts/session_env.json` 并缓存
5. `shell.env` 每次 `bash` 前注入缓存环境变量
6. `tool.execute.before` 每次 `bash` 前在同一 shell 中 `source` `scripts/shell_source.sh`
7. `scripts/shell_source.sh` 缺失或失败不阻断原命令
8. `scripts/session_env.json` 缺失、非法或 schema 不匹配时，插件宽松降级
9. 会话内修改 JSON 不立即生效；会话内修改 `scripts/shell_source.sh` 对后续命令立即生效
10. 保持现有 `harness_init` 行为不回归

## 11. 下一阶段实现要点

- 为第二插件新增独立入口与工厂
- 接入 `event` hook 的 `session.created` 事件以完成一次性缓存刷新
- 实现 JSON 解析、过滤与内存缓存
- 实现 `shell.env` 注入与 `tool.execute.before` 命令改写
- 更新 `build` 命令，使其同时输出两个插件入口
- 补齐单测与必要的 dist/e2e 验证
