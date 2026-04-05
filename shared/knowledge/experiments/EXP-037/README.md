# EXP-037: Session Boundary Quality Analysis (H-068)

**Date**: 2026-04-05
**Hypothesis**: H-068 P1 — Agent output quality in the final 20% of sessions is measurably lower than in the 40-80% range
**Status**: COMPLETED — P1 NOT SUPPORTED

## Method

Analyzed 911 session transcripts from `agents/.state/sessions/history/`. For sessions with ≥8 assistant turns (577 qualified for the main analysis, 489 for the deeper analysis), split into three segments:
- **Early** (0-40% of turns): exploration, context gathering
- **Middle** (40-80%): core work  
- **Late** (80-100%): wrapping up, finishing

Measured per-segment:
1. Tool error rate (hard errors in short tool results)
2. Repeat rate (same tool+args as previous turn = stuck/retrying)
3. Tool call velocity (calls per turn = rushing indicator)
4. Verification behavior (read/bash calls = checking work)
5. Tool distribution by segment

## Results

### 1. Error Rates — H-068 NOT Supported

| Segment | Tool Calls | Errors | Error Rate |
|---------|-----------|--------|------------|
| Early   | 8,522     | 150    | **1.8%**   |
| Middle  | 6,470     | 46     | **0.7%**   |
| Late    | 2,413     | 12     | **0.5%**   |

**Error rates DECREASE over session lifetime.** Agents make the most errors in the early exploration phase, not at the end. The late segment has the lowest error rate.

Per-session comparison (577 paired sessions):
- Late worse than middle: 11 (1.9%)
- Middle worse than late: 36 (6.2%)
- Same: 530 (91.9%)
- Mean difference (Late - Middle): **-0.09pp** (negligible)

### 2. Repeated Tool Calls — NOT Supported

| Segment | Turns  | Repeats | Repeat Rate |
|---------|--------|---------|-------------|
| Early   | 5,075  | 257     | **5.1%**    |
| Middle  | 5,252  | 341     | **6.5%**    |
| Late    | 2,825  | 171     | **6.1%**    |

Highest repeat rate is in the middle, not the end. No evidence of increased frustration/retrying at session boundaries.

### 3. Tool Call Velocity — Contradicts "Rushing"

| Segment | Turns  | Calls  | Calls/Turn |
|---------|--------|--------|-----------|
| Early   | 5,075  | 8,226  | **1.62**  |
| Middle  | 5,252  | 6,242  | **1.19**  |
| Late    | 2,825  | 2,461  | **0.87**  |

Agents **slow down** toward the end (fewer tools per turn). Every agent shows this pattern:
- Coder: 1.41 → 0.79 (-0.62)
- Tech-lead: 1.33 → 0.87 (-0.46)
- Coach: 1.19 → 0.83 (-0.36)
- May: 1.45 → 0.80 (-0.65)

This contradicts H-068's "desperation → rushing" mechanism. Agents decelerate, they don't rush.

### 4. Verification Behavior — Explainable

| Segment | Total  | Verify (read/bash) | Rate   |
|---------|--------|--------------------|--------|
| Middle  | 6,242  | 5,290              | **84.7%** |
| Late    | 2,461  | 1,422              | **57.8%** |

Late verification rate drops 26.9pp. However, 19.6% of late calls are finish() (not verification). Excluding finish():
- Late verification: **71.9%** (still 12.8pp below middle)
- But late edit+write proportion doubles (22.1% vs 12.4%)

This is the normal explore→build→finalize workflow pattern. Agents shift from reading/checking to writing/finishing. Not a quality degradation signal.

### 5. Tool Distribution Shift (Expected Pattern)

| Tool     | Early  | Middle | Late  |
|----------|--------|--------|-------|
| bash     | 76.8%  | 73.6%  | 49.2% |
| read     | 18.3%  | 11.1%  | 8.5%  |
| edit     | 1.9%   | 8.3%   | 12.5% |
| write    | 0.9%   | 4.1%   | 5.3%  |
| finish   | -      | -      | 19.6% |

Normal workflow: exploration (bash/read heavy) → construction (more edit/write) → completion (finish).

## Conclusions

**H-068 P1 is NOT SUPPORTED** by this data. Across 577 sessions and 17,405 tool calls:

1. Error rates do not increase at session boundaries — they **decrease**
2. Agents do not rush at the end — tool call velocity **drops** from 1.62 to 0.87 calls/turn
3. Repeated tool calls (frustration signal) are highest in the middle, not the end
4. Verification behavior drops but is explained by workflow phase transitions, not degradation

### Important Caveats

1. **Survivorship bias**: We only analyzed completed sessions (481 done + 1 error). Sessions that crash or are interrupted at the boundary are excluded. The "worst" boundary behavior may not be in our sample.

2. **Error metric is coarse**: We only count hard errors (ENOENT, TypeError, etc.). Subtle quality issues (wrong logic, missed edge cases, incomplete implementations) are not captured by error string matching.

3. **No ground truth**: We don't have human quality labels per-turn. Our metrics are proxies (error rates, repeat rates, velocity) — not direct quality measurements.

4. **No resource constraint variation**: All sessions in our system run under similar constraints (same turn budgets, same models). H-068 specifically predicts degradation under **explicit resource pressure** (countdown warnings, token budget awareness). Our agents don't receive countdown-style messages until the very end.

5. **Confound: session length**: Longer sessions may naturally have lower error rates at the end because agents have resolved their errors by then. We can't distinguish "agents get better over time" from "no boundary effect."

### What This Tells Us

The data suggests our agents follow a healthy **explore→build→finalize** pattern rather than a **calm→rushing→panic** pattern. The Anthropic "desperate vector" finding (DD#516) may not apply to our system in its current configuration — possibly because:
- Our agents have explicit wrap-up framing ("call finish() with what you did")
- Checkpoint/handoff mechanisms reduce boundary pressure
- The heartbeat.md pattern encourages clean session exits

### H-068 Status Update

P1 (quality drops at session boundaries): **NOT SUPPORTED** — reduce P(H) contribution from this prediction.

However, H-068 should not be fully refuted because:
- P2 (framing effects) and P3 (permission to leave incomplete) were not tested
- The causal mechanism (emotion-like vectors) may still exist but not manifest in our current system design
- The caveats above limit the strength of this negative result

**Recommend**: Update H-068 P(H) from 0.55 → 0.45 (negative evidence from P1, but untested predictions remain).

## Scripts

- `scripts/analyze-session-boundary-quality.ts` — main error rate analysis
- `scripts/analyze-session-boundary-quality-b.ts` — deeper velocity/verification analysis
