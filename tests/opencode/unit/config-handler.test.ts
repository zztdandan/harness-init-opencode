import { describe, expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

import {
  HARNESS_INIT_AGENT,
  createConfigHandler,
} from "../../../src/handlers/config-handler"

describe("createConfigHandler", () => {
  test("injects skills path, agent, and permissions", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "harness-agent-"))
    const agentPath = join(tempDir, "harness-init.md")
    await writeFile(
      agentPath,
      `---
description: Harness init agent loaded from frontmatter
mode: primary
---

# harness-init

Gate A
`,
      "utf8",
    )

    const handle = createConfigHandler({
      builtinSkillsDir: "/plugin/skills",
      builtinAgentPath: agentPath,
    })

    const next = await handle({})

    try {
      expect(next.skills.paths).toEqual(["/plugin/skills"])
      expect(next.agent[HARNESS_INIT_AGENT].mode).toBe("primary")
      expect(next.agent[HARNESS_INIT_AGENT].description).toBe(
        "Harness init agent loaded from frontmatter",
      )
      expect(next.agent[HARNESS_INIT_AGENT].prompt).toContain("Gate A")
      expect(next.permission.skill["harness-agent-env"]).toBe("allow")
      expect(next.permission.skill["harness-git-worktree"]).toBe("allow")
      expect(next.permission.skill["harness-docs"]).toBe("allow")
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test("keeps existing user config and stays idempotent", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "harness-agent-"))
    const agentPath = join(tempDir, "harness-init.md")
    await writeFile(
      agentPath,
      `---
description: Harness init agent
mode: primary
---

Prompt body.
`,
      "utf8",
    )

    const handle = createConfigHandler({
      builtinSkillsDir: "/plugin/skills",
      builtinAgentPath: agentPath,
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

    try {
      expect(twice.skills.paths).toEqual(["/user/skills", "/plugin/skills"])
      expect(twice.agent.existing.description).toBe("existing")
      expect(twice.permission.skill["user-skill"]).toBe("allow")
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test("does not force default agent", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "harness-agent-"))
    const agentPath = join(tempDir, "harness-init.md")
    await writeFile(
      agentPath,
      `---
description: Harness init agent
mode: primary
---

Prompt body.
`,
      "utf8",
    )

    const handle = createConfigHandler({
      builtinSkillsDir: "/plugin/skills",
      builtinAgentPath: agentPath,
    })

    const next = await handle({
      defaultAgent: "general",
    })

    try {
      expect(next.defaultAgent).toBe("general")
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test("parses fallback-compatible frontmatter for agent prompt", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "harness-agent-"))
    const agentPath = join(tempDir, "harness-init.md")
    await writeFile(
      agentPath,
      `---
description: Harness: init workspace with guarded gates
mode: primary
---

Fallback parsing prompt body.
`,
      "utf8",
    )

    const handle = createConfigHandler({
      builtinSkillsDir: "/plugin/skills",
      builtinAgentPath: agentPath,
    })

    const next = await handle({})

    try {
      expect(next.agent[HARNESS_INIT_AGENT].description).toBe(
        "Harness: init workspace with guarded gates",
      )
      expect(next.agent[HARNESS_INIT_AGENT].prompt).toBe(
        "Fallback parsing prompt body.",
      )
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
