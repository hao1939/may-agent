# Proposal: Modular Skill Registry (Phase 1)

**Status:** Ready for Implementation
**Owner:** Bob
**Date:** 2026-03-10

## Overview
We are refactoring the monolithic system prompts (`SOUL.md`) into reusable, atomic "Skills" stored in `agents/shared/skills/`. This allows agents to mix-and-match capabilities without duplication and ensures critical protocols (like File Safety) are applied uniformly.

## Changes
1.  **Created `agents/shared/skills/file-safety/SKILL.md`**: Extracted core file integrity rules (Read Before Write, Truncation Awareness).
2.  **Created `agents/shared/skills/error-handling/SKILL.md`**: Extracted core error management rules (No Silent Failures, Escalation).
3.  **Plan**: Update `agent.json` to include these skills explicitly.

## Action Items (For Tech Lead)
1.  **Update `src/lib/agent-loader.ts`**:
    - Add logic to read `skills: []` from `agent.json`.
    - Inject the content of `agents/shared/skills/{skill}/SKILL.md` into the system prompt.
2.  **Update `agent.json` Files**:
    - Add `"skills": ["file-safety", "error-handling"]` to all agents.
3.  **Refactor `SOUL.md`**:
    - Remove the duplicated sections from individual agent SOULs once the loader is verified.

## Success Criteria
- **Zero Regression**: Agents continue to follow file safety rules.
- **Reduced Token Count**: System prompts are smaller (deduplicated).
- **Easier Updates**: Changing a rule in one place updates all agents.
