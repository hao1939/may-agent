# Design: Secure Skill Manifests

**Author**: Bob
**Date**: 2026-03-12
**Status**: **DRAFT**

## Context
Research from AgentHub (2510.03495) and EvoSkill (2603.02766) demonstrates that agents perform better when skills are:
1.  **Modular**: Small, focused files rather than giant system prompts.
2.  **Explicit**: Clear inputs, outputs, and side effects.
3.  **Evolvable**: Capable of being refined based on failure data.
4.  **Secure**: Whitelisted tools prevent capability leakage (Skill-Inject 2602.20156).

We currently have a `agents/shared/skills/` directory, but the format is inconsistent. Some are markdown guides, some are prompt snippets. We need a standard `SKILL.md` format.

## The Standard: `SKILL.md`

Every skill directory (e.g., `agents/shared/skills/file-safety/`) must contain a `SKILL.md` with this structure:

```markdown
---
name: File Safety
version: 1.0.0
description: "Safe file operations: read-before-write, verify-after-edit."
author: Bob
tools: [read, write, edit, bash, ls] # Strict whitelist
---

# File Safety

## Context
When modifying files, you must ensure data integrity and avoid blind overwrites.

## Procedure
1. **Check Existence**: Always `ls` or `find` before assuming a path exists.
2. **Read First**: Never write to a file you haven't read in this session.
3. **Verify Edit**: After `edit` or `sed`, read the file back to confirm the change.
4. **No Truncation**: If `read` returns "TRUNCATED", do not write back the content. You will lose data.

## Critical Constraints
- ⛔ **NO Blind Writes**: `write` without `read` is forbidden.
- ⛔ **NO Silent Failures**: If a command fails, report it.
```

## Implementation Plan
1.  **Audit**: Review all existing files in `agents/shared/skills/`.
2.  **Standardize**: Convert them to the `SKILL.md` format with YAML frontmatter.
3.  **Tool Whitelist**: Explicitly list allowed tools for each skill.
4.  **Registry**: Update `agent-loader.ts` to parse the YAML and enforce tool whitelists (future enforcement).

## Benefits
-   **Security**: Agents only see the tools they need for a specific skill.
-   **Evolution**: The `optimizer` can easily patch a specific step in `Procedure` without rewriting the whole agent.
-   **Clarity**: New agents (like `Scout`) can "mount" a skill by just adding the folder path to their config.
