# Finding: Evaluator LLM-Sampling Duplication — `evaluator-heartbeat.ts` vs `evaluation-sync.ts`

**Lens:** C (Dead Weight)
**Date:** 2026-04-17
**Severity:** Medium — not broken, but duplicated LLM-eval sampling on two schedules risks cost drift and divergent strategies.

## TL;DR

`evaluator-heartbeat.ts` is **not dead**, but its "Part 1: Top-level LLM evaluation sampling" is **redundant** with the LLM sampling block at the bottom of `evaluation-sync.ts`. Both handlers call `evaluateStandaloneSession()` on overlapping candidate pools, on different schedules, with different selection strategies. `evaluator-heartbeat.ts`'s **Part 2 (calibration gate)** is unique and should be preserved.

## Evidence

### 1. Both handlers are scheduled independently in `agents/may/cron.json`

- `heartbeat-evaluator` → `handler: "evaluator-heartbeat"`, `intervalMs: 1800000` (30 min). (cron.json:145–151)
- `evaluation-sync` → `handler: "evaluation-sync"`, `intervalMs: 600000` (10 min). (cron.json entry near end, `offsetMs: 120000`)

So both are live. `evaluator-heartbeat` runs 48×/day, `evaluation-sync` 144×/day.

### 2. Both call `evaluateStandaloneSession()` on heuristic-evaluated top-level sessions

**`agents/may/handlers/evaluator-heartbeat.ts`** — `sampleAndEvaluateTopLevel()` (lines ~150–260):
- Selects from `sessions JOIN evaluations` where `evaluatedByHeuristic = 1`, `parentSessionId IS NULL`, `opCount > 2`, status in (done, error).
- Ordering: by agent's current **LLM evaluation rate ascending** (agents with the least LLM coverage first), one session per agent round-robin.
- Budget: `MAX_LLM_EVALS_PER_RUN = 3`.
- Skip set: `{"evaluator", "may"}`.
- Calls `evaluateStandaloneSession({ manager, persistDir, sessionId, agent, task, status })` (line ~250).

**`agents/may/handlers/evaluation-sync.ts`** — LLM block at the end of `create()` (lines ~297–340):
- Runs immediately after writing fresh heuristic evaluations in the same tick.
- Candidate pool: `unevaluated.slice(0, 50)` filtered to non-skipped, i.e. sessions it **just** heuristic-evaluated.
- Ordering: **`Math.random() < 0.3`** per row — pure random 30% sample.
- Budget: `MAX_LLM_PER_RUN = 5`.
- Also calls `evaluateStandaloneSession({ manager, persistDir, sessionId, agent, task, status })` (line ~323).

### 3. Unique work in `evaluator-heartbeat.ts` (not in `evaluation-sync.ts`)

The Part 2 calibration block (lines ~60–135) is **not duplicated**:
- Queries `evaluations WHERE createdAt > now-24h` for pipeline-stale detection (line ~67).
- Scans `agents/evaluator/workspace/*.md` mtimes for >7-day staleness.
- Spawns a full `ctx.manager.callAgent("evaluator", ...)` LLM session with a calibration task when either condition triggers.

`evaluation-sync.ts` has no calibration trigger, no workspace scan, no evaluator-agent spawn.

### 4. Cross-handler concerns

- **Budget leakage:** Combined LLM cap = 3 + 5 = 8 LLM-eval sessions per cycle, but because the two handlers run on different cadences, the actual per-hour ceiling is `(3 × 2) + (5 × 6) = 36` LLM evals/hour worst case. Neither handler knows the other exists — there is no shared rate limiter.
- **Strategy mismatch:** `evaluator-heartbeat` uses a **principled fairness** sampler (lowest-LLM-rate agent first). `evaluation-sync` uses **uniform random 30%**. The fairness one is better; the random one dominates volume (5 > 3, 6× as often). Effectively the principled strategy is drowned out.
- **Candidate pool overlap:** `evaluation-sync` samples sessions it just heuristic-evaluated *before* committing. `evaluator-heartbeat` samples sessions already in the `evaluations` table. Little direct race, but definitely overlapping populations over time.

### 5. Prior Lens C note still stands
The earlier "db.query on SqliteDb" dead-code concern from an earlier Lens C was invalid — `ctx.getDb()` returns a Bun-sqlite-ish wrapper where `.query(sql, params).get/all()` works in the calibration path. Both handlers compile clean today (`npm run check` has been green in recent sessions).

## Recommendation

**Merge, don't delete.** Three concrete steps, each a separate follow-up session:

1. **Delete Part 1 of `evaluator-heartbeat.ts`** (`sampleAndEvaluateTopLevel` + the call at line ~47). ~110 lines go.
2. **Upgrade the sampler in `evaluation-sync.ts`** from random-30% to the fairness-ordered one that previously lived in `evaluator-heartbeat`. Keep `MAX_LLM_PER_RUN = 5`.
3. **Keep Part 2 of `evaluator-heartbeat.ts`** (calibration gate) unchanged — it is the only handler that spawns calibration evaluator sessions.

Net: one LLM sampling pathway, one cost budget, one strategy (the better one). Calibration remains isolated on its own 30-min schedule.

## Code pointers
- Delete target: `agents/may/handlers/evaluator-heartbeat.ts` lines ~47–57 (Part 1 call + try/catch) and the `sampleAndEvaluateTopLevel` function (~line 150 to end of file), plus unused `MAX_LLM_EVALS_PER_RUN`, `SKIP_LLM_EVAL_AGENTS`, and the `evaluateStandaloneSession` import.
- Replace target: `agents/may/handlers/evaluation-sync.ts` lines ~297–340 (the `// ── LLM evaluation sampling (~30%…` block) — swap `Math.random() < 0.3` slice for the per-agent-LLM-rate prioritization logic ported from `evaluator-heartbeat.ts`.

## Follow-up
Dispatch a single bounded session: "Port fairness-based LLM sampling from `evaluator-heartbeat.ts` into `evaluation-sync.ts`, then remove `sampleAndEvaluateTopLevel` and its call from `evaluator-heartbeat.ts`. Keep calibration (Part 2) intact. Verify with `npm run check`."
