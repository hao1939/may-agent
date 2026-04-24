# H-EXP-012 Phase 1 Audit: Knowledge Activation Gap

**Date**: 2026-07-20 | **Author**: coach

## Key Finding

**6 out of 8 mid-session environment errors violated facts that ALREADY exist in the agent's context.md.**

The problem is NOT missing knowledge — it's knowledge activation failure.

## Evidence (from recent evals, quality < 0.8)

| # | Agent | Issue | Relevant context.md fact | Already Known? |
|---|-------|-------|-------------------------|---------------|
| 1 | QA (0.45) | git commands in non-git /app directory | "agents/ is a separate git repo — commit from agents/ dir" | ✅ YES |
| 2 | QA (0.45) | tried tsc in /app where node_modules doesn't exist | "tsc available at ./node_modules/.bin/tsc" (path ambiguous) | ⚠️ PARTIAL |
| 3 | tech-lead (0.78) | PATH_HALLUCINATION to nonexistent paths | "Project root is /app — do not use other paths" | ✅ YES |
| 4 | tech-lead (0.78) | Git repo root confusion /app vs /app/agents | "agents/ is a separate git repo" | ✅ YES |
| 5 | coach (0.65) | attempted sqlite3 CLI (not installed) | "sqlite3 CLI is not available" | ✅ YES |
| 6 | coach (0.65) | searching for gym runner in wrong path | "Gym runner: scripts/gym-run.sh" | ✅ YES |
| 7 | optimizer (0.2) | find commands returning irrelevant paths | No specific fact | ❌ MISSING |
| 8 | bob (0.55) | scope drift on path discovery | Various path facts exist | ⚠️ PARTIAL |

**Known but violated: 6/8 (75%)**

## Interpretation

Adding MORE facts to context.md won't help — the facts are already there. The agents fail to *activate* existing knowledge at the right moment.

Possible activation interventions to test:
1. **Structural emphasis**: Move env facts to a `## STOP — Read Before Your First Bash Command` section at the TOP of context.md
2. **Mandatory orientation step**: First bash call must be `pwd && ls` (forces grounding)
3. **Grouped env block**: Consolidate scattered env facts into a single "Environment Quick-Ref" block

## Recommendation

Design EXP targeting structural emphasis (#1 above) — it's the simplest intervention with broadest reach. Test in gym using existing `wrong-directory` and `cc-hallucinated-paths` scenarios.

## H-EXP-012 Status Update

Phase 1 finding pivots the hypothesis from "add missing env facts" to "activate existing env facts through structural emphasis." Phase 2 should design the intervention; Phase 3 tests it in gym.
