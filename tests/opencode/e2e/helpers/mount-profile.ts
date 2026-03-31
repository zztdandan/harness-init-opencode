import { pathToFileURL } from "node:url"

export type MountProfileName = "opencode-dist"

export type MountProfile = {
  name: MountProfileName
  createConfig: (pluginDistIndexJs: string) => Record<string, unknown>
}

const OPENCODE_DIST_PROFILE: MountProfile = {
  name: "opencode-dist",
  createConfig(pluginDistIndexJs: string) {
    return {
      plugin: [pathToFileURL(pluginDistIndexJs).href],
    }
  },
}

export function resolveMountProfile(name: MountProfileName): MountProfile {
  if (name === "opencode-dist") return OPENCODE_DIST_PROFILE
  throw new Error(`unsupported mount profile: ${name}`)
}
