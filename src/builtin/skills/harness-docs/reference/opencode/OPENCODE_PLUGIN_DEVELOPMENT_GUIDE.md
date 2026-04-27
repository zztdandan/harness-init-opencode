# OpenCode Plugin Development Guide

日期：2026-04-14  
依据：OpenCode 插件工程的通用抽象与可迁移实践（不依赖特定业务仓库）

## 1. 文档目标

这份文档面向的是 **OpenCode 通用插件开发**，不是某一个业务插件的实施说明。

它的目标是：即使你脱离本仓库，在一个全新的业务场景中，也能直接使用本文的方法搭建、验证和维护插件。

读者假设：

1. 可能完全没有 OpenCode 插件开发经验；
2. 可能知道 `agent / skill / tool` 这些概念，但不知道它们在插件项目中如何落地；
3. 需要从“项目怎么搭起来”一直看到“怎么验证它真的生效”。

这份文档重点回答六类问题：

1. OpenCode 插件项目架构应该怎么组织；
2. `agent`、`skill`、`tool`、hooks 与 builtin 资产如何协作；
3. 一个仓库如何编译一个或多个插件；
4. 一个插件项目的 `README.md` 应该怎么写；
5. 如何测试插件是否真的在 OpenCode 运行时生效；
6. skill 如何同时承担“初始化资产”和“持续维护资产”的职责。

注意：本仓库中的实现只作为**工程参考样本**，不是所有插件都必须照抄的唯一结构。

## 1.1 可迁移性约束（阅读本文时的默认前提）

为了保证文档可迁移，后文所有设计建议都遵循以下约束：

1. 不依赖某个固定业务术语、固定目录名或固定 schema 名称；
2. 不假设你必须复用本仓库的 agent 名称、skill 名称、文件命名；
3. 代码示例优先展示“结构和契约”，而不是“本仓库业务文本”；
4. 任何路径示例都可以替换为你的插件目录，只保留工程关系；
5. 若需要完整示例代码，应优先阅读配套文档 `OPENCODE_PLUGIN_DEVELOPMENT_REFERENCE_EXAMPLES.md`。

---

## 2. 核心认知模型

理解 OpenCode 插件时，最重要的认知不是“它是一个 js 文件”，而是：

**它是一个在运行时向 OpenCode 注入能力和配置的打包系统。**

一个插件可能做的事包括：

1. 注册自定义 `tool`；
2. 注入一个或多个 `agent`；
3. 暴露内置 `skill`；
4. 合并运行时 `permission`；
5. 响应 `event`、`shell.env` 等 hook；
6. 携带 prompt、template、reference 等静态资产。

因此，一个成熟的 OpenCode 插件项目通常不是“只有代码”，而是至少包含两层：

### 2.1 Runtime Layer

这一层是可执行代码，通常是 TypeScript。

职责包括：

- 创建插件入口；
- 解析运行时路径；
- 合并配置；
- 处理 hook；
- 注册工具；
- 维护会话级状态。

### 2.2 Builtin Content Layer

这一层是插件随包分发的静态内容，包括：

- `agents/*.md`
- `skills/**/SKILL.md`
- `templates/*.md`
- `reference/*.md`

很多插件“代码没问题但运行失败”，本质上不是逻辑 bug，而是这层内容没有正确打包、复制、解析或注入。

---

## 3. 项目架构建议

## 3.1 推荐基线结构

下面这个结构是通用推荐，不是硬性规范：

```text
your-plugin-repo/
  src/
    index.ts
    plugin-factory.ts
    handlers/
      config-handler.ts
      tool-handler.ts
      event-handler.ts
      shell-handler.ts
    tools/
      your-tool.ts
    builtin/
      agents/
        your-agent.md
      skills/
        your-skill/
          SKILL.md
          reference/
            *.md
      templates/
        *.md
  tests/
    opencode/
      unit/
      e2e/
  dist/
  package.json
  tsconfig.json
  README.md
```

推荐这样拆的原因是：OpenCode 插件最常见的问题往往集中在以下三个点：

1. 入口路径错误；
2. 配置 merge 逻辑错误；
3. builtin 资产未正确打包。

把这些职责拆开，后续调试与测试会容易很多。

## 3.2 各目录职责

- `src/index.ts`：插件入口，尽量保持极薄
- `src/plugin-factory.ts`：组装 hooks 与运行时依赖
- `src/handlers/config-handler.ts`：负责 `config` 注入与 merge
- `src/handlers/*`：负责事件、shell、tool 等专项逻辑
- `src/tools/*`：自定义工具实现
- `src/builtin/agents/*`：插件自带 agent prompt
- `src/builtin/skills/*`：插件自带 skill 与 reference
- `src/builtin/templates/*`：模板型内容
- `tests/opencode/unit/*`：单元测试
- `tests/opencode/e2e/*`：真实 OpenCode CLI 黑盒测试

---

## 4. 主要能力如何拼起来

## 4.1 插件入口怎么写

插件入口文件应尽量只做三件事：

1. 解析当前模块文件位置；
2. 基于当前文件位置解析 builtin 资产路径；
3. 调用工厂函数返回插件实例。

参考模式：

```ts
import { fileURLToPath } from "node:url"
import { createPlugin, resolveBuiltinPaths } from "./plugin-factory"

const runtimeFile = fileURLToPath(import.meta.url)
const runtimePaths = resolveBuiltinPaths(runtimeFile)

export default async () => createPlugin(runtimePaths)
```

这个模式的价值：

1. 同时适配源码加载和 dist 加载；
2. 避免写死绝对路径；
3. 把路径决策集中到工厂层，减少入口膨胀。

## 4.2 `config` hook 的核心职责

很多插件的核心集成点其实不是 tool，而是 `config` hook。

典型职责包括：

1. 注入 `skills.paths`；
2. 注入 `agent.*`；
3. 注入默认权限；
4. 保留用户原有配置；
5. 保证重复执行仍稳定。

这一层最重要的原则只有一句：

**永远做 merge，不要做覆盖式写入。**

建议流程：

1. clone 输入配置；
2. 只追加缺失字段；
3. 不覆盖不属于插件完全拥有的配置分支；
4. 让重复注入结果保持幂等。

> ⚠️ 关键实现细节（必须遵守）：
>
> OpenCode 当前 `config` hook 契约是 `Promise<void>`，运行时不消费返回值。
> 这意味着你不能只 `return next`；必须把 merge 结果回写到 `inputConfig`
> （例如 `Object.assign(inputConfig, next)`），否则会出现“插件已加载但 skills 不可见”的假象。

参考片段：

```ts
async function config(inputConfig) {
  const next = structuredClone(inputConfig ?? {})

  const paths = Array.isArray(next.skills?.paths) ? [...next.skills.paths] : []
  if (!paths.includes(builtinSkillsDir)) {
    paths.push(builtinSkillsDir)
  }

  next.skills = {
    ...(next.skills ?? {}),
    paths,
  }

  // 必须原地回写，不能只 return next
  Object.assign(inputConfig, next)
}
```

## 4.3 `tool` 应该怎么组织

如果插件提供自定义工具，不建议把工具实现直接塞进入口文件。

每个工具至少应明确四件事：

1. 工具名；
2. 输入 schema；
3. 执行逻辑；
4. 输出结构。

通用检查清单：

- schema 是否足够明确；
- 是否限制了副作用范围；
- 输出是否便于 agent 或程序继续消费；
- 报错是否可诊断；
- 是否具备幂等或最小重复副作用。

## 4.4 `agent` prompt 如何打包

推荐把 agent prompt 作为 markdown 资产存放在 `src/builtin/agents/*.md`，而不是作为长字符串写在 TypeScript 里。

这样做有三个好处：

1. 便于审阅和迭代；
2. 便于通过 frontmatter 管理描述信息；
3. dist 打包后容易做路径级验证。

推荐 frontmatter 字段：

- `description`
- `mode`

运行时代码负责解析 frontmatter，并把内容注入到 agent 配置中。

## 4.5 `skill` 在插件里不是注释，而是策略资产

一个 skill 不是“提示几句建议”，而是一份面向 agent 的执行策略说明。

一个可复用 skill 至少应回答：

1. 什么时候使用；
2. 它拥有什么职责边界；
3. 它应产出什么；
4. 它不能做什么；
5. 如何验收结果。

一旦 skill 被打包进插件，它就不再只是仓库里的文档，而成为插件对外分发的一部分运行资产。

## 4.6 如何在“非当前仓库”直接复用

如果你要把本文用于另一个全新项目，建议按以下顺序落地：

1. 先照 `OPENCODE_PLUGIN_DEVELOPMENT_REFERENCE_EXAMPLES.md` 创建最小骨架代码；
2. 把示例中的 `name`、`agentName`、`skill` 名称替换为你的业务语义；
3. 保留 merge-safe 与幂等逻辑，不要把示例改成覆盖式写入；
4. 先跑 unit，再跑黑盒 E2E，确认 dist 形态可加载；
5. 最后再扩展业务 tool、prompt、template 内容。

这能确保你迁移的是“工程模式”，而不是当前仓库的业务词汇。

---

## 5. 编译框架与构建方式

## 5.1 最小可用的 Bun 构建模式

本仓库采用的 Bun 构建思路是通用且足够轻量的。

最小构建示例：

```json
{
  "type": "module",
  "main": "dist/your_plugin.js",
  "scripts": {
    "build": "bun build src/index.ts --outfile dist/your_plugin.js --target bun --format esm"
  }
}
```

如果插件包含 builtin 内容，构建脚本必须额外复制这些资产到 `dist/`，否则运行时通常只能拿到代码，拿不到 prompt/skill/template。

推荐模式：

```json
{
  "scripts": {
    "build": "bun build src/index.ts --outfile dist/your_plugin.js --target bun --format esm && mkdir -p dist/builtin && cp -R src/builtin/agents dist/builtin/ && cp -R src/builtin/skills dist/builtin/ && cp -R src/builtin/templates dist/builtin/"
  }
}
```

## 5.2 一个仓库如何编译多个插件

一个 OpenCode 插件仓库完全可以编译多个入口，只要这些入口共享仓库级资源或测试体系即可。

适用情形：

1. 多个插件共享同一批 builtin assets；
2. 多个插件共享同一领域模型或工具链；
3. 你希望复用一套测试和发布流程；
4. 不同运行职责确实需要不同入口。

通用构建方式：

```json
{
  "scripts": {
    "build": "bun build src/index.ts --outfile dist/plugin_a.js --target bun --format esm && bun build src/secondary-index.ts --outfile dist/plugin_b.js --target bun --format esm && mkdir -p dist/builtin && cp -R src/builtin/agents dist/builtin/ && cp -R src/builtin/skills dist/builtin/ && cp -R src/builtin/templates dist/builtin/"
  }
}
```

但要注意：

- 一个仓库多个插件是**可选模式**，不是通用最佳实践；
- 是否拆成多个插件，应由职责边界、部署方式、测试隔离需求决定；
- 不能因为当前仓库是多入口，就把多入口当成所有业务都应该采用的结论。

## 5.3 源码加载与 dist 加载

二者都可能成立。

源码加载适合：

1. 本地快速迭代；
2. 当前 OpenCode 运行环境支持稳定直载源码；
3. 需要更短的 edit-test 循环。

dist 加载适合：

1. 对外分发；
2. 团队协作；
3. 希望路径、内容、构建产物完全可验证；
4. E2E 要验证真实交付形态。

如果文档面向团队或其他 agent，建议默认示例使用 dist 加载。

---

## 6. OpenCode 插件项目的 README 应该怎么写

OpenCode 插件项目的 `README.md` 不能只像普通 npm 包那样写“安装 + API”。

它必须同时解释：

1. 这个插件给 OpenCode 增加了什么能力；
2. OpenCode 应该如何加载它；
3. 插件运行时有哪些语义和限制。

推荐结构如下（这是“可独立上手”的最低模板）：

```md
## 1 Overview（能力边界）

开头要明确写清楚：

- 插件做什么；
- 注入哪些能力；
- 明确“不做什么”；
- 是否包含 `agent`、`skill`、`tool`、hooks 或它们的组合；
- 若一个仓库产出多个插件，每个入口文件分别负责什么。

## 2 Quick Start（可直接复制执行）

最少要包含：

1. 依赖安装命令；
2. 构建命令；
3. `opencode.json` 的最小挂载示例；
4. `file://` 绝对路径示例；
5. 源码模式与 dist 模式（至少给出推荐模式）。

## 3 Verify（生效验证）

这节必须回答：**“我怎么确认插件真的生效了？”**

至少给出：

1. 一条可执行验证命令（例如 `opencode debug config`）；
2. 2-3 条明确断言（例如 plugin 路径出现、skills.paths 出现、agent/tool 元数据出现）；
3. 一段“通过时输出示意”（避免读者只看到命令，不知道该看什么字段）。

对于 skill 注入类插件，建议额外执行 `opencode debug skill --print-logs`，
确认目标 skill 真的被发现（而不是只在 config 里“看起来应该存在”）。

## 4 Runtime Semantics（运行时契约）

这一节要写“运行时行为契约”，例如：

- 是只做运行时 config merge，还是会写文件；
- 是否存在 session 级缓存；
- 失败是阻断还是降级；
- 是否依赖固定工作区路径或固定 schema；
- 是否保证幂等（重复执行是否重复注入）。

## 5 Constraints（限制与前置条件）

尽早写出真实限制：

- 所需文件路径；
- 所需 schema；
- 支持哪些 hook；
- 权限假设；
- 已知限制和边界；
- 外部依赖（如 CLI、服务、环境变量）。

## 6 Troubleshooting（排障）

至少列 3 类高频故障：

- 插件未加载；
- 已加载但能力未注入；
- 能力已注入但运行失败。

每类故障要给“最小定位动作 + 预期现象”。

## 7 Version / Roadmap（可选但推荐）

如果项目有版本节奏，README 最好包含：

- 当前版本；
- 当前已具备能力；
- 后续计划；
- 版本升级时哪些行为发生了变化。
```

### 6.1 README 完整度门槛（发布前自检）

如果你的 README 同时满足下面 5 条，通常就不会再触发“内容不足、无法上手”的反馈：

1. **新读者 5 分钟内可挂载成功**：有可复制的 `opencode.json` 片段与绝对路径示例；
2. **新读者能独立验证生效**：给出命令 + 断言字段 + 输出示意；
3. **边界清晰**：明确“做什么 / 不做什么”，避免误解为全能插件；
4. **语义可预期**：写清 merge/覆盖、幂等、失败处理策略；
5. **故障可定位**：至少提供三类常见故障的定位方式。

### 6.2 一条实用原则

写 README 时，默认读者不是作者本人，而是“首次接手的 agent 或同事”。

如果对方在**不看源码**的前提下仍能完成“挂载 -> 验证 -> 排障”，你的 README 才算达标。
---

## 7. 如何验证插件真的有效

## 7.1 单元测试验证什么

单元测试不应该只覆盖语句，而应覆盖插件对外承诺的行为契约。

推荐覆盖点：

1. config merge 是追加式而不是覆盖式；
2. 重复执行保持幂等；
3. builtin 路径解析正确；
4. agent frontmatter 解析稳定；
5. schema 解析与过滤正确；
6. hook 在成功与失败边界下行为可预测。

## 7.2 为什么必须做 E2E

一个 OpenCode 插件即使所有 unit 都通过，也不代表 OpenCode 真实运行时真的加载了它。

因此必须有黑盒 E2E：

1. 构建 dist 产物；
2. 创建隔离 workspace；
3. 生成 `opencode.json`；
4. 调用真实 `opencode debug config`（必要时再调用 `opencode debug skill`）；
5. 解析 JSON 输出并断言运行时结果。

## 7.3 E2E 最低断言模型

至少要验证：

1. `debug config` 中能看到插件挂载；
2. `debug config` 中 `skills.paths` 包含预期 `dist/builtin/skills`；
3. `debug skill` 中目标 `skill` 存在；
4. 若插件注入了 `agent`，则对应 `agent` 元数据存在；
5. 若插件注册了 tool，则相应 tool 元数据存在；
6. 资源来源路径落在预期 `dist/` 输出下；
7. 命令执行 cwd 是测试 workspace。

最关键的是：

**不要只断言名称，要断言“名称 + 来源路径”。**

否则很容易因为同名资源存在而出现假阳性。

## 7.4 失败诊断信息必须足够完整

E2E 失败时，错误信息建议至少包含：

- command
- cwd
- exit code
- stdout
- stderr
- timeout 信息（如适用）

这样后续 agent 不需要重新猜测“到底是没加载、路径错了、还是输出结构变了”。

---

## 8. Skill 如何同时承担初始化与维护

这一节不是重复 `skill-creator` 中的通用评价标准，而是补充一个 OpenCode 插件里非常常见的实际需求：

**同一个 skill 既要能首次创建资产，又要能在项目成熟后持续维护这些资产。**

## 8.1 什么时候该用双模式 skill

当某类资产同时需要：

1. 第一次建立；
2. 之后不断修复、对齐、增量更新；

就应考虑把 skill 写成双模式。

常见资产类型：

- 配置文件；
- 文档骨架；
- prompt 或模板；
- 运行时脚本；
- 结构化元数据。

## 8.2 Skill 中应显式拆出两种模式

推荐显式写出：

1. `Initialize`
   - 触发条件：资产缺失、首次建立、用户明确要求初始化；
   - 目标：生成最小可用基线；
   - 验证：首次写入后必须可验收。

2. `Maintain`
   - 触发条件：资产已存在，但与当前事实或规范不一致；
   - 目标：最小增量收敛；
   - 验证：修改后仍与运行时事实一致。

如果不显式拆分，agent 很容易在成熟项目上“整文件重写”，造成负向优化。

## 8.3 Skill 里必须讲清楚哪些内容

每个模式至少要明确：

1. 触发条件；
2. 需要先读取什么输入；
3. 拥有哪些资产；
4. 允许做哪些修改；
5. 禁止做哪些修改；
6. 如何验证完成；
7. 最终产出是什么。

## 8.4 可复用模板

```md
## Principles

- 本 skill 负责资产族 X。
- 同时支持初始化与维护。
- 只根据当前事实更新，不凭空猜测。

## Initialize

触发条件：
- 资产不存在
- 用户要求首次建立

必须完成：
1. 检查现场事实
2. 创建必要资产
3. 写入最小可用基线
4. 验证结果可用

## Maintain

触发条件：
- 资产已存在但过期、漂移或不一致

必须完成：
1. 先读取已有资产
2. 保留有效结构
3. 做最小增量修改
4. 修改后重新验证

## Validation

1. 资产存在
2. 资产满足契约
3. 相关运行时行为仍有效
```

## 8.5 最重要的一条维护原则

对成熟项目，维护型 skill 应默认遵循：

**先读旧资产，再做最小收敛修改。**

除非资产缺失或已经彻底无效，否则不要把 skill 教成“每次都从头重写”。

---

## 9. 常见坑位

1. **覆盖用户配置**  
   插件应优先 merge，而不是整段替换。

2. **写死路径**  
   builtin 资产路径应基于运行时模块位置解析。

3. **只编译代码，不复制 builtin 资产**  
   dist 中缺少 `agents/skills/templates/reference` 时，运行时通常会出问题。

4. **只测源码加载，不测 dist 加载**  
   很多实际故障只会在 dist 形态暴露出来。

5. **只按名称断言**  
   E2E 中应始终验证来源路径。

6. **把某个业务插件的结构误当成通用最佳实践**  
   通用文档应该讲工程形态，不应把业务边界当成普适规律。

7. **skill 只会初始化，不会维护**  
   这会导致项目进入成熟阶段后，skill 的价值迅速下降。

8. **README 过弱**  
   如果另一个 agent 看不懂应该挂载哪个文件、预期效果是什么，这个插件就还不够可复用。

---

## 10. 发布前最低检查表

在把一个 OpenCode 插件视为“可复用交付物”之前，至少检查：

1. 入口文件在源码或 dist 模式下能正确解析；
2. builtin 资产已正确打包并可被发现；
3. config 注入逻辑 merge-safe 且幂等；
4. README 包含挂载方式与运行时语义；
5. unit 覆盖核心契约；
6. E2E 能证明真实加载成功；
7. skills 明确了职责、边界与验收；
8. 失败日志足够让非作者排障。

---

## 11. 最后结论

这个仓库真正可迁移的经验，不是某一个业务插件的流程设计，而是下面这条工程方法：

**把 OpenCode 插件当作“代码 + prompt + 资产 + merge 逻辑 + 运行时验证”共同组成的交付系统来设计。**

一旦按照这个模型来建设，无论插件职能是环境准备、知识治理、文档生成、工具代理，还是其他完全不同的业务方向，都可以复用同一套开发思路。
