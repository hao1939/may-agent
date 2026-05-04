# EXP-740: Deployed Gate Liveness Audit

**Date**: 2026-05-04
**Status**: DESIGNED
**Depends on**: EXP-630 (duration gate), EXP-650 (impact gate), EXP-730 (dormant audit)

## Problem

Three structural gates are deployed in `heartbeat-data.ts` with **zero log entries** across all three log files:
- `agents/shared/duration-gate-triggers.log` — empty/nonexistent
- `agents/shared/impact-gate-triggers.log` — empty/nonexistent  
- `agents/shared/exp720-fewshot-dryrun.log` — empty/nonexistent

Tech-lead dismissed EXP-730 escalation (threshold raised to <5), but EXP-730 Phase 2 analysis predicted gates would remain dead because:
1. Artifact gate (EXP-520) upstream forces ≥1 deliverable (score ≥1)
2. Re-prompt from artifact gate inflates summary length (≥300 → +2) and output (≥1000 → +2)
3. Combined score typically ≥5, never triggering `substanceScore < 5`

For impact gate: `grepMentions` regex matches ANY bash session that runs grep/rg/find, which is nearly all of them.

## Hypothesis

- **H1**: Duration gate (EXP-630) fires on 0% of real heartbeat sessions even with threshold <5, because artifact gate recovery inflates substance scores above threshold. Evidence: zero log entries.
- **H2**: Impact gate (EXP-650) fires on 0% of real heartbeat sessions because keyword detection is too broad. Evidence: zero log entries.
- **H3**: A revised gate using **tool-call count from finish() metadata** (not proxy scoring) would catch ≥30% of sub-2-minute sessions.

## Method

### Phase 1: Confirm Dead Gates (Empirical)
1. Check all three log files — confirm zero entries (DONE: confirmed above)
2. Count total heartbeat sessions since deployment to establish denominator
3. Calculate expected trigger rate if gates worked (50% shallow rate from EXP-710)

### Phase 2: Propose Alternative Signal
Since `turnsUsed` and `tool_calls_count` are always 0 (ctx.runAgent doesn't populate them), propose using:
- **Option A**: Parse `finish()` result for `verification_evidence` array length (correlates with depth)
- **Option B**: Count tool calls in session transcript (requires transcript access)
- **Option C**: Use wall-clock duration (available via `Date.now()` delta)

### Phase 3: Design Minimal Fix
Write a concrete code change for the simplest effective gate — likely wall-clock duration, since:
- It's trivially measurable (`const startTime = Date.now()` at session start)
- EXP-705 confirmed all shallow sessions are <60s, all substantive >90s
- No proxy scoring needed — clean binary signal

## Success Criteria
- Phase 1: Documented evidence that gates have 0% trigger rate with session count denominator
- Phase 2: Identified alternative signal with ≥80% recall on known shallow sessions
- Phase 3: Concrete code diff for tech-lead to implement

## Timeline
- Phase 1: This session
- Phase 2-3: This session or next heartbeat
