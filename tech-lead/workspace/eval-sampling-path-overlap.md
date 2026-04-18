# Lens A: Two LLM-sampling paths for top-level sessions — overlap audit

**Question:** Are both sampling paths (`evaluation-sync` random 30% and `evaluator-heartbeat` priority-by-fairness) earning their keep, or should one be deleted / merged?

**Recommendation:** **KEEP BOTH**, but narrow `evaluation-sync`'s role to a burst/backfill safety net. The two paths have distinct, complementary roles and the idempotent guard makes overlap harmless. One small tightening is noted as follow-up (not this session).

---

## 1. What each path uniquely contributes

### Path A — `evaluation-sync.ts` (random 30%, cap 5/run, every 10 min)
- Cron cadence: `intervalMs: 600000` → 144 runs/day (`agents/may/cron.json:464`, handler registered at `agents/may/cron.json:467`).
- Runs RIGHT AFTER the heuristic batch in the same handler, on the same `unevaluated.slice(0, MAX_PER_RUN)` set (`agents/may/handlers/evaluation-sync.ts:390-401`).
- Sampling rule: `.filter(() => Math.random() < 0.3).slice(0, MAX_LLM_PER_RUN)` with `MAX_LLM_PER_RUN = 5` (`agents/may/handlers/evaluation-sync.ts:391, 399-401`).
- Upgrades via `evaluateStandaloneSession()` (`agents/may/handlers/evaluation-sync.ts:409`).
- **Unique contribution:** *temporal freshness / burst coverage.* When a batch of new sessions lands (e.g. after a dispatch burst), this path picks them up within ~10 min and LLM-evals a random slice immediately — before heuristic scores become the only record anyone sees.

### Path B — `evaluator-heartbeat.ts` (priority by lowest-LLM-rate agent, cap 3/run, every 30 min)
- Cron cadence: `intervalMs: 1800000` → 48 runs/day (`agents/may/cron.json:103-108`).
- Builds per-agent LLM-eval-rate table, sorts ascending, round-robins one session per lowest-rate agent first (`agents/may/handlers/evaluator-heartbeat.ts:188-218, 241-252`).
- Candidate query filters explicitly on top-level only: `s.parentSessionId IS NULL AND s.opCount > 2` (`agents/may/handlers/evaluator-heartbeat.ts:220-232`).
- Cap: `MAX_LLM_EVALS_PER_RUN = 3` (`agents/may/handlers/evaluator-heartbeat.ts:33`).
- **Unique contribution:** *coverage fairness across agents.* Ensures low-volume agents (e.g. scout, bob) aren't drowned out by random sampling dominated by high-volume agents (coder, tech-lead). Also runs the calibration-spawn logic (`agents/may/handlers/evaluator-heartbeat.ts:71-167`), which has no equivalent elsewhere.

The header comment at `agents/may/handlers/evaluator-heartbeat.ts:9-13` explicitly states this path was added to fix the top-level gap; the sampling in `evaluation-sync.ts` predates it and covers a different axis (time, not agent-fairness).

## 2. Is the idempotent guard sufficient? Is budget being wasted?

**Guard is sufficient.** `evaluateStandaloneSession()` at `src/lib/evaluator.ts:813` checks `hasLLMEvaluation(persistDir, sessionId)` at `src/lib/evaluator.ts:828` and returns `null` early if the session already has an LLM eval. This makes double-sampling a cheap DB read, not a burned LLM call. A process-local circuit breaker at `src/lib/evaluator.ts:807-826` adds a second layer of protection against runaway cost if the evaluator starts returning empty.

**Worst-case LLM budget:**
- Path A: 5 evals × 144 runs/day = up to 720/day (probabilistic; actual ≈ 30% of the heuristic batch, typically far less).
- Path B: 3 evals × 48 runs/day = up to 144/day.
- Overlap is bounded by `hasLLMEvaluation()` — re-sampled sessions cost one `SELECT` each, not one LLM call.

No evidence of wasted LLM budget. The risk is the inverse (too few LLM evals on low-volume agents), which Path B specifically addresses.

## 3. Cron frequency summary

| Path | Handler | Interval | Runs/day | Cap/run | Max LLM evals/day |
|---|---|---|---|---|---|
| A | evaluation-sync | 10 min (`agents/may/cron.json:464`) | 144 | 5 (`evaluation-sync.ts:391`) | 720 |
| B | evaluator-heartbeat | 30 min (`agents/may/cron.json:105`) | 48 | 3 (`evaluator-heartbeat.ts:33`) | 144 |

Path A fires 3× more often and has nearly 5× the daily ceiling, so it is already the dominant contributor by volume. Path B is the small-but-targeted fairness corrector.

## 4. Could Path B subsume Path A?

Mechanically, yes — Path B's priority-sort handles coverage, and Path A's heuristic-only block is independent of its LLM sampling (heuristic sync would continue to run even if we deleted lines `evaluation-sync.ts:386-433`). Deleting Path A's LLM block would:
- Reduce max daily LLM evals from 720 → 144 (-80%).
- Remove the ~10-min latency path (freshness).
- Lose randomness (Path B is deterministic per agent-rate ordering, which can starve specific session *types* within an agent).

**This is a real trade-off, not a clean win.** With the idempotent guard making overlap free, the argument for deletion is weak. KEEP BOTH.

---

## Recommendation: **KEEP BOTH**

Justification:
- Distinct roles: Path A = temporal/freshness + randomness; Path B = per-agent fairness + calibration-spawn.
- Overlap is free (`src/lib/evaluator.ts:828` guard + circuit breaker at `src/lib/evaluator.ts:807-826`).
- Deleting either path measurably degrades coverage on one axis; merging them would require reimplementing the axis that was deleted.

## Follow-ups (not this session — dispatch-board items if prioritized)

1. **Document the split in a header comment.** Both files should cross-reference each other's role so a future reader doesn't perceive this as accidental duplication. Low-effort; one-line comment at top of each handler.
2. **Consider lowering Path A's sample rate from 30% → 15%.** 720/day ceiling is generous; if real daily LLM evals from Path A already exceed ~50, the random arm is doing most of the work and Path B's fairness signal is diluted. Measurement first: query `evaluations WHERE evaluatedByHeuristic=0 AND skippedByJs=0 AND createdAt > now-24h` grouped by `agent` for one week, then decide.
3. **SKIP_LLM_EVAL_AGENTS is duplicated** (`evaluation-sync.ts:30` and `evaluator-heartbeat.ts:39`). Minor DRY violation; fine to leave, or hoist to a shared constant in `src/lib/evaluator.ts`. Cosmetic only.

None of these are P1. System is healthy as-is.
