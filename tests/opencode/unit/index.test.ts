import { describe, expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

import {
  createHarnessInitPlugin,
  resolveBuiltinPaths,
} from "../../../src/plugin-factory"

describe("plugin entry", () => {
  test("creates plugin with config hook", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "harness-plugin-entry-"))
    const agentPath = join(tempDir, "harness-init.md")
    await writeFile(
      agentPath,
      `---
description: Harness init agent from plugin entry test
mode: primary
---

Prompt body.
`,
      "utf8",
    )

    const plugin = createHarnessInitPlugin({
      builtinSkillsDir: "/plugin/skills",
      builtinAgentPath: agentPath,
    })

    try {
      expect(plugin.name).toBe("harness-init-plugin")
      expect(typeof plugin.config).toBe("function")

      const config = {}
      await plugin.config?.(config)
      expect((config as any)?.skills?.paths).toEqual(["/plugin/skills"])
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test("resolves builtin paths to skills and agent files", () => {
    const paths = resolveBuiltinPaths("/repo/src/index.ts")

    expect(paths.builtinSkillsDir).toBe("/repo/src/builtin/skills")
    expect(paths.builtinAgentPath).toBe(
      "/repo/src/builtin/agents/harness-init.md",
    )
  })
})
