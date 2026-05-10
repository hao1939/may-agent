# Session Efficiency Analysis — 2026-05-10

## Key Finding: 55% of all completed sessions finish under 90s

In the last 24 hours, **598 of 1061** completed sessions (56%) finished under the 90-second minimum threshold. This suggests systemic over-delegation or insufficiently scoped tasks.

### Short-Session Rate by Agent (24h)

| Agent | Total Done | Under 90s | % Short |
|-------|-----------|-----------|---------|
| may | 239 | 203 | **84.9%** |
| scout | 133 | 88 | **66.2%** |
| evaluator | 545 | 267 | **49.0%** |
| dev | 70 | 21 | 30.0% |
| arc | 72 | 18 | 25.0% |

### Root Cause: `may` short sessions are workflow calls

The 203 short may sessions break down by source:
- **closed-loop-steward**: 122 sessions, avg 31.6s — these are audits dispatched as calls that complete fast because there's nothing actionable
- **workflow:may-heartbeat**: 63 sessions, avg 53.2s — heartbeat sub-tasks completing quickly
- **workflow:closed-loop-steward**: 10 sessions, avg 32.8s
- **workflow:project**: 5 sessions, avg 37.2s

202 of 203 are `kind=call`, meaning they're child sessions from workflows. These aren't independent sessions that should be individually scrutinized — they're workflow steps that legitimately complete fast when there's no work to do.

### Evaluator short sessions

255 of 267 short evaluator sessions come from `workflow:evaluator-aftermath` (avg 56.3s). These are review sessions that reasonably complete quickly when the session under review is straightforward.

## Actionable Concerns

### 1. Handler p95 at 222s (target: 120s)
Handler p95 duration is 223 seconds vs 120s target. Not breaching threshold (600s) but significantly above target. Worth investigating which handlers are slowest.

### 2. DB size at 1.18 GB (target: 500 MB, threshold: 2 GB)
Growing steadily. At current rate will breach in weeks. Need cleanup or archival strategy.

### 3. Reviewed good sessions overturned: 28% (target: 5%)
28% of sessions initially rated "good" are being overturned on deeper review. This suggests the initial evaluation heuristics are too lenient. Not breaching threshold (60%) but far from target.

### 4. Broad needs-improvement rate: 25.7% (target: 10%)
A quarter of evaluated sessions need improvement. Combined with the overturn rate, this suggests quality issues that the fast-pass heuristics are masking.

### 5. Handler failures at threshold boundary: 10 failures (threshold: 10)
Exactly at threshold. One more failure triggers a breach.

## Recommendation

The duration gate is triggering on legitimate workflow sub-tasks. Consider:
1. Exempting `kind=call` sessions from the 90s minimum gate, or
2. Raising the gate threshold for workflow steps to 30s
3. Focus quality improvement energy on the 28% overturn rate — that's where real value leaks
