import { spawnSync } from "node:child_process"

import { ENV_ALLOW_FALLBACK, ENV_OPENCODE_CLI } from "./constants"

export type CommandResult = {
  command: string
  args: string[]
  cwd: string
  exitCode: number | null
  timedOut: boolean
  stdout: string
  stderr: string
}

export function resolveOpencodeCli(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env[ENV_OPENCODE_CLI]?.trim()
  if (configured) return configured

  if (env[ENV_ALLOW_FALLBACK] === "1") {
    return "opencode"
  }

  throw new Error(`${ENV_OPENCODE_CLI} is required for automated runs`)
}

export function runCommand(input: {
  command: string
  args?: string[]
  cwd: string
  timeoutMs: number
}): CommandResult {
  const args = input.args ?? []
  const result = spawnSync(input.command, args, {
    cwd: input.cwd,
    encoding: "utf8",
    timeout: input.timeoutMs,
    stdio: "pipe",
  })

  if (result.error && !(result.error as NodeJS.ErrnoException).code?.includes("ETIMEDOUT")) {
    throw new Error(
      [
        `command execution error: ${input.command} ${args.join(" ")}`,
        `cwd: ${input.cwd}`,
        `error: ${result.error.message}`,
      ].join("\n"),
    )
  }

  return {
    command: input.command,
    args,
    cwd: input.cwd,
    exitCode: result.status,
    timedOut: Boolean(result.error && (result.error as NodeJS.ErrnoException).code?.includes("ETIMEDOUT")),
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  }
}

export function assertSuccess(result: CommandResult): void {
  if (result.timedOut) {
    throw new Error(
      [
        `command timed out: ${result.command} ${result.args.join(" ")}`,
        `cwd: ${result.cwd}`,
        `stdout:\n${result.stdout}`,
        `stderr:\n${result.stderr}`,
      ].join("\n"),
    )
  }

  if (result.exitCode !== 0) {
    throw new Error(
      [
        `command failed with exit code ${String(result.exitCode)}: ${result.command} ${result.args.join(" ")}`,
        `cwd: ${result.cwd}`,
        `stdout:\n${result.stdout}`,
        `stderr:\n${result.stderr}`,
      ].join("\n"),
    )
  }
}
