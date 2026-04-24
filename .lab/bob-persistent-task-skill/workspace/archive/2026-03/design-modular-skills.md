# Design: Modular Skill Registry & Progressive Disclosure

**Status:** Draft
**Owner:** Bob
**Date:** 2026-03-10

## Context
Agent system prompts (`SOUL.md` + `SKILL.md` + `TOOLS.md`) are hitting context limits and becoming hard to maintain. "God prompts" reduce instruction adherence because the LLM dilutes its attention across too many tokens.

## Goal
Transition from **Monolithic System Prompts** to **Modular Skills**.
- **Decompose**: Break giant prompts into atomic "Skill" files.
- **Register**: Centralize skills in `agents/shared/skills/`.
- **Compose**: Agents declare which skills they need in `agent.json`.
- **Load**: The runner injects only the necessary skills at runtime.

## The Pattern: "Skill" as a Unit of Behavior

A "Skill" is a discrete unit of agent capability. It includes:
1.  **Instructions**: How to perform the skill (Markdown).
2.  **Examples**: Few-shot examples of the skill in action (optional).
3.  **Tool Definitions**: (Future) specific tools required for this skill.

### File Structure
```
agents/shared/skills/
├── git-management/
│   └── SKILL.md       <-- The instruction content
├── code-verification/
│   └── SKILL.md
├── web-research/
│   └── SKILL.md
└── sub-agent-coordination/
    └── SKILL.md
```

### Schema (`SKILL.md`)
```markdown
---
name: git-management
description: Conventions for committing, branching, and squashing.
version: 1.0
---

# Git Management

## Core Rules
1. Never commit without QA...
2. Use conventional commits...

## Common Patterns
...
```

## Consumption (The "Import")

Agents declare dependencies in `agent.json`.

**Current State (Implicit):**
The runner naively concatenates `agents/shared/skills/*/SKILL.md`.

**Target State (Explicit):**
`agent.json`:
```json
{
  "name": "coder",
  "skills": [
    "git-management",
    "code-verification",
    "file-operations"
  ]
}
```

## Migration Strategy

We will move from **Implicit Global Loading** to **Explicit Agent Loading**.

### Phase 1: Audit & Extraction (Current)
Identify implicit skills buried in `SOUL.md` and extract them to `agents/shared/skills/`.
*Candidates:*
- `file-safety` (Truncation checks, read-before-write) -> currently in every SOUL.
- `communication` (Brief answers, no fluff) -> currently in every SOUL.
- `error-handling` (Escalation protocols) -> currently in every SOUL.

### Phase 2: Explicit Registry
Update `agent.json` to support a `"skills": []` array.
Update the `runtime` (manager/runner) to read this array and construct the prompt dynamically.

### Phase 3: Lazy Loading (Future)
For very large skill sets, we can inject skills *into the context* only when a specific tool is selected or a keyword is triggered. (Out of scope for now; static composition is enough).

## Immediate Action Plan

1.  **Standardize `file-safety`**: Extract the "Read Before Write / Truncation" rules into `agents/shared/skills/file-safety/SKILL.md`.
2.  **Standardize `error-handling`**: Extract "No Silent Failures / Escalation" rules into `agents/shared/skills/error-handling/SKILL.md`.
3.  **Update `agent.json`**: Add the `skills` field to all agents.
4.  **Brief Tech Lead**: Hand off the loader implementation.
