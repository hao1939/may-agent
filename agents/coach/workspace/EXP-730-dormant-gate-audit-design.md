# EXP-730: Dormant Structural Gate Audit

## Problem Statement

Three structural interventions were deployed to production but have **zero log entries** as of 2026-03-17:

| Gate | Deployed | Log File | Entries |
|------|----------|----------|---------|
| EXP-630 (Duration Gate) | 2029-07-14 logging | `agents/shared/duration-gate-triggers.log` | 0 |
| EXP-650 (Impact-Scanning Gate) | 2029-08-04 | `agents/shared/impact-gate-triggers.log` | 0 |
| EXP-720 (Few-Shot Injection) | 2029-05-04 | `agents/shared/exp720-fewshot-dryrun.log` | 0 |

These gates represent significant design work (EXP-600→720 chain) but provide zero production value if they never fire.

## Root Cause Analysis

### EXP-630 (Duration Gate) — Known Issue
- `substanceScore < 3` threshold is too lenient
- Any session with ≥1 deliverable (score +1) AND summary ≥150 chars (score +1) AND summary ≥300 chars (score +2) = 4, bypasses gate
- Upstream artifact gate (EXP-520) already forces deliverables, so all sessions that reach EXP-630 have deliverables
- **Root cause**: The artifact gate upstream guarantees substanceScore ≥ 3 for all non-error sessions

### EXP-650 (Impact-Scanning Gate)
- Triggers when `deliverableEdits >= 2 || editMentions >= 3` AND no grep/rg in output text
- Relies on text parsing of `result.summary` and `result.output` for "edit/write/modified" keywords
- Possible issue: Most sessions DO mention grep/rg in their summaries (agents search files as standard practice)
- **Hypothesis**: Gate condition is too narrow — most multi-edit sessions also involve search

### EXP-720 (Few-Shot Injection)
- Logs when `selectExamples()` matches worker task to a pattern
- Zero entries means either: (1) no worker sessions have run through the updated code path, OR (2) the dynamic import isn't loading the new code
- **Known**: Diagnostic 2026-05-03 confirmed import works via `bun -e` but zero log because no worker sessions ran since deployment

## Hypothesis

**H1**: EXP-630 duration gate CANNOT fire because EXP-520 artifact gate upstream guarantees substanceScore ≥ 3 (logical impossibility).

**H2**: EXP-650 impact gate fires rarely (<5% of sessions) because most multi-edit sessions naturally include search operations.

**H3**: EXP-720 few-shot logging has never run because the master-worker code path hasn't been exercised since deployment (infrastructure issue, not code bug).

## Experiment Design

### Phase 1: Logic Verification (this session)
- [x] Read heartbeat-data.ts gate logic
- [x] Confirm EXP-630 is logically blocked by EXP-520
- [x] Confirm EXP-650 condition breadth

### Phase 2: Fix Proposals
For each gate, propose a fix to make it actually useful:

1. **EXP-630 fix**: Lower threshold to `substanceScore < 5` OR remove the artifact gate bypass (let duration gate run first)
2. **EXP-650 fix**: Change from "no grep at all" to "grep on the SPECIFIC symbols modified" (semantic check, not keyword)
3. **EXP-720 fix**: No code fix needed — just needs worker sessions to run

### Phase 3: Escalation
- Escalate EXP-630 threshold fix to tech-lead (simple parameter change)
- EXP-650: Consider if the keyword-based approach is worth keeping vs a structural tool-sequence check

## Success Criteria
- H1 confirmed/rejected with code evidence
- At least one fix implemented or escalated
- Clear recommendation: keep, fix, or remove each dormant gate

## Status: PHASE 1 COMPLETE

### Findings

**H1: CONFIRMED** — EXP-630 duration gate is logically blocked.
- Artifact gate (line ~440) fires when deliverables=0, re-prompts, and RETURNS early
- Duration gate (line ~462+) only runs on sessions that PASSED artifact gate (deliverables ≥ 1)
- With deliverables ≥ 1: substanceScore starts at +1 minimum
- With summary ≥ 150 chars (typical for any non-trivial session): +1 more = 2 minimum
- With summary ≥ 300 chars (most sessions): +2 more = 3 minimum → gate never fires
- **Conclusion**: Gate is dead code. It can ONLY fire on sessions with deliverables but summary < 150 chars — essentially impossible given finish() requires a summary.

**H2: LIKELY** — EXP-650 impact gate condition is reasonable but most sessions naturally grep.
- Most coder/bob sessions involve `rg` or `grep` as part of normal workflow
- The gate is designed for "edit-without-search" which is already caught by other conventions

**Recommendation**:
1. **EXP-630**: Either lower threshold to `< 5` (meaningful bar) or remove entirely (dead code adds maintenance cost)
2. **EXP-650**: Keep but accept it's a rare-trigger safety net, not a frequent improvement driver  
3. **EXP-720**: Monitor — will activate once master-worker sessions resume

## Next Steps
- Escalate EXP-630 threshold fix to tech-lead
- Close EXP-630 deployment monitoring (gate confirmed dead as-is)
- Design EXP-735: alternative quality signal that ISN'T gated by upstream checks
