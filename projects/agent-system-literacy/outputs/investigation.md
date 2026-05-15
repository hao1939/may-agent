# Investigation: Why Literacy Metrics Did Not Improve

**Date**: 2025-06-25

## Finding

After deploying 3 literacy skills (`reading-metrics`, `escalation`, `closing-the-loop`) to 4 agents (amy, amy-kimi, coach, tech-lead), **no improvement was observed** in any target metric:

- **Skill read rate**: 0% → 0% (unchanged)
- **Escalation quality**: Near-zero → Near-zero (unchanged)

## Root Cause

**Agents have no environmental trigger to read their `skills/` directory.**

Skills were deployed as passive files. But agents only read files they're explicitly told to read — via system prompts, heartbeat workflows, or task instructions. No agent's configuration references `skills/` as a directory to consult during sessions.

Evidence:
- Coach (359 sessions) and tech-lead (124 sessions) — zero `skills/` references in checkpoints
- The only agent reading skills (bob) does so because he *creates* them, not because of deployment
- Amy and amy-kimi have zero checkpoint data — likely inactive

## Recommended Fix

Three options, in order of impact:

1. **Add skill references to agent system prompts** — e.g., "Before handling escalations, read `skills/escalation.md`"
2. **Add skill reads to heartbeat workflows** — heartbeat checks `skills/` directory and loads relevant skills into context
3. **Add skill references to task templates** — when dispatching work, include "Reference: skills/reading-metrics.md"

Option 2 is the most scalable — it doesn't require per-task changes and ensures skills are loaded every session.
