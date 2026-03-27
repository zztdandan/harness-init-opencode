export const HARNESS_INIT_AGENT = "harness-init"

const INJECTED_SKILLS = [
  "harness-env-skill",
  "harness-repo-skill",
  "harness-agents-doc-skill",
] as const

type LooseConfig = Record<string, any>

type HandlerOptions = {
  builtinSkillsDir: string
  builtinAgentPath: string
}

function cloneConfig<T>(input: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(input)
  }

  return JSON.parse(JSON.stringify(input)) as T
}

export function createConfigHandler(options: HandlerOptions) {
  return async (inputConfig: LooseConfig = {}) => {
    const next = cloneConfig(inputConfig ?? {})

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
        description: "Harness workspace initializer orchestrator",
        mode: "primary",
        prompt: options.builtinAgentPath,
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
