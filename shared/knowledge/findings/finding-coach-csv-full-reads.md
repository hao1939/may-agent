# Finding: Coach common-sense-verify reads full session.jsonl files

**Date**: 2026-03-18T20:19
**Severity**: Medium-High (cost waste)
**Status**: ⚠️ NEEDS FIX

## Problem

Coach's `common-sense-verify` cron task generates 800KB-965KB sessions despite the cron message explicitly telling it NOT to read full session.jsonl files.

### Evidence

Session `s_1773823602315_6`: 965KB, 45 turns
- 15 tool results over 20KB each
- Multiple full session.jsonl reads (36KB, 50KB, 44KB, 52KB)
- Common-sense tracker (23KB) read 4 times in same session
- Total tool result data: ~500KB+

Session `s_1773838000624_48`: 799KB, 34 turns - same pattern

### Root Causes

1. **Coach ignores the grep-based instruction** in the cron message and reads full session.jsonl files via `read` tool
2. **Common-sense tracker file is 23KB** and gets re-read multiple times (4x in one session)
3. **No tool-level guardrail** prevents reading large session files

### Cost Impact

- 3 common-sense-verify sessions in 12h = 1.9MB transcript
- At ~$5/MB estimated cost ≈ $9.50/12h = $19/day from this one cron task
- Compare: should be <100KB per run if using grep

### Proposed Fixes

1. **Compact the common-sense-tracker.md** — it's 23KB, should be <5KB. Remove verbose evidence/quotes.
2. **Add session.jsonl read guard** — enhance the existing read-dedup-guard to also block reads of session.jsonl files >10KB for non-evaluator agents, returning a "use grep instead" hint.
3. **Add opBudget override for common-sense-verify** — the cron config doesn't set an opBudget, so coach uses its default. Set opBudget=10 for this task.

## Also Noted

- **Evaluator transcript cap (f16bf11) still not deployed** — process running since 08:45 UTC, commit was at 19:56 UTC. Tree-eval sessions still have 45KB, 25KB, 18KB per-session transcripts (should be capped at 15KB). All 8 commits since 08:45 are undeployed.
- **Coach 13 heartbeats in 12h** = correct for 60min interval (includes startup catchup). Child sessions from training sprints add 11 more sessions.
- **Total system: 139 sessions in 12h (~11.6/hr), 18.9MB transcript, 10MB of which is tool results (53%)**.
