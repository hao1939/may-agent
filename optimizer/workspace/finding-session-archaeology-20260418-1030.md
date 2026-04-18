# Session Archaeology — 6h Scan (04:30–10:30 UTC, 2026-04-18)

## Summary

Scanned ~130 sessions from the last 6h. System is healthy overall — median opCount is 5, most sessions score "good". One notable outlier: the may 123-op session.

## Outlier: may 123-op session (s_1776491341154_891)

- **Task**: "Propagate Step 1 = React to Metrics" — surgical edit to 7 agent heartbeats
- **Duration**: ~13 minutes (1776491341→1776492108, 767s)
- **Root cause of high ops**: The task required reading + editing heartbeat.md for each of 7 agents, plus DB queries to check owned metrics, plus per-agent commits. 123 ops for 7 agents = ~17.5 ops/agent, which is reasonable for read→query→edit→commit per agent.
- **Verdict**: Not waste — this was a legitimate bulk-propagation task. The high op count reflects scope, not inefficiency.

## Patterns Across 6h Window

### Quality Distribution (non-evaluator, non-zero-op sessions only)
- **good** (q ≥ 0.85): ~35 sessions — healthy majority
- **acceptable** (0.6–0.84): ~10 sessions
- **needs_improvement** (q < 0.6): 4 sessions

### Top Recurring Issue: FM-3.3 (Verification Failures)
FM-3.3 or FM-3.3-adjacent issues appeared in ~8 sessions across multiple agents (optimizer, bob, qa, coach). Pattern: agents attempt finish(success) without post-write verification or with unverifiable claims. The verification guard is catching these, which is good — it's working as designed.

### Coach Interruptions
2 coach sessions were interrupted (s_1776499599563_1007, s_1776500120522_1013) with "Request was aborted." These appear to be iteration timeouts in persistent-task workflows — not system bugs.

### Notable Low-Quality Sessions
1. **qa s_1776499242925_1001** (q=0.18): FM-3.3 verification failure — claimed tsc/vitest passed but transcript shows otherwise
2. **tech-lead s_1776504684235_82** (q=0.32): SPEC_MISS — didn't follow the provided query requirement
3. **optimizer s_1776493840694_939** (q=0.25): BLIND_OVERWRITE — overwrote existing checklist file

### Agent Efficiency
All agents consistently show wastedCalls=0 in evaluations, suggesting the heuristic evaluator doesn't track wasted calls granularly (or agents are genuinely efficient). The efficiency scores (0.45–0.86) come from other factors.

## Actionable Findings

1. **No new waste patterns detected** — the system is operating within normal parameters
2. **FM-3.3 remains the dominant failure mode** — verification guard is catching it, but agents keep triggering it. This is a known pattern, not a new anomaly.
3. **The 123-op may session is not concerning** — legitimate scope, not runaway behavior

## Recommendation

No action needed. Continue monitoring FM-3.3 frequency — if it increases, consider whether the verification guard messaging could be improved to reduce first-attempt failures.
