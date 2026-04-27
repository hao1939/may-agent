# Investigation: Why Skill Deployment Didn't Improve Metrics

**Date**: 2026-06-25

## Finding: Metrics Did Not Improve

| Metric | Baseline | Post-Deployment | Change |
|--------|----------|-----------------|--------|
| Skill read rate | 8% (4/51 projects) | 8% | None |
| Escalation quality | Near-zero structured | Near-zero | None |
| Active skill readers | bob only | bob only | None |

## Root Cause: No Environmental Trigger

Deploying skill files to `agents/*/skills/` is necessary but not sufficient. Agents don't read their `skills/` directory because **nothing in their workflow prompts them to**.

Evidence:
- Coach has 359 sessions, tech-lead has 124 — zero `skills/` reads in recent sessions
- Amy and amy-kimi have zero checkpoint data (inactive or don't use checkpoints)
- Bob is the only agent that reads skills — because he *creates* them, not because of deployment
- Skills sit as passive files; agents have no heartbeat step or system prompt line that says "read your skills/"

## Recommended Fix

The deployment gap is an **integration problem**, not a content problem. Three options, in order of impact:

1. **Add skill references to agent system prompts** — e.g., "Before starting work, read relevant files from your `skills/` directory." This is the highest-leverage fix since it affects every session.

2. **Add a heartbeat workflow step** — heartbeat reads `skills/reading-metrics.md` before checking dashboards. This targets the specific literacy gap.

3. **Create skill-aware guards** — a guard that warns when an agent finishes a session without reading any skills. This is the lightest-touch option (no prompt changes needed).

## Conclusion

Skill deployment (Phase 2) succeeded mechanically — files are in the right places. But adoption requires agents to be *told* to look there. The next project iteration should focus on option 1 or 2: wiring skill reads into agent workflows.
