import { createHarnessShellEnvPreparePlugin } from "./shell-env-prepare-plugin-factory"

function resolveWorktreeRoot(input: Record<string, any>): string | undefined {
  if (typeof input.worktree === "string" && input.worktree.trim().length > 0) {
    return input.worktree
  }

  if (typeof input.directory === "string" && input.directory.trim().length > 0) {
    return input.directory
  }

  return undefined
}

const plugin = async (input: Record<string, any> = {}) =>
  createHarnessShellEnvPreparePlugin({
    worktreeRoot: resolveWorktreeRoot(input),
  })

export default plugin
