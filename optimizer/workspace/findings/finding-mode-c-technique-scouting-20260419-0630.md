# Mode C: Skill & Technique Scouting — 6h Scan (Apr 19 06:30 UTC)

## Period
2026-04-19 00:30–06:30 UTC

## Summary
Three high-op sessions examined. Coder 59-op session was legitimately productive (q=0.9). Coach 64-op EXP-186 was wasteful (q=0.22) due to gym timeout storms. Quality gap persists: scout/qa top tier (0.95+), coach lowest (0.74).

## Focus 1: Coder 59-op "Implement Feedback Loop M3" (s_1776578913159_18)

**Quality**: 0.9 | **Efficiency**: 0.75 | **Verdict**: good

This was a legitimate implementation session — building auto-creation of tracked requests from findings. 59 ops is reasonable for a multi-file feature implementation.

**Minor issues identified by evaluator**:
- FM-1.3 micro-flail: early grep for CREATE TABLE failed, pivoted without resolving why
- Wasted edit: attempted a no-op edit (identical old/new text) — sloppy patch step
- Process: initially attempted direct commit to main despite review gate; recovered by creating review branch

**Pattern**: The no-op edit is a known coder anti-pattern — editing a file with identical content wastes 1 op per occurrence. Could be caught by an edit guard (reject if oldText === newText), but it's a 1-op waste, not worth a systemic fix.

**Verdict**: No technique extraction needed. This is a healthy, productive session.

## Focus 2: Coach 64-op EXP-186 "Build programmatic auto-detection for persistent-task workflow" (s_1776563469482_804)

**Quality**: 0.22 | **Efficiency**: 0.28 | **Verdict**: parse_error (result not delivered)

**What went wrong**:
1. **Gym timeout storm**: Multiple gym runs timed out (600s, then 900s, then 8-trial loop aborted at trial 5). Never achieved a stable 10-trial measurement.
2. **Scope miss**: Required deliverables (project-scanner, injection code, results.md, instruction-following update) were mostly undelivered.
3. **Environment friction**: Tried `read()` on a directory (EISDIR), used missing `file` command (exit 127), failed bun:sqlite query abandoned.
4. **No verification**: Never completed a successful verification run.

**Pattern analysis**: This matches the known coach EXP-session anti-pattern — gym run proliferation under timeout pressure. Previously documented in finding-coach-experiment-cost-scouting-0412.md. The gym-batch.sh tool exists but didn't help here because the fundamental issue is individual gym runs timing out, not serial invocation overhead.

**New observation**: The timeout escalation pattern (600s → 900s → abort) suggests coach needs a **gym timeout budget rule**: if 2 consecutive gym runs timeout, STOP and diagnose the scenario before retrying. Currently, coach retries with higher timeouts, burning 10-20 ops each time.

## Focus 3: Agent Quality Comparison (6h window)

| Agent | Sessions | Avg Quality | Avg Ops | Total Ops |
|-------|----------|------------|---------|-----------|
| qa | 9 | 0.96 | 8.0 | 72 |
| scout | 10 | 0.95 | 3.7 | 37 |
| coder | 1 | 0.90 | 59.0 | 59 |
| may | 8 | 0.88 | 2.3 | 18 |
| optimizer | 20 | 0.87 | 7.7 | 153 |
| bob | 28 | 0.80 | 7.4 | 207 |
| tech-lead | 17 | 0.77 | 6.4 | 109 |
| coach | 28 | 0.74 | 8.4 | 234 |

**Observations**:
- Coach remains the quality laggard, dragged by EXP-186 (q=0.22) and a persistent-task iteration (q=0, 16 ops)
- Scout extremely lean (3.7 avg ops) with highest quality — dispatcher mode working well
- Bob and tech-lead are middle-tier, stable
- Evaluator sessions (81) all q=0 — these are correctly excluded from quality_preserved metric now

## Technique Candidates

### 1. Gym Timeout Circuit Breaker (for coach)
**Pattern**: After 2 consecutive gym timeouts, stop retrying and diagnose. Write a diagnostic step before the next attempt.
**Mechanism**: Could be a text rule in coach heartbeat/experiment template, or a code guard in gym-batch.sh.
**Expected impact**: Would have saved ~20 ops in EXP-186. Affects ~25% of gym-heavy sessions.
**Recommendation**: NO_DISPATCH — text rules have 0% success for judgment failures (KE-002). Would need to be a code-level guard in gym-batch.sh (abort after N consecutive timeouts with diagnostic message).

### 2. Edit Identity Guard (for coder)
**Pattern**: Reject edit() calls where oldText === newText.
**Expected impact**: ~1 op/session, affects maybe 10% of coder sessions. Too small to pursue.
**Recommendation**: NO_DISPATCH — minimal impact.

## Decision: NO_DISPATCH
No actionable fix meets the dispatch threshold. The gym timeout pattern is real but needs a code-level fix in gym-batch.sh, and the coder pattern is too small. The coach quality gap is a persistent structural issue (experiment sessions are inherently risky).
