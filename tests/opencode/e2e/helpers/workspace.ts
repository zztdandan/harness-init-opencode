import fs from "node:fs"
import path from "node:path"

import { WORKSPACES_ROOT } from "./constants"
import { type MountProfileName, resolveMountProfile } from "./mount-profile"

export type WorkspaceInfo = {
  workspacePath: string
  configPath: string
}

export function prepareWorkspace(input: {
  caseId: string
  profile: MountProfileName
  pluginDistIndexJs: string
}): WorkspaceInfo {
  const workspacePath = path.join(WORKSPACES_ROOT, input.caseId)
  fs.rmSync(workspacePath, { recursive: true, force: true })
  fs.mkdirSync(workspacePath, { recursive: true })

  const profile = resolveMountProfile(input.profile)
  const config = profile.createConfig(input.pluginDistIndexJs)
  const configPath = path.join(workspacePath, "opencode.json")
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8")

  return {
    workspacePath,
    configPath,
  }
}

export function cleanupWorkspace(workspacePath: string, keep: boolean): void {
  if (keep) return
  fs.rmSync(workspacePath, { recursive: true, force: true })
}
