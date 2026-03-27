import { describe, expect, test } from "bun:test"

import {
  HARNESS_INIT_AGENT,
  createConfigHandler,
} from "../src/handlers/config-handler"

describe("createConfigHandler", () => {
  test("injects skills path, agent, and permissions", async () => {
    const handle = createConfigHandler({
      builtinSkillsDir: "/plugin/skills",
      builtinAgentPath: "/plugin/agents/harness-init.md",
    })

    const next = await handle({})

    expect(next.skills.paths).toEqual(["/plugin/skills"])
    expect(next.agent[HARNESS_INIT_AGENT].mode).toBe("primary")
    expect(next.agent[HARNESS_INIT_AGENT].prompt).toBe(
      "/plugin/agents/harness-init.md",
    )
    expect(next.permission.skill["harness-env-skill"]).toBe("allow")
    expect(next.permission.skill["harness-repo-skill"]).toBe("allow")
    expect(next.permission.skill["harness-agents-doc-skill"]).toBe("allow")
  })

  test("keeps existing user config and stays idempotent", async () => {
    const handle = createConfigHandler({
      builtinSkillsDir: "/plugin/skills",
      builtinAgentPath: "/plugin/agents/harness-init.md",
    })

    const original = {
      skills: { paths: ["/user/skills"] },
      agent: {
        existing: { description: "existing", mode: "primary" },
      },
      permission: {
        skill: {
          "user-skill": "allow",
        },
      },
    }

    const once = await handle(original)
    const twice = await handle(once)

    expect(twice.skills.paths).toEqual(["/user/skills", "/plugin/skills"])
    expect(twice.agent.existing.description).toBe("existing")
    expect(twice.permission.skill["user-skill"]).toBe("allow")
  })

  test("does not force default agent", async () => {
    const handle = createConfigHandler({
      builtinSkillsDir: "/plugin/skills",
      builtinAgentPath: "/plugin/agents/harness-init.md",
    })

    const next = await handle({
      defaultAgent: "general",
    })

    expect(next.defaultAgent).toBe("general")
  })
})
