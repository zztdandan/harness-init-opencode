# Harness 初始化插件设计（v1）

日期：2026-03-27  
状态：对话已确认，待进入实现计划阶段

## 1. 目标与范围

构建一个 OpenCode 插件，提供专用的 **harness 初始化主 agent**，用于引导创建标准化的 agent 工作区。该初始化器必须：

- 未切换到该 agent 时不增加常规会话负担
- 对高风险步骤设置明确门禁（hard gate）
- 标准化工作区骨架、仓库组织与 AGENTS.md 生成
- 以插件形式交付，支持“一条 plugin 路径接入 + 运行时注入”

v1 不包含：

- 自定义 tool 注入
- subagent 实现
- 非必要 UI/自动化扩展

## 2. 产品决策（最终）

- 交付形态：同时支持源码加载与 dist 编译产物加载
- 技术栈：TypeScript + Bun
- 架构：**方案 B**（主编排 agent + 多 skill）
- 激活策略：仅注册，不设为默认 agent
- 硬门禁：
  - Gate A：当前目录为 git 根仓库时，必须用户明确给出处理方案
  - Gate B：用户必须明确指定“哪个项目是主管理项目”
- 非门禁步骤：提供默认推荐；用户不选则按默认继续
- tmp 生命周期：`tmp/` 仅作过程记忆，按确定性规则清理
- 环境探测与降级：
  - 顺序探测并记录：`uv -> venv -> python`、`bun -> node`、`zsh -> bash`
  - 缺失不阻断，写入 tmp 并最终回写 AGENTS.md
  - 最终输出一句建议：准备好 `uv bun bash` 以发挥全部能力

## 3. 系统架构

### 3.1 插件层职责

插件仅做运行时配置合并：

- 注入 `agent`（初始化主 agent）
- 注入 `skills.paths`（内置 skill 目录）
- 注入最小必要权限配置
- 保证幂等与 merge 安全（不覆盖用户已有配置）
- 不回写用户磁盘上的 `opencode.json`

### 3.2 Agent 与 Skill 分工

主 agent（`harness-init`）负责流程编排与门禁控制。

v1 skills：

1. `harness-env-skill`
   - 约束环境探测顺序与记录格式
   - 约束降级与结果表达方式
2. `harness-repo-skill`
   - 统一主项目接入：任意来源 -> 本地目标目录
   - 约束 git / submodule / `.worktrees/` 组织规则
   - 约束远端意见收集格式与提问模板
3. `harness-agents-doc-skill`
   - 生成 AGENTS.md
   - 将 tmp 状态映射回 AGENTS.md 结构化章节
   - 提供后续 skill 扩展/安装指引

v1 不使用 subagent。

## 4. 流程设计

### Step 0：初始化上下文

- 创建 `tmp/` 与结构化状态文件
- 检测当前目录是否为 git 根仓库
- 命中 git 根仓库则触发 **Gate A**

### Gate A：当前目录已是 Git 仓库（必须解决）

主 agent 必须提问并等待用户明确意见。默认备选：

1. 删除顶层 `.git`
2. 将当前内容与 git 元数据迁移到子目录并作为 submodule 管理
3. 用户自定义处理方案

若用户回复不明确或不可执行，必须回到提问阶段，不能继续。  
若选择包含破坏性动作（如删除 `.git`），必须二次确认。

与 DESIGN 的一致性说明：`DESIGN.md` 原始表述为“当前目录不能已是 git 仓库”。本设计采用“硬门禁 + 用户显式例外方案”的执行策略，且已在需求文档中同步该例外策略。

### Step 1：环境探测

- 按既定顺序探测并写入 `tmp/env.json`
- 工具缺失不阻断
- 产出规范化报告，供 AGENTS.md 回写

### Step 2：主项目接入与仓库组织

- 触发 **Gate B**：用户必须明确指定主管理项目
- 主项目来源不设限，统一归一到工作区中的一个目录
- 若目标目录无 git：初始化 git、生成基础 `.gitignore`、完成首次提交
- 创建 `.worktrees/`，并确保 `.gitignore` 包含 `.worktrees/`
- 按约定完成 submodule 管理关系设置
- 采集远端偏好并写入 tmp

命名约定：v1 统一使用 `.worktrees/`（复数）。

### Step 3：docs 最小骨架

创建以下目录：

- `docs/issue/`
- `docs/pr/`
- `docs/ontology/`
- `docs/superpowers/`

同时先写入一个 AGENTS.md 占位简介（解释目录用途），再由 Step 4 生成完整正式版。

### Step 4：生成 AGENTS.md

- 参考 `agenttpl.md`，但不能原样照搬
- 输出可执行、可维护、可扩展的 AGENTS.md
- 必须包含以下强制章节：
  - MUSTDO 约束（含“注释可审阅性要求”和“编写后不得删除注释”）
  - Project Tree & Task Status（权威状态源）
  - Git 拓扑与协作规则
  - Submodule 与 `.worktrees/` 策略
  - 环境/工具策略（两阶段）：
    - Bootstrap 阶段：允许降级探测并记录事实
    - 稳态阶段：在确认 `uv` 与 `.venv` 后执行 uv-first + 统一 `.venv`
  - Debug 与 E2E 指南
  - 文档维护规则
  - 实施边界/继承约束
  - 自动更新机制与完成定义
- 回写 tmp 事实：
  - 环境探测结果与降级链路
  - Gate A / Gate B 的用户决策
  - git / submodule / worktree 拓扑与约束

### Step 5：主流程收尾

- 清理规则：
  - 成功路径：删除 `tmp/`
  - 失败/修补路径：保留 `tmp/` 用于恢复，恢复完成后再删除
- 输出简要结果摘要
- 末尾追加一句建议：准备好 `uv bun bash`

## 5. 数据契约

运行期临时文件：

- `tmp/session.json`：状态机进度、门禁状态、检查点
- `tmp/env.json`：环境探测详情与最终降级命中
- `tmp/repo.json`：主项目路径、git/submodule/worktree 状态、远端意向
- `tmp/doc-input.json`：AGENTS.md 渲染输入

契约原则：

- 仅使用结构化 JSON
- 键名稳定，支持重复执行可重现
- 支持幂等重跑

## 6. 插件项目目录规划

```text
src/
  index.ts
  handlers/
    config-handler.ts
    agent-handler.ts
  builtin/
    agents/
      harness-init.md
    skills/
      harness-env-skill/SKILL.md
      harness-repo-skill/SKILL.md
      harness-agents-doc-skill/SKILL.md
    templates/
      AGENTS.template.md
docs/
  superpowers/
    specs/
      2026-03-27-harness-init-plugin-design.md
```

## 7. 错误处理策略

- Fatal（必须停止）：硬门禁未满足、目标路径非法、关键 git 操作不可恢复失败
- Recoverable（可继续）：偏好工具缺失、非冲突目录已存在
- Idempotent（可重入）：禁止重复注入、重复追加、破坏性覆盖

## 8. 验收标准

1. 一条 plugin 路径即可生效（运行时注入 agent + skills）
2. 主 agent 可用但非默认
3. Gate A / Gate B 在未明确用户意见前必须阻塞
4. 非门禁步骤可按默认自动推进
5. 生成 docs 最小骨架与 AGENTS.md
6. 环境探测事实写入 AGENTS.md
7. 主流程完成后按规则清理 `tmp/`
8. 同时支持源码加载与 dist 加载

## 9. 下一阶段实现要点

- 先完成插件注入骨架与 builtin 资源路径
- 实现主 agent 的门禁语言与流程状态控制
- 实现 3 个 skills 的职责边界
- 用规范化 tmp 输入渲染 AGENTS.md
- 增加冒烟场景：重跑幂等、门禁回退、异常恢复
