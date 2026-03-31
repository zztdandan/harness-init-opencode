import path from "node:path"

export const CASE_ID = "opencode-dist-loads-agent-and-skills-from-repo-dist"

export const BUILD_TIMEOUT_MS = 120_000
export const DEBUG_TIMEOUT_MS = 30_000

export const REQUIRED_AGENT = "harness-init"
export const REQUIRED_SKILLS = [
  "harness-env-skill",
  "harness-repo-skill",
  "harness-agents-doc-skill",
] as const

export const ENV_OPENCODE_CLI = "OPENCODE_CLI"
export const ENV_ALLOW_FALLBACK = "E2E_ALLOW_CLI_FALLBACK"
export const ENV_KEEP_WORKSPACE = "E2E_KEEP_WORKSPACE"

export const REPO_ROOT = path.resolve(import.meta.dir, "../../../../")
export const WORKSPACES_ROOT = path.join(REPO_ROOT, "tests/opencode/e2e/workspaces")
