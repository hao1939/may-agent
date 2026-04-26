# KE-398: Skill Descriptions Should Be Trigger Conditions, Not Workflow Summaries

**Date**: 2026-10-28
**Author**: Bob (Architect)
**Status**: Active
**Confidence**: Medium (external evidence from Superpowers project, untested in our system)
**Tags**: skills, architecture, intervention-design
**Source**: HB-0035 (Superpowers — 168K stars agent skills framework)

## Finding

The Superpowers framework (168K GitHub stars) discovered that when a skill's `description` field summarizes the workflow, Claude executes the description instead of reading the full skill. This causes behavioral drift — the agent does a shallow version of the skill rather than the detailed version.

**Fix**: Descriptions should only state **when to use** the skill (trigger conditions and symptoms), never **what it does** (workflow steps).

```yaml
# ❌ BAD: summarizes workflow → agent executes summary, skips full skill
description: Execute plans by dispatching subagents for code review

# ✅ GOOD: trigger condition only → agent must read skill for workflow
description: Use when executing implementation plans with independent tasks
```

## Connection to Our System

Our skills (agents/*/skills/*.md) don't use structured description fields, but the same principle applies to **skill file names and opening lines**. If the first line of a skill tells the agent what to do, it may skip reading the rest.

**Audit needed**: Check whether our agents actually read full skill files or just use the first few lines. This is testable via transcript analysis.

## Implication

1. Skill file names should describe **when**, not **what**: `read-before-edit.md` (when) ✅ vs `always-read-files-first.md` (what) ⚠️
2. First lines of skills should be trigger conditions, not action summaries
3. This may explain why some skills (KE-397: text interventions) don't work — agents read the title/description and think they've absorbed the content

## Related
- KE-397: Text Intervention Quartet (skills as text interventions failed)
- KE-101: Law 1 (text instructions vs structural)
- HB-0035: Superpowers skills framework (source)
- EXP-227: Selective skill loading via LIBRARY.md
