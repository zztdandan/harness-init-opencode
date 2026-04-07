import { assertHasPrefix, normalizeObservedPath } from "./path-utils"

export function parseJsonOutput<T>(stdout: string, context: string): T {
  try {
    return JSON.parse(stdout) as T
  } catch {
    throw new Error(`expected JSON output from ${context}\nstdout:\n${stdout}`)
  }
}

export function assertDebugAgentShape(agent: unknown): asserts agent is {
  name: string
  mode: string
  prompt: string
} {
  if (!agent || typeof agent !== "object") {
    throw new Error("debug agent output must be an object")
  }

  const value = agent as Record<string, unknown>
  if (typeof value.name !== "string") throw new Error("debug agent output missing string field: name")
  if (typeof value.mode !== "string") throw new Error("debug agent output missing string field: mode")
  if (typeof value.prompt !== "string") throw new Error("debug agent output missing string field: prompt")
}

export function assertDebugSkillShape(skills: unknown): asserts skills is Array<{ name: string; location: string }> {
  if (!Array.isArray(skills)) {
    throw new Error("debug skill output must be an array")
  }

  for (const skill of skills) {
    if (!skill || typeof skill !== "object") {
      throw new Error("debug skill item must be an object")
    }
    const value = skill as Record<string, unknown>
    if (typeof value.name !== "string") throw new Error("debug skill item missing string field: name")
    if (typeof value.location !== "string") throw new Error("debug skill item missing string field: location")
  }
}

export function assertDebugConfigHasPlugin(config: unknown, distPluginEntryPath: string): void {
  if (!config || typeof config !== "object") {
    throw new Error("debug config output must be a JSON object")
  }

  const strings: string[] = []
  const walk = (value: unknown) => {
    if (typeof value === "string") {
      strings.push(value)
      return
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item)
      return
    }
    if (value && typeof value === "object") {
      for (const item of Object.values(value as Record<string, unknown>)) {
        walk(item)
      }
    }
  }

  walk(config)

  const needle = distPluginEntryPath.replace(/\\/g, "/")
  const found = strings.some((entry) => entry.replace(/\\/g, "/").includes("/dist/harness_init.js") || entry.includes(needle))
  if (!found) {
    throw new Error(`debug config does not include expected dist plugin mount: ${needle}`)
  }
}

export function assertConfigContainsHarnessDefinitions(input: {
  config: unknown
  requiredAgent: string
  requiredSkills: readonly string[]
  expectedAgentPromptPrefix: string
  expectedSkillsPathPrefix: string
}): void {
  if (!input.config || typeof input.config !== "object") {
    throw new Error("debug config output must be a JSON object")
  }

  const config = input.config as Record<string, unknown>
  const agentMap = (config.agent ?? {}) as Record<string, unknown>
  const agent = agentMap[input.requiredAgent]
  if (!agent || typeof agent !== "object") {
    throw new Error(`debug config missing required agent definition: ${input.requiredAgent}`)
  }
  const agentConfig = agent as Record<string, unknown>
  if (agentConfig.mode !== "primary") {
    throw new Error(`agent mode must stay primary, got: ${String(agentConfig.mode)}`)
  }
  if (typeof agentConfig.prompt !== "string") {
    throw new Error(`agent prompt must be a string for ${input.requiredAgent}`)
  }
  const rawPrompt = agentConfig.prompt
  if (rawPrompt.includes("\n")) {
    if (rawPrompt.trim().length === 0) {
      throw new Error(`agent prompt must not be empty for ${input.requiredAgent}`)
    }
  } else {
    const prompt = normalizeObservedPath(rawPrompt)
    assertHasPrefix(
      prompt,
      input.expectedAgentPromptPrefix,
      `agent ${input.requiredAgent} prompt must resolve under dist agents`,
    )
  }

  const skills = (config.skills ?? {}) as Record<string, unknown>
  const paths = Array.isArray(skills.paths) ? skills.paths : []
  const normalizedSkillsPrefix = input.expectedSkillsPathPrefix.replace(/\/+$/, "")
  const hasSkillsPath = paths.some((value) => {
    if (typeof value !== "string") return false
    const resolved = normalizeObservedPath(value)
    return resolved === normalizedSkillsPrefix || resolved.startsWith(`${normalizedSkillsPrefix}/`)
  })
  if (!hasSkillsPath) {
    throw new Error(`debug config missing expected skills path prefix: ${input.expectedSkillsPathPrefix}`)
  }

  const permission = (config.permission ?? {}) as Record<string, unknown>
  const skillPermission = (permission.skill ?? {}) as Record<string, unknown>
  for (const name of input.requiredSkills) {
    if (skillPermission[name] !== "allow") {
      throw new Error(`skill permission must be allow for ${name}`)
    }
  }
}

export function assertRequiredSkillsFromDist(
  skills: unknown,
  requiredSkills: readonly string[],
  expectedPrefix: string,
): void {
  assertDebugSkillShape(skills)

  for (const required of requiredSkills) {
    const match = skills.find((item) => item.name === required)
    if (!match) {
      throw new Error(`required skill missing: ${required}`)
    }

    const location = normalizeObservedPath(match.location)
    assertHasPrefix(location, expectedPrefix, `skill ${required} must resolve under dist skills`)
  }
}

export function assertRequiredAgentFromDist(
  agent: unknown,
  requiredAgent: string,
  expectedPromptPrefix: string,
): void {
  assertDebugAgentShape(agent)

  if (agent.name !== requiredAgent) {
    throw new Error(`unexpected agent name: ${agent.name}`)
  }

  if (agent.mode !== "primary") {
    throw new Error(`agent mode must stay primary, got: ${agent.mode}`)
  }

  const prompt = normalizeObservedPath(agent.prompt)
  assertHasPrefix(prompt, expectedPromptPrefix, `agent ${requiredAgent} prompt must resolve under dist agents`)
}
