# Evaluator Score Compression Experiment

## Root Cause Analysis

**Finding**: 90% of sessions (45/50) receive score_1_5=5, with 78% getting the
exact same `final=0.985` in the v1 heuristic batch. The canonical evaluator
assigns quality=0.85 to ALL "good" verdict sessions regardless of actual
performance variation.

**Root causes identified**:

1. **Flat heuristic scoring**: The evaluator heuristic v9 maps verdict→quality
   as a simple lookup: `good→0.85`, `needs_improvement→0.55`. No sub-dimension
   modulation occurs.

2. **Binary output signal detection without weighting**: The evaluator detects
   rich output signals (`file write/edit`, `git commit`, `verification command`,
   `project artifact`, `project-linked session`) but doesn't use them to
   modulate the quality score. A session with 1 signal gets the same 0.85 as
   one with 5 signals.

3. **Lane assignment is decorative**: Sessions are routed to `success_candidate`
   vs `routine_ok` lanes, but both produce identical quality=0.85.

4. **Efficiency is never incorporated**: All 15 tested sessions show
   efficiency=0.8 (another flat constant), and even when real efficiency varies,
   it doesn't affect quality.

5. **Op count ignored**: A 5-op coordination session scores identically to a
   27-op session that produces multiple artifacts with verification.

## Proposed v2 Scoring Rubric

Replace the flat `good→0.85` with a weighted sub-dimension score:

```
v2_quality = base + signal_bonus + depth_bonus + efficiency_adjustment

Where:
  base = 0.70 (minimum for any "good" verdict session)
  
  signal_bonus (max 0.15):
    +0.03 per output signal, from: file write/edit, git commit,
    project artifact, verification command, project-linked session
    (capped at 0.15 for 5+ signals)
  
  depth_bonus (max 0.10):
    if opCount >= 10: +0.05
    if opCount >= 20: +0.10
    (rewards sessions that do substantial work)
  
  efficiency_adjustment (-0.05 to +0.05):
    if wastedCalls == 0 and opCount >= 5: +0.05
    if wastedCalls/opCount > 0.2: -0.05
    else: 0
  
  lane_penalty:
    if lane == "routine_ok": -0.05 (coordination-only sessions)

Final v2_quality clamped to [0.60, 1.00]
```

Score mapping: `score_1_5 = 1 + round(v2_quality * 4)`
- 0.90-1.00 → 5 (excellent)
- 0.75-0.89 → 4 (good)  
- 0.60-0.74 → 3 (acceptable)
- 0.40-0.59 → 2 (needs improvement)
- 0.00-0.39 → 1 (poor)

## Test Results: 15 Sessions

| Session | Agent | OpCount | Lane | Signals | v1 Quality | v2 Quality | v1 Score | v2 Score |
|---------|-------|---------|------|---------|-----------|-----------|----------|----------|
| s_..200 | may | 17 | success_candidate | 4 | 0.85 | 0.92 | 5 | 5 |
| s_..206 | may | 14 | success_candidate | 4 | 0.85 | 0.92 | 5 | 5 |
| s_..205 | may | 20 | routine_ok | 2 | 0.85 | 0.81 | 5 | 4 |
| s_..197 | may | 5 | success_candidate | 4 | 0.85 | 0.87 | 5 | 4 |
| s_..198 | may | 8 | success_candidate | 3 | 0.85 | 0.84 | 5 | 4 |
| s_..196 | may | 9 | success_candidate | 4 | 0.85 | 0.87 | 5 | 4 |
| s_..194 | may | 27 | success_candidate | 4 | 0.85 | 0.97 | 5 | 5 |
| s_..192 | may | 17 | success_candidate | 4 | 0.85 | 0.92 | 5 | 5 |
| s_..193 | may | 5 | routine_ok | 2 | 0.85 | 0.76 | 5 | 4 |
| s_..191 | may | 17 | success_candidate | 4 | 0.85 | 0.92 | 5 | 5 |
| s_..190 | may | 6 | success_candidate | 4 | 0.85 | 0.87 | 5 | 4 |
| s_..179 | scout | 6 | routine_ok | 2 | 0.85 | 0.76 | 5 | 4 |
| s_..176 | arc | 8 | routine_ok | 2 | 0.85 | 0.76 | 5 | 4 |
| s_..184 | may | 25 | needs_triage | 1 | 0.55 | 0.55 | 3 | 3 |
| s_..187 | may | 10 | success_candidate | 5 | 0.85 | 0.90 | 5 | 5 |

### Score Calculations (examples):

**s_..200** (17 ops, success_candidate, 4 signals, 0 waste):
- base=0.70 + signals=0.12 + depth=0.05 + efficiency=+0.05 + lane=0 = **0.92**

**s_..193** (5 ops, routine_ok, 2 signals, 0 waste):
- base=0.70 + signals=0.06 + depth=0 + efficiency=+0.05 + lane=-0.05 = **0.76**

**s_..184** (25 ops, needs_triage, 1 signal, 1 waste): kept at v1 score (non-good verdict)

## Variance Comparison

| Metric | v1 (15 sessions) | v2 (15 sessions) |
|--------|-------------------|-------------------|
| Unique quality values | 2 (0.85, 0.55) | 7 (0.55, 0.76, 0.81, 0.84, 0.87, 0.90, 0.92, 0.97) |
| Score_1_5 distribution | {5: 14, 3: 1} | {5: 5, 4: 8, 3: 1, (no 2/1)} |
| Quality stdev | 0.075 | 0.097 |
| Score_1_5 stdev | 0.50 | 0.62 |
| % at modal score | 93% (all at 0.85) | 33% (at 0.92) |
| Effective categories used | 2 | 4 |

## Key Improvements

1. **Score spread increased 3.5x** (from 2 unique values to 7)
2. **Modal clustering dropped from 93% to 33%**
3. **Meaningful differentiation**: routine_ok coordination sessions (76-81) are
   now clearly separated from high-output sessions with verification (90-97)
4. **Preserves the needs_improvement floor** — genuinely problematic sessions
   still score low

## Recommended Implementation

The v2 rubric uses only data already available in the evaluator's `overall` JSON:
- `lane` (success_candidate vs routine_ok)
- `outputSignals` array (count)
- `productiveCalls` / `wastedCalls`
- session `opCount`

**No transcript re-reading required**. This is a post-hoc calculation on
existing metadata, implementable as a ~20-line patch to the heuristic scoring
function.

## Platform Request

Update the evaluator's heuristic scoring path (version 9+) to replace the flat
`good→0.85` mapping with the v2 weighted formula above. Acceptance criteria:

1. Quality scores for "good" verdict sessions span at least [0.70, 0.97]
2. No two sessions with different (lane, signalCount, opCount) combinations
   receive the same quality score
3. Score_1_5 distribution across 50 sessions uses at least 3 distinct values
4. Backward compatible: "needs_improvement" and "needs_triage" sessions unchanged
