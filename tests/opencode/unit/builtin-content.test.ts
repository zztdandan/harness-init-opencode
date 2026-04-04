import { describe, expect, test } from "bun:test"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8")
}

describe("builtin prompt assets", () => {
  test("includes main harness-init agent prompt", () => {
    const content = read("src/builtin/agents/harness-init.md")

    expect(content.includes("Gate A")).toBe(true)
    expect(content.includes("Gate B")).toBe(true)
    expect(content.includes(".worktrees/")).toBe(true)
    expect(content.includes("tmp/")).toBe(true)
  })

  test("includes required skills", () => {
    const env = read("src/builtin/skills/harness-agent-env/SKILL.md")
    const repo = read("src/builtin/skills/harness-git-worktree/SKILL.md")
    const doc = read("src/builtin/skills/harness-docs/SKILL.md")
    const goRef = read(
      "src/builtin/skills/harness-agent-env/reference/go/GO_ENV_REFERENCE.md",
    )
    const mainOutputSpec = read(
      "src/builtin/skills/harness-agent-env/reference/check-output/ENV_CHECK_OUTPUT_SPEC.md",
    )

    expect(env.includes("uv -> venv -> python")).toBe(true)
    expect(env.includes("守则")).toBe(true)
    expect(env.includes("reference/go/GO_ENV_REFERENCE.md")).toBe(true)
    expect(env.includes("reference/check-output/ENV_CHECK_OUTPUT_SPEC.md")).toBe(
      true,
    )
    expect(env.includes("command")).toBe(true)
    expect(mainOutputSpec.includes("stdout 必须为 TOML")).toBe(true)
    expect(mainOutputSpec.includes("[shell_env]")).toBe(true)
    expect(mainOutputSpec.includes("[shell_env.vars]")).toBe(true)
    expect(repo.includes("submodule")).toBe(true)
    expect(repo.includes(".worktrees/")).toBe(true)
    expect(repo.includes("管理")).toBe(true)
    expect(doc.includes("MUSTDO")).toBe(true)
    expect(doc.includes("Project Tree & Task Status")).toBe(true)
    expect(goRef.includes("switch_go120.sh")).toBe(true)
    expect(goRef.includes("install_go124_tools.sh")).toBe(true)
    expect(goRef.includes("check-output/ENV_CHECK_OUTPUT_SPEC.md")).toBe(true)
    expect(mainOutputSpec.includes("[python]")).toBe(true)
    expect(mainOutputSpec.includes("\n[go]\n")).toBe(false)
  })

  test("includes AGENTS template with mandatory sections", () => {
    const content = read("src/builtin/templates/AGENTS.template.md")

    expect(content.includes("MUSTDO")).toBe(true)
    expect(content.includes("Git Topology")).toBe(true)
    expect(content.includes(".worktrees/")).toBe(true)
    expect(content.includes("Bootstrap phase vs steady state")).toBe(true)
    expect(content.includes("会话启动一次性环境校验")).toBe(true)
    expect(content.includes("UV_PROJECT_ENVIRONMENT")).toBe(true)
    expect(content.includes("source .venv/bin/activate")).toBe(true)
    expect(content.includes("scripts/check-agent-env.sh")).toBe(true)
    expect(content.includes("scripts/shell_source.sh")).toBe(true)
    expect(content.includes("scripts/shell_env.json")).toBe(true)
    expect(content.includes("由 agent 根据探测结果决定")).toBe(true)
    expect(content.includes("各库能力分配与修改模式")).toBe(true)
    expect(content.includes("主库")).toBe(true)
    expect(content.includes("实验区")).toBe(true)
    expect(content.includes("临时库")).toBe(true)
    expect(content.includes("Worktree 摘出范围（强制）")).toBe(true)
    expect(content.includes("## 5) README Maintenance")).toBe(true)
    expect(content.includes("## Environment Setup")).toBe(true)
    expect(content.includes("## Development Workflow")).toBe(true)
    expect(content.includes("## Debug & Run")).toBe(true)
    expect(content.includes("## Project Structure")).toBe(true)
    expect(content.includes("### 5.2 更新触发条件")).toBe(true)
    expect(content.includes("### 7.1 Mandatory update actions")).toBe(true)
    expect(content.includes("### 7.2 Definition of done")).toBe(true)
    expect(content.includes("Section 1")).toBe(true)
    expect(content.includes("✅ 已解决")).toBe(true)
    expect(content.includes("⚠ 未解决")).toBe(true)
    expect(content.includes("不是渲染脚本")).toBe(true)
  })
})
