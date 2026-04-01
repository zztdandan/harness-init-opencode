#!/usr/bin/env bun
import { mkdir, cp, writeFile } from "node:fs/promises"
import { join } from "node:path"

const DIST_CLAUDE = "dist-claude"
const SRC_BUILTIN = "src/builtin"

async function buildClaude() {
  console.log("Building Claude plugin...")

  // 1. 创建目录结构
  await mkdir(join(DIST_CLAUDE, ".claude-plugin"), { recursive: true })
  await mkdir(join(DIST_CLAUDE, "skills"), { recursive: true })

  // 2. 复制 skills（包括主 agent 作为 skill）
  const skills = [
    "harness-init",
    "harness-agent-env",
    "harness-git-worktree",
    "harness-docs"
  ]
  for (const skill of skills) {
    await cp(
      join(SRC_BUILTIN, "skills", skill),
      join(DIST_CLAUDE, "skills", skill),
      { recursive: true }
    )
  }

  // 3. 生成 marketplace.json
  const marketplace = {
    name: "dedge-harness-init",
    owner: {
      name: "dedge",
      email: "dedge@example.com"
    },
    metadata: {
      description: "Harness workspace initialization plugin",
      version: "0.1.0"
    },
    plugins: [
      {
        name: "harness-init",
        description: "Initialize harness workspace with agent orchestration",
        source: "./",
        strict: false,
        skills: skills.map(s => `./skills/${s}`)
      }
    ]
  }

  await writeFile(
    join(DIST_CLAUDE, ".claude-plugin", "marketplace.json"),
    JSON.stringify(marketplace, null, 2)
  )

  console.log("✓ Claude plugin built to dist-claude/")
}

buildClaude().catch(console.error)
