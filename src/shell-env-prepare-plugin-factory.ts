import {
  applyShellEnvFromCache,
  rewriteBashCommand,
} from "./handlers/shell-env-hook-handler"
import { loadSessionEnvCache } from "./handlers/shell-env-session-handler"

type LooseRecord = Record<string, any>

export type ShellEnvPreparePluginHooks = {
  name: string
  event?: (input: LooseRecord, output: LooseRecord) => Promise<void>
  "shell.env"?: (input: LooseRecord, output: LooseRecord) => Promise<void>
  "tool.execute.before"?: (input: LooseRecord, output: LooseRecord) => Promise<void>
}

type CreateShellEnvPreparePluginOptions = {
  worktreeRoot?: string
}

type ShellEnvPrepareState = {
  envCache: Record<string, string>
  worktreeRoot?: string
  cacheLoaded: boolean
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

    state.envCache = await loadSessionEnvCache({ worktreeRoot: state.worktreeRoot })
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
    async "tool.execute.before"(input: LooseRecord = {}, output: LooseRecord = {}) {
      await ensureCacheLoaded()
      rewriteBashCommand(state, input, output)
    },
  }
}
