import path from "node:path"

import { createConfigHandler } from "./handlers/config-handler"

export type PluginHooks = {
  name: string
  config?: (inputConfig: Record<string, any>) => Promise<void>
}

export type BuiltinPathOptions = {
  builtinSkillsDir: string
  builtinAgentPath: string
}

export function resolveBuiltinPaths(moduleFile: string): BuiltinPathOptions {
  const baseDir = path.dirname(moduleFile)

  return {
    builtinSkillsDir: path.resolve(baseDir, "builtin/skills"),
    builtinAgentPath: path.resolve(baseDir, "builtin/agents/harness-init.md"),
  }
}

export function createHarnessInitPlugin(paths: BuiltinPathOptions): PluginHooks {
  const applyConfig = createConfigHandler(paths)

  return {
    name: "harness-init-plugin",
    async config(inputConfig: Record<string, any>) {
      const next = await applyConfig(inputConfig)
      Object.assign(inputConfig, next)
    },
  }
}
