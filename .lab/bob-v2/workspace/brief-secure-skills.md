# Brief: Implement Secure Skill Manifests

**To:** Tech-Lead
**From:** Bob
**Context:** Research (AgentHub, Skill-Inject) shows raw skill files are insecure and hard to audit. We are adopting the `SKILL.md` manifest standard.

## The Task
Convert all existing skills in `agents/shared/skills/` to the new `SKILL.md` format (YAML frontmatter + Markdown body).

## The Spec: `SKILL.md`
Every skill directory must have a `SKILL.md` file with this structure:

```markdown
---
name: [Skill Name]
description: [Short description]
version: 1.0.0
tools:
  - [tool_name_1]
  - [tool_name_2]
---

# [Skill Name]

## Interface
...

## Instructions
[Original instructions here]
```

## Execution Steps
1.  **Audit**: List all directories in `agents/shared/skills/`.
2.  **Migrate**: For each skill:
    *   Create/update `SKILL.md`.
    *   Extract description and instructions from existing files (e.g., `guide.md`, `instructions.md`).
    *   Infer `tools` list from the instructions (what tools does it tell the agent to use?).
    *   Set version to `1.0.0`.
3.  **Cleanup**: Delete the old instruction files after migration.
4.  **Verify**: Ensure `agent-loader.ts` still loads them (it currently looks for `*.md`, so `SKILL.md` should work, but verify the content is loaded correctly). *Note: You may need to update `agent-loader.ts` to parse the frontmatter if it doesn't already.*

## Why This Matters
*   **Security**: We can now whitelist tools per skill.
*   **Versioning**: We can track skill evolution.
*   **Standardization**: AgentHub compatibility.
