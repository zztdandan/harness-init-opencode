import { describe, expect, test } from "bun:test"

import {
  createHarnessInitPlugin,
  resolveBuiltinPaths,
} from "../src/index"

describe("plugin entry", () => {
  test("creates plugin with config hook", async () => {
    const plugin = createHarnessInitPlugin({
      builtinSkillsDir: "/plugin/skills",
      builtinAgentPath: "/plugin/agents/harness-init.md",
    })

    expect(plugin.name).toBe("harness-init-plugin")
    expect(typeof plugin.config).toBe("function")

    const next = await plugin.config?.({})
    expect(next?.skills?.paths).toEqual(["/plugin/skills"])
  })

  test("resolves builtin paths to skills and agent files", () => {
    const paths = resolveBuiltinPaths("/repo/src/index.ts")

    expect(paths.builtinSkillsDir).toBe("/repo/src/builtin/skills")
    expect(paths.builtinAgentPath).toBe(
      "/repo/src/builtin/agents/harness-init.md",
    )
  })
})
