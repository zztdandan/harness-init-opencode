import { createHarnessShellEnvPreparePlugin } from "./shell-env-prepare-plugin-factory"

const plugin = async (input: Record<string, any> = {}) =>
  createHarnessShellEnvPreparePlugin({
    worktreeRoot: typeof input.worktree === "string" ? input.worktree : undefined,
  })

export default plugin
