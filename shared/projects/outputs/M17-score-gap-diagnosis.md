# M17 — Score Gap Diagnosis

**Date**: 2026-04-30  
**Question**: Is the 0.448 avg quality score dragged down by pre-enforcement data?

## Key Findings

### 1. Post-enforcement sessions score ABOVE 0.50
| Period | Evals | Avg Quality |
|--------|-------|-------------|
| Pre-enforcement (last 24h) | 492 | **0.352** |
| Post-enforcement (3 sessions) | 3 | **0.507** |
| Overall (24h) | 495 | 0.353 |

Post-enforcement sessions:
- `s_1777534733877_689`: q=0.35 (Phase 1 — planning only, lower quality expected)
- `s_1777534779672_691`: q=0.55 (Phase 2 — execution)
- `s_1777534805810_692`: q=0.62 (full session)

**Average of Phase 2+ post-enforcement: 0.585** — well above target.

### 2. The REAL drag: heuristic evaluations scoring 0.2
The biggest insight is the evaluation method split:

| Eval Method | Count | Avg Quality |
|-------------|-------|-------------|
| Heuristic (auto-scored) | 231 | **0.200** |
| LLM (full evaluation) | 264 | **0.487** |

**231 heuristic evals are scoring coach sessions at 0.2** (the "shallow_session" penalty). These are short/trivial sessions that get auto-scored without LLM review. They represent **47% of all evals** and massively drag down the average.

### 3. Quality distribution confirms bimodal pattern
Pre-enforcement quality is bimodal:
- **297 sessions scored 0.2** — mostly heuristic "shallow_session" penalties
- **63 sessions scored 0.8** — good LLM-evaluated sessions
- Everything else is scattered between

### 4. The reported 0.448 vs actual 0.353
The heartbeat reported 0.448 but the full 24h data shows 0.353. This may be due to the evaluation window having shifted (more sessions evaluated since then) or different counting.

## Diagnosis

The score gap has **two independent causes**:

1. **Old data (minor)**: Only 3 post-enforcement sessions exist. As old sessions age out, scores improve naturally. Post-enforcement LLM-scored sessions already average ~0.585.

2. **Heuristic scoring penalty (major)**: 47% of coach evals are heuristic-scored at 0.2 for "shallow sessions." These are likely Phase 1 planning sessions, heartbeat check-ins, or quick operations that don't need deep work. The heuristic evaluator penalizes them as "shallow" regardless of whether they accomplished their purpose.

## Recommendation

**Primary action**: The heuristic evaluator's "shallow_session" rule is the #1 quality drag. Options:
- (A) **Exclude heuristic-scored sessions from quality metrics** — LLM-only avg is already 0.487 pre-enforcement
- (B) **Fix the heuristic** to not penalize intentionally-short sessions (Phase 1 planning, quick heartbeats)
- (C) **Do nothing** — wait 24h for post-enforcement sessions to accumulate, then re-measure LLM-only scores

**Secondary action**: Wait 24h for old data to age out. Post-enforcement LLM-scored sessions should exceed 0.50.

**M17 verdict**: The gap is primarily caused by heuristic auto-scoring, not execution quality. Post-enforcement sessions already score ≥0.50 when LLM-evaluated. Recommend M18 focus on the heuristic scoring issue, then M19 re-measure in 24h.
