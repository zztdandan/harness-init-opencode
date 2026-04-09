import { describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import path, { join } from "node:path"
import { tmpdir } from "node:os"

import {
  SESSION_ENV_SCHEMA,
  loadSessionEnvCache,
} from "../../../src/handlers/shell-env-session-handler"
import { createHarnessShellEnvPreparePlugin } from "../../../src/shell-env-prepare-plugin-factory"

async function withTempWorkspace<T>(run: (workspace: string) => Promise<T>) {
  const workspace = await mkdtemp(join(tmpdir(), "harness-shell-env-"))
  try {
    return await run(workspace)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
}

describe("loadSessionEnvCache", () => {
  test("returns empty cache when file is missing", async () => {
    await withTempWorkspace(async (workspace) => {
      const cache = await loadSessionEnvCache({ worktreeRoot: workspace })
      expect(cache).toEqual({})
    })
  })

  test("returns empty cache when JSON is invalid", async () => {
    await withTempWorkspace(async (workspace) => {
      const scriptsDir = path.join(workspace, "scripts")
      await mkdir(scriptsDir, { recursive: true })
      await writeFile(path.join(scriptsDir, "session_env.json"), "{invalid", "utf8")

      const cache = await loadSessionEnvCache({ worktreeRoot: workspace })
      expect(cache).toEqual({})
    })
  })

  test("returns empty cache when schema is mismatched", async () => {
    await withTempWorkspace(async (workspace) => {
      const scriptsDir = path.join(workspace, "scripts")
      await mkdir(scriptsDir, { recursive: true })
      await writeFile(
        path.join(scriptsDir, "session_env.json"),
        JSON.stringify({ schema: "legacy", env: { KEEP: "1" } }),
        "utf8",
      )

      const cache = await loadSessionEnvCache({ worktreeRoot: workspace })
      expect(cache).toEqual({})
    })
  })

  test("returns empty cache when env is not an object", async () => {
    await withTempWorkspace(async (workspace) => {
      const scriptsDir = path.join(workspace, "scripts")
      await mkdir(scriptsDir, { recursive: true })
      await writeFile(
        path.join(scriptsDir, "session_env.json"),
        JSON.stringify({ schema: SESSION_ENV_SCHEMA, env: [] }),
        "utf8",
      )

      const cache = await loadSessionEnvCache({ worktreeRoot: workspace })
      expect(cache).toEqual({})
    })
  })

  test("filters invalid keys and normalizes values to strings", async () => {
    await withTempWorkspace(async (workspace) => {
      const scriptsDir = path.join(workspace, "scripts")
      await mkdir(scriptsDir, { recursive: true })
      await writeFile(
        path.join(scriptsDir, "session_env.json"),
        JSON.stringify({
          schema: SESSION_ENV_SCHEMA,
          env: {
            OK: "value",
            COUNT: 7,
            FEATURE_FLAG: false,
            _ALSO_OK: true,
            "1INVALID": "no",
            "BAD-NAME": "no",
            NIL: null,
          },
        }),
        "utf8",
      )

      const cache = await loadSessionEnvCache({ worktreeRoot: workspace })
      expect(cache).toEqual({
        OK: "value",
        COUNT: "7",
        FEATURE_FLAG: "false",
        _ALSO_OK: "true",
      })
    })
  })

  test("supports legacy flat KV session_env format", async () => {
    await withTempWorkspace(async (workspace) => {
      const scriptsDir = path.join(workspace, "scripts")
      await mkdir(scriptsDir, { recursive: true })
      await writeFile(
        path.join(scriptsDir, "session_env.json"),
        JSON.stringify({
          GOPATH: "/tmp/go",
          GOMODCACHE: "/tmp/go/pkg/mod",
          COUNT: 12,
          "BAD-NAME": "skip",
        }),
        "utf8",
      )

      const cache = await loadSessionEnvCache({ worktreeRoot: workspace })
      expect(cache).toEqual({
        GOPATH: "/tmp/go",
        GOMODCACHE: "/tmp/go/pkg/mod",
        COUNT: "12",
      })
    })
  })
})

describe("harness shell env prepare plugin", () => {
  test("creates plugin with expected hooks", () => {
    const plugin = createHarnessShellEnvPreparePlugin()

    expect(plugin.name).toBe("harness_shell_env_prepare_plugin")
    expect(typeof plugin.event).toBe("function")
    expect(typeof plugin["shell.env"]).toBe("function")
    expect("tool.execute.before" in plugin).toBeFalse()
  })

  test("shell.env uses session cache snapshot only", async () => {
    await withTempWorkspace(async (workspace) => {
      const scriptsDir = path.join(workspace, "scripts")
      await mkdir(scriptsDir, { recursive: true })
      const sessionEnvPath = path.join(scriptsDir, "session_env.json")
      await writeFile(
        sessionEnvPath,
        JSON.stringify({ schema: SESSION_ENV_SCHEMA, env: { FROZEN: "v1" } }),
        "utf8",
      )

      const plugin = createHarnessShellEnvPreparePlugin({ worktreeRoot: workspace })
      await plugin.event?.({ event: "session.created" }, {})

      const outputA: Record<string, any> = { env: { EXISTING: "keep", FROZEN: "old" } }
      await plugin["shell.env"]?.({}, outputA)
      expect(outputA.env).toEqual({ EXISTING: "keep", FROZEN: "v1" })

      await writeFile(
        sessionEnvPath,
        JSON.stringify({ schema: SESSION_ENV_SCHEMA, env: { FROZEN: "v2", NEW: "later" } }),
        "utf8",
      )

      const outputB: Record<string, any> = {}
      await plugin["shell.env"]?.({}, outputB)
      expect(outputB.env).toEqual({ FROZEN: "v1" })
    })
  })

  test("shell.env injects BASH_ENV and ZDOTDIR when shell source exists", async () => {
    await withTempWorkspace(async (workspace) => {
      const scriptsDir = path.join(workspace, "scripts")
      await mkdir(scriptsDir, { recursive: true })
      await writeFile(
        path.join(scriptsDir, "session_env.json"),
        JSON.stringify({ schema: SESSION_ENV_SCHEMA, env: { KEEP: "ok" } }),
        "utf8",
      )
      await writeFile(path.join(scriptsDir, "shell_source.sh"), "return 1\n", "utf8")

      const plugin = createHarnessShellEnvPreparePlugin({ worktreeRoot: workspace })
      await plugin.event?.({ event: "session.created" }, {})

      const output: Record<string, any> = {}
      await plugin["shell.env"]?.({}, output)

      expect(output.env).toMatchObject({
        KEEP: "ok",
        BASH_ENV: join(workspace, "scripts/shell_source.sh"),
        ZDOTDIR: join(workspace, "scripts/.harness-zdotdir"),
      })

      const zshenvPath = join(workspace, "scripts/.harness-zdotdir/.zshenv")
      const zshenv = await readFile(zshenvPath, "utf8")
      expect(zshenv).toContain('|| true')
      expect(zshenv).toContain(join(workspace, "scripts/shell_source.sh"))
    })
  })

  test("shell.env does not inject bootstrap env when shell source is missing", async () => {
    await withTempWorkspace(async (workspace) => {
      const scriptsDir = path.join(workspace, "scripts")
      await mkdir(scriptsDir, { recursive: true })
      await writeFile(
        path.join(scriptsDir, "session_env.json"),
        JSON.stringify({ schema: SESSION_ENV_SCHEMA, env: { ONLY_JSON: "1" } }),
        "utf8",
      )

      const plugin = createHarnessShellEnvPreparePlugin({ worktreeRoot: workspace })
      await plugin.event?.({ event: "session.created" }, {})

      const output: Record<string, any> = {}
      await plugin["shell.env"]?.({}, output)
      expect(output.env).toEqual({ ONLY_JSON: "1" })
    })
  })
})
