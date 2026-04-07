import { access, mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import {
  applyShellEnvFromCache,
} from "./handlers/shell-env-hook-handler"
import { loadSessionEnvCache } from "./handlers/shell-env-session-handler"

type LooseRecord = Record<string, any>

export type ShellEnvPreparePluginHooks = {
  name: string
  event?: (input: LooseRecord, output: LooseRecord) => Promise<void>
  "shell.env"?: (input: LooseRecord, output: LooseRecord) => Promise<void>
}

type CreateShellEnvPreparePluginOptions = {
  worktreeRoot?: string
}

type ShellEnvPrepareState = {
  envCache: Record<string, string>
  worktreeRoot?: string
  cacheLoaded: boolean
}

const SHELL_SOURCE_PATH = path.join("scripts", "shell_source.sh")
const ZSH_DOTDIR_PATH = path.join("scripts", ".harness-zdotdir")
const ZSH_ENV_FILE = ".zshenv"

function quoteShellPath(value: string): string {
  return value.replaceAll('"', '\\"')
}

async function loadShellBootstrapEnv(worktreeRoot: string): Promise<Record<string, string>> {
  const shellSourcePath = path.join(worktreeRoot, SHELL_SOURCE_PATH)

  try {
    await access(shellSourcePath)
  } catch {
    return {}
  }

  const env: Record<string, string> = {
    BASH_ENV: shellSourcePath,
  }

  const zdotdir = path.join(worktreeRoot, ZSH_DOTDIR_PATH)
  const zshenvPath = path.join(zdotdir, ZSH_ENV_FILE)
  const zshenvContent = `emulate -L sh\n. "${quoteShellPath(shellSourcePath)}" >/dev/null 2>&1 || true\n`

  try {
    await mkdir(zdotdir, { recursive: true })
    await writeFile(zshenvPath, zshenvContent, "utf8")
    env.ZDOTDIR = zdotdir
  } catch {
    // Ignore bootstrap file creation failures and keep BASH_ENV only.
  }

  return env
}

function isSessionCreatedEvent(input: LooseRecord): boolean {
  return input.event === "session.created"
}

export function createHarnessShellEnvPreparePlugin(
  options: CreateShellEnvPreparePluginOptions = {},
): ShellEnvPreparePluginHooks {
  const state: ShellEnvPrepareState = {
    envCache: {},
    worktreeRoot: options.worktreeRoot,
    cacheLoaded: false,
  }

  const ensureCacheLoaded = async () => {
    if (state.cacheLoaded) {
      return
    }

    state.cacheLoaded = true

    if (!state.worktreeRoot) {
      state.envCache = {}
      return
    }

    const [sessionEnv, shellBootstrapEnv] = await Promise.all([
      loadSessionEnvCache({ worktreeRoot: state.worktreeRoot }),
      loadShellBootstrapEnv(state.worktreeRoot),
    ])

    state.envCache = {
      ...sessionEnv,
      ...shellBootstrapEnv,
    }
  }

  return {
    name: "harness_shell_env_prepare_plugin",
    async event(input: LooseRecord = {}) {
      if (!isSessionCreatedEvent(input)) {
        return
      }

      await ensureCacheLoaded()
    },
    async "shell.env"(_input: LooseRecord, output: LooseRecord = {}) {
      await ensureCacheLoaded()
      applyShellEnvFromCache(state, output)
    },
  }
}
