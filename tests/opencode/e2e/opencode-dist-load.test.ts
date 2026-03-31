import { describe, expect, test } from "bun:test"
import fs from "node:fs"
import path from "node:path"

import {
  assertDebugAgentShape,
  assertConfigContainsHarnessDefinitions,
  assertDebugConfigHasPlugin,
  assertDebugSkillShape,
  assertRequiredAgentFromDist,
  assertRequiredSkillsFromDist,
  parseJsonOutput,
} from "./helpers/assertions"
import { assertSuccess, resolveOpencodeCli, runCommand } from "./helpers/cli"
import {
  BUILD_TIMEOUT_MS,
  CASE_ID,
  DEBUG_TIMEOUT_MS,
  ENV_ALLOW_FALLBACK,
  ENV_KEEP_WORKSPACE,
  ENV_OPENCODE_CLI,
  REQUIRED_AGENT,
  REQUIRED_SKILLS,
  REPO_ROOT,
  WORKSPACES_ROOT,
} from "./helpers/constants"
import { resolveMountProfile } from "./helpers/mount-profile"
import { canonicalPath, normalizeObservedPath } from "./helpers/path-utils"
import { cleanupWorkspace, prepareWorkspace } from "./helpers/workspace"

describe("opencode dist e2e helpers", () => {
  test("declares required skill contract", () => {
    expect(REQUIRED_SKILLS).toEqual([
      "harness-env-skill",
      "harness-repo-skill",
      "harness-agents-doc-skill",
    ])
  })

  test("normalizes file URL and rejects non-file URL schemes", () => {
    const dir = fs.mkdtempSync(path.join(process.cwd(), "tmp-path-"))
    const value = `file://${dir.replace(/\\/g, "/")}`
    expect(normalizeObservedPath(value)).toContain("tmp-path-")
    expect(() => normalizeObservedPath("https://example.com/path")).toThrow()
    fs.rmSync(dir, { recursive: true, force: true })
  })

  test("validates mount profile constraints", () => {
    expect(resolveMountProfile("opencode-dist").name).toBe("opencode-dist")
    expect(() => resolveMountProfile("unknown" as never)).toThrow()
  })

  test("requires OPENCODE_CLI unless fallback is enabled", () => {
    expect(() => resolveOpencodeCli({})).toThrow(`${ENV_OPENCODE_CLI} is required`)
    expect(resolveOpencodeCli({ [ENV_ALLOW_FALLBACK]: "1" })).toBe("opencode")
  })

  test("validates debug output shapes and negative source checks", () => {
    expect(() => parseJsonOutput("not-json", "unit")).toThrow()
    expect(() => assertDebugAgentShape({})).toThrow()
    expect(() => assertDebugSkillShape([{}])).toThrow()

    const canonicalRepo = canonicalPath(REPO_ROOT)
    const agentPrefix = `${canonicalRepo}/dist/builtin/agents/`
    const skillPrefix = `${canonicalRepo}/dist/builtin/skills/`

    expect(() =>
      assertRequiredAgentFromDist(
        { name: REQUIRED_AGENT, mode: "all", prompt: "file:///tmp/agent.md" },
        REQUIRED_AGENT,
        agentPrefix,
      ),
    ).toThrow()

    expect(() =>
      assertRequiredSkillsFromDist(
        [{ name: "harness-env-skill", location: "file:///tmp/skill.md" }],
        REQUIRED_SKILLS,
        skillPrefix,
      ),
    ).toThrow()
  })
})

describe("opencode dist e2e runtime", () => {
  test(CASE_ID, () => {
    const cli = resolveOpencodeCli(process.env)
    const keepWorkspace = process.env[ENV_KEEP_WORKSPACE] === "1"

    const build = runCommand({
      command: "bun",
      args: ["run", "build"],
      cwd: REPO_ROOT,
      timeoutMs: BUILD_TIMEOUT_MS,
    })
    assertSuccess(build)

    const distIndexJs = path.join(REPO_ROOT, "dist/index.js")
    if (!fs.existsSync(distIndexJs)) {
      throw new Error(`build completed but dist index is missing: ${distIndexJs}`)
    }

    const workspace = prepareWorkspace({
      caseId: CASE_ID,
      profile: "opencode-dist",
      pluginDistIndexJs: distIndexJs,
    })

    if (!workspace.workspacePath.startsWith(WORKSPACES_ROOT)) {
      throw new Error(`workspace path must stay under tests workspaces root: ${workspace.workspacePath}`)
    }
    if (!fs.existsSync(workspace.configPath)) {
      throw new Error(`workspace config was not created: ${workspace.configPath}`)
    }

    const agentPrefix = `${canonicalPath(REPO_ROOT)}/dist/builtin/agents/`
    const skillPrefix = `${canonicalPath(REPO_ROOT)}/dist/builtin/skills/`

    try {
      const debugConfig = runCommand({
        command: cli,
        args: ["debug", "config"],
        cwd: workspace.workspacePath,
        timeoutMs: DEBUG_TIMEOUT_MS,
      })
      assertSuccess(debugConfig)
      expect(debugConfig.cwd).toBe(workspace.workspacePath)
      const config = parseJsonOutput<Record<string, unknown>>(debugConfig.stdout, "debug config")
      assertDebugConfigHasPlugin(config, canonicalPath(distIndexJs))

      assertConfigContainsHarnessDefinitions({
        config,
        requiredAgent: REQUIRED_AGENT,
        requiredSkills: REQUIRED_SKILLS,
        expectedAgentPromptPrefix: agentPrefix,
        expectedSkillsPathPrefix: skillPrefix,
      })
    } finally {
      cleanupWorkspace(workspace.workspacePath, keepWorkspace)
    }
  }, 180_000)
})
