import { readFile } from "fs/promises"

import matter from "gray-matter"

export const HARNESS_INIT_AGENT = "harness-init"

const INJECTED_SKILLS = [
  "harness-agent-env",
  "harness-git-worktree",
  "harness-docs",
] as const

type LooseConfig = Record<string, any>

type HandlerOptions = {
  builtinSkillsDir: string
  builtinAgentPath: string
}

type AgentMode = "subagent" | "primary" | "all"

type ParsedAgentPrompt = {
  description: string
  mode: AgentMode
  prompt: string
}

const DEFAULT_AGENT_DESCRIPTION = "Harness workspace initializer and manager orchestrator"
const DEFAULT_AGENT_MODE: AgentMode = "primary"

function cloneConfig<T>(input: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(input)
  }

  return JSON.parse(JSON.stringify(input)) as T
}

function fallbackSanitization(content: string): string {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return content

  const frontmatter = match[1]
  const lines = frontmatter.split(/\r?\n/)
  const result: string[] = []

  for (const line of lines) {
    if (line.trim().startsWith("#") || line.trim() === "") {
      result.push(line)
      continue
    }

    if (line.match(/^\s+/)) {
      result.push(line)
      continue
    }

    const kvMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/)
    if (!kvMatch) {
      result.push(line)
      continue
    }

    const key = kvMatch[1]
    const value = kvMatch[2].trim()

    if (value === "" || value === ">" || value === "|" || value.startsWith('"') || value.startsWith("'")) {
      result.push(line)
      continue
    }

    if (value.includes(":")) {
      result.push(`${key}: |-`)
      result.push(`  ${value}`)
      continue
    }

    result.push(line)
  }

  const processed = result.join("\n")
  return content.replace(frontmatter, () => processed)
}

function parseAgentMode(value: unknown): AgentMode {
  if (value === "subagent" || value === "primary" || value === "all") {
    return value
  }

  return DEFAULT_AGENT_MODE
}

async function parseAgentPrompt(filePath: string): Promise<ParsedAgentPrompt> {
  const template = await readFile(filePath, "utf8")

  const parsed = (() => {
    try {
      return matter(template)
    } catch {
      return matter(fallbackSanitization(template))
    }
  })()

  const data = (parsed.data ?? {}) as Record<string, unknown>
  const description =
    typeof data.description === "string" && data.description.trim().length > 0
      ? data.description.trim()
      : DEFAULT_AGENT_DESCRIPTION
  const mode = parseAgentMode(data.mode)
  const prompt = parsed.content.trim()

  return {
    description,
    mode,
    prompt,
  }
}

export function createConfigHandler(options: HandlerOptions) {
  let cachedPrompt: Promise<ParsedAgentPrompt> | undefined

  const loadAgentPrompt = () => {
    if (!cachedPrompt) {
      cachedPrompt = parseAgentPrompt(options.builtinAgentPath)
    }

    return cachedPrompt
  }

  return async (inputConfig: LooseConfig = {}) => {
    const next = cloneConfig(inputConfig ?? {})
    const harnessAgent = await loadAgentPrompt()

    const existingPaths = Array.isArray(next.skills?.paths)
      ? [...next.skills.paths]
      : []

    if (!existingPaths.includes(options.builtinSkillsDir)) {
      existingPaths.push(options.builtinSkillsDir)
    }

    next.skills = {
      ...(next.skills ?? {}),
      paths: existingPaths,
    }

    next.agent = {
      ...(next.agent ?? {}),
      [HARNESS_INIT_AGENT]: {
        ...(next.agent?.[HARNESS_INIT_AGENT] ?? {}),
        description: harnessAgent.description,
        mode: harnessAgent.mode,
        prompt: harnessAgent.prompt,
      },
    }

    const existingSkillPermissions = {
      ...(next.permission?.skill ?? {}),
    }

    for (const skillName of INJECTED_SKILLS) {
      existingSkillPermissions[skillName] =
        existingSkillPermissions[skillName] ?? "allow"
    }

    next.permission = {
      ...(next.permission ?? {}),
      skill: existingSkillPermissions,
    }

    return next
  }
}
