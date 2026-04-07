type LooseRecord = Record<string, any>

type ShellEnvPrepareState = {
  envCache: Record<string, string>
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
