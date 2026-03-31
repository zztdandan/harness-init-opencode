import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

function hasScheme(input: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(input)
}

function normalizeSeparators(input: string): string {
  return input.replace(/\\/g, "/")
}

export function canonicalPath(input: string): string {
  const absolute = path.isAbsolute(input) ? input : path.resolve(input)
  const resolved = fs.realpathSync(absolute)
  return normalizeSeparators(resolved)
}

export function normalizeObservedPath(value: string): string {
  if (hasScheme(value)) {
    const parsed = new URL(value)
    if (parsed.protocol !== "file:") {
      throw new Error(`unsupported URL scheme in observed path: ${parsed.protocol}`)
    }
    return canonicalPath(fileURLToPath(parsed))
  }

  return canonicalPath(value)
}

export function assertHasPrefix(actual: string, expectedPrefix: string, message: string): void {
  const normalizedActual = normalizeSeparators(actual)
  const normalizedPrefix = normalizeSeparators(expectedPrefix)

  if (!normalizedActual.startsWith(normalizedPrefix)) {
    throw new Error(`${message}\nexpected prefix: ${normalizedPrefix}\nactual path: ${normalizedActual}`)
  }
}
