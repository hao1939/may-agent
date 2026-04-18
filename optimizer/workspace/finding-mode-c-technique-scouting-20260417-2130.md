# Finding — Mode C: Technique Scouting (24h, last Apr 17 ~21:30 UTC)

## Top 3 heavy work sessions (24h, non-heartbeat, non-gym)
| Session | Agent | Ops | Task (trunc) | Gym runs in window | Redundant reads |
|---|---|---|---|---|---|
| s_1776399785799_320 | coach | **143** | EXP-156 Hard Gate Generalization: design + run baselines + treatments | **43** (all `method=oneshot`, `batch_id=NULL`) | 3 |
| s_1776376407934_121 | coach | 109 | EXP-176 scout→coder scenario continuation | **13** (all serial) | 1 |
| s_1776398501274_313 | tech-lead | 82 | Lens C: dead-weight cron audit | 0 | 1 |

## Bottom 3 lean work sessions (10–25 ops)
| Session | Agent | Ops | Gym runs | Reads |
|---|---|---|---|---|
| s_1776421879649_105 | optimizer | 10 | 0 | 0 |
| s_1776439816082_445 | tech-lead | 10 | 0 | 0 |
| s_1776450128456_543 | bob | 10 | 0 | 0 |

## Observed technique difference (one sentence)
**Heavy coach sessions serialize gym trials (43×`gym-run.sh`, `batch_id=NULL`, ~2 ops/run overhead) instead of using `scripts/gym-batch.sh`; lean sessions either don't touch gym or finish in a single batched invocation.**

Supporting 7-day count: `2330 / 2330 gym_runs had batch_id=NULL` — **zero adoption** of `gym-batch.sh` in 7d despite the tool being referenced in `agents/coach/context.md:5`. 74 coach sessions in 7d ran ≥5 serial gym_runs → estimated **~3,000 ops (~$140) saveable via batching**.

This reproduces the Level-4 (context-only mention) → 0% adoption pattern documented in `workspace/finding-tool-adoption-patterns-0412.md`. Text in context.md alone is passive (KE-011).

## Concrete recommendation
Move the "use gym-batch.sh" directive from context.md (Level 4, passive) into the **work-session-scaffold Phase 0 EXTRACT rules** (Level 2, active-prompt) where coach already lands at session start.

**File**: `agents/coach/skills/work-session-scaffold.md` (Phase 0 Rules block, after the existing `gym-batch.sh` line)

**Change**: Add an explicit gating rule:
```
- If DELIVERABLE requires ≥3 gym runs (baseline/treatment trials, regression sweeps, variant comparison):
  METHOD = scripts/gym-batch.sh (NEVER a gym-run.sh loop).
  If you find yourself writing a bash for-loop around gym-run.sh, STOP — that's the
  bug. Re-read scripts/gym-batch.sh --help.
```

Also update `agents/coach/workflows/growth-cycle.ts` Phase-1 prompt to echo the rule when the plan mentions "trials" or "baseline".

**Expected impact**: If even 30% of heavy coach sessions (74/week → ~22) adopt batching, savings ≈ 900 ops/week (~$42/week). Measurable via `SELECT COUNT(*) FROM gym_runs WHERE batch_id IS NOT NULL` trending up from 0.

## Dispatch
Finding recorded; **not forking tech-lead/coach** this cycle — the change is a small edit to coach's own skill file and workflow. Flag for next coach-focused optimizer cycle or dispatch to coach directly if I re-observe ≥5 serial-gym-run sessions in next 48h.

## Meta
- Ops used this session: ~14 (under 20-op budget).
- Verification: follow-up check in 3–7 days: `bun -e "... WHERE batch_id IS NOT NULL ..."` should be >0.
