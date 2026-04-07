import path from "node:path"

type LooseRecord = Record<string, any>

type ShellEnvPrepareState = {
  envCache: Record<string, string>
  worktreeRoot?: string
}

function quoteShellPath(value: string): string {
  return value.replaceAll('"', '\\"')
}

export function applyShellEnvFromCache(
  state: ShellEnvPrepareState,
  output: LooseRecord,
): void {
  const existing =
    output.env && typeof output.env === "object" && !Array.isArray(output.env)
      ? output.env
      : {}

  output.env = {
    ...existing,
    ...state.envCache,
  }
}

export function rewriteBashCommand(
  state: ShellEnvPrepareState,
  input: LooseRecord,
  output?: LooseRecord,
): void {
  if (input.tool !== "bash") {
    return
  }

  const argsObject =
    output?.args && typeof output.args === "object" && !Array.isArray(output.args)
      ? output.args
      : undefined
  if (!argsObject) {
    return
  }

  const originalCommand = argsObject.command
  if (typeof originalCommand !== "string" || originalCommand.trim().length === 0) {
    return
  }

  if (!state.worktreeRoot) {
    return
  }

  const shellScriptPath = path.join(state.worktreeRoot, "scripts/shell_source.sh")
  const sourcePrefix = `. "${quoteShellPath(shellScriptPath)}" >/dev/null 2>&1 || true; `
  const rewritten = `${sourcePrefix}${originalCommand}`

  argsObject.command = rewritten
}
