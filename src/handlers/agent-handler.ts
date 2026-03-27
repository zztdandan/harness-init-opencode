export const HARNESS_AGENT_NAME = "harness-init"

export function createHarnessAgentConfig(promptPath: string) {
  return {
    [HARNESS_AGENT_NAME]: {
      description: "Initialize harness workspace with guarded workflow",
      mode: "primary",
      prompt: promptPath,
    },
  }
}
