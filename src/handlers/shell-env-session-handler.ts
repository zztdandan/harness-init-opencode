import { readFile } from "node:fs/promises"
import path from "node:path"

export const SESSION_ENV_SCHEMA = "harness-shell-env/v1"

const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

type SessionEnvPayload = {
  schema?: unknown
  env?: unknown
}

type LoadSessionEnvCacheOptions = {
  worktreeRoot: string
  readTextFile?: (filePath: string) => Promise<string>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function sanitizeEnv(input: Record<string, unknown>): Record<string, string> {
  const next: Record<string, string> = {}

  for (const [key, value] of Object.entries(input)) {
    if (!ENV_KEY_PATTERN.test(key)) {
      continue
    }

    if (value === null || typeof value === "undefined") {
      continue
    }

    next[key] = String(value)
  }

  return next
}

export function resolveWorktreeRoot(input: Record<string, any> = {}): string | undefined {
  const candidates = [
    input.worktree,
    input.session?.worktree,
    input.session?.workspace,
    input.workspace?.root,
    input.properties?.worktree,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate
    }
  }

  return undefined
}

export async function loadSessionEnvCache(
  options: LoadSessionEnvCacheOptions,
): Promise<Record<string, string>> {
  const filePath = path.join(options.worktreeRoot, "scripts/session_env.json")
  const readTextFile = options.readTextFile ?? ((targetPath: string) => readFile(targetPath, "utf8"))

  let content: string
  try {
    content = await readTextFile(filePath)
  } catch {
    return {}
  }

  let parsed: JsonValue
  try {
    parsed = JSON.parse(content) as JsonValue
  } catch {
    return {}
  }

  if (!isRecord(parsed)) {
    return {}
  }

  const payload = parsed as SessionEnvPayload

  // Backward compatible with legacy flat KV format:
  // { "KEY": "value" }
  // Preferred format remains: { schema: "harness-shell-env/v1", env: { ... } }
  if (typeof payload.schema === "undefined" && typeof payload.env === "undefined") {
    return sanitizeEnv(parsed)
  }

  if (payload.schema !== SESSION_ENV_SCHEMA) {
    return {}
  }

  if (!isRecord(payload.env)) {
    return {}
  }

  return sanitizeEnv(payload.env)
}
