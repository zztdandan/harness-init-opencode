import path from "node:path"
import { fileURLToPath } from "node:url"

import { createConfigHandler } from "./handlers/config-handler"

export type Plugin = {
  name: string
  config?: (inputConfig: Record<string, any>) => Promise<Record<string, any>>
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

export function createHarnessInitPlugin(paths: BuiltinPathOptions): Plugin {
  return {
    name: "harness-init-plugin",
    config: createConfigHandler(paths),
  }
}

const runtimeFile = fileURLToPath(import.meta.url)
const runtimePaths = resolveBuiltinPaths(runtimeFile)

const plugin = createHarnessInitPlugin(runtimePaths)

export default plugin
