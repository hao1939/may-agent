# Skills Inventory

**Last updated**: Iteration 2

## Existing Skills: 2

| Skill | Path | Actionable? | Complete? | Quality |
|-------|------|------------|-----------|---------|
| reading-metrics | `agents/shared/skills/reading-metrics/skill.md` | ✅ Yes | ✅ Yes | Good |
| closing-the-loop | `agents/shared/skills/closing-the-loop/skill.md` | ✅ Yes | ✅ Yes | Good |

## Quality Assessment

### reading-metrics
**Verdict: Actionable and complete.**
- Clear trigger ("every heartbeat")
- Concrete decision table (✅/📉/🔴 → action)
- Step-by-step process: understand → check history → find cause → act/escalate → prevent recurrence
- Includes evolution ladder (skill → guard → handler)
- Anti-patterns listed
- An agent reading this would behave differently: it would follow a structured triage instead of ad-hoc metric responses.

### closing-the-loop
**Verdict: Actionable and complete.**
- Clear trigger ("when you've fixed a problem")
- Decision matrix based on pattern frequency (one-off → fix, twice → skill, known → guard, mechanical → handler)
- Specifies exact file paths for each level
- Step-by-step process with anti-patterns
- An agent reading this would know when to write a skill vs guard vs handler, and where to put it.

## Adoption: 0/2

Neither skill is referenced by any agent configuration. No agent will encounter these skills during normal operation.

## Adoption Path Analysis

### How agents receive instructions
- `/app/agents/bob/` — contains only `last-session.md` and a workspace project. **No system prompt, no agent.md, no config file.**
- `/app/agents/may/` — **empty directory**. No agent config at all.
- No `agent.md`, `system.md`, or `prompt.*` files found anywhere in `/app/agents/`.

### Skill loading infrastructure exists but is unwired
**Key discovery**: `/app/src/skills.ts` implements a full skill loading system:
1. `loadSkillsFromDirs(dirs)` — scans directories for `skill.md` files, parses frontmatter
2. `formatSkillsForPrompt(skills)` — formats skills as XML for system prompt injection
3. Supports both root `.md` files and `SKILL.MD` in subdirectories

**The problem**: Nothing calls these functions. `grep` for `loadSkillsFromDirs` and `formatSkillsForPrompt` outside `skills.ts` returns zero results. The infrastructure is built but never integrated into the agent prompt pipeline.

### Additionally: skills now have frontmatter ✅
As of Iteration 3, both skills have YAML frontmatter with `name` and `description` fields. `loadSkillsFromDirs(['agents/shared/skills'])` returns both skills successfully. This blocker is resolved.

### What needs to happen for adoption
1. **Add frontmatter** to both skill files with `name` and `description` fields
2. **Wire `loadSkillsFromDirs`** into whatever builds agent system prompts (needs investigation of prompt assembly code)
3. **Configure skill directories** — pass `['agents/shared/skills']` to the loader

This is a code change, not a config change. Someone needs to find where agent prompts are assembled and call the skill loader there.
