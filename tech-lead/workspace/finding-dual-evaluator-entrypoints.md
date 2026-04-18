# Finding — Dual evaluator entry points (evaluator-heartbeat vs evaluation-sync)

**Date**: 2026-04-17
**Lens**: A (System Architecture)
**Severity**: Low-Medium — working system, but boundary has drifted; mild duplication; confusion risk.
**Recommendation**: **KEEP-BOTH with a one-screen boundary doc and one small de-duplication** (details below). Do not merge, do not delete.

---

## 1. What each handler actually owns

### `agents/may/handlers/evaluator-heartbeat.ts` (313 lines)
- **Registered as cron job** `heartbeat-evaluator`, interval 1,800,000 ms (30 min) — `agents/may/cron.json:104-111`.
- **Part 1 — Top-level LLM sampling** (`evaluator-heartbeat.ts:56, 167-312`): finds heuristic-only, top-level sessions (`parentSessionId IS NULL`, `opCount > 2`), ranks agents by ascending LLM-eval rate, and upgrades up to `MAX_LLM_EVALS_PER_RUN = 3` (`evaluator-heartbeat.ts:32`) per run by calling `evaluateStandaloneSession()` from `src/lib/evaluator.ts:797`.
- **Part 2 — Calibration gate** (`evaluator-heartbeat.ts:63-163`): counts recent evaluations and workspace-file staleness (`MS_7D` at `evaluator-heartbeat.ts:29`, `EVALUATOR_WORKSPACE` at `:35`); if pipeline stale OR workspace stale, spawns an **evaluator agent** session via `ctx.manager.callAgent("evaluator", task, ...)` at `evaluator-heartbeat.ts:146-148`.
- **Inputs**: `evaluations` + `sessions` tables via `ctx.getDb()` (shared connection).
- **Outputs**: up to 3 LLM eval rows + possibly 1 evaluator-agent session per 30 min.
- **Cost**: small — capped at 3 LLM eval sessions + optional 1 calibration session.

### `agents/may/handlers/evaluation-sync.ts` (435 lines)
- **Registered as cron job** `evaluation-sync`, interval 600,000 ms (10 min) — `agents/may/cron.json:480-489`.
- **Part 1 — Scale migration** (`evaluation-sync.ts:216-234`): one-shot 1-5 → 0-1 rescale of legacy heuristic rows.
- **Part 2 — Heuristic backfill** (`evaluation-sync.ts:236-333`): opens its **own** `bun:sqlite` Database (`evaluation-sync.ts:34, 205`) to work around the WAL persistence bug documented at `evaluation-sync.ts:4-10`; selects all `done|error|interrupted` sessions lacking an evaluation, computes heuristic scores via `computeEvaluation()` (`evaluation-sync.ts:117-205`), upserts up to `MAX_PER_RUN = 50` per run (`evaluation-sync.ts:252`).
- **Part 3 — LLM sampling** (`evaluation-sync.ts:337-389`): after the heuristic batch, samples ~30% (`Math.random() < 0.3` at `evaluation-sync.ts:358`), capped at `MAX_LLM_PER_RUN = 5` (`evaluation-sync.ts:347`), and calls the same `evaluateStandaloneSession()` at `src/lib/evaluator.ts:797`.
- **Inputs**: `.state/sessions/**/meta.json`, `receipts.jsonl`, `session.jsonl`; writes to `sessions` and `evaluations` in `may.db`.
- **Outputs**: up to 50 heuristic rows + up to 5 LLM eval rows per 10 min.
- **Cost**: heuristic is free; LLM sampling is the cost component.

## 2. Overlap matrix

| Concern                                   | evaluator-heartbeat                             | evaluation-sync                                    |
|-------------------------------------------|-------------------------------------------------|----------------------------------------------------|
| Heuristic row writing                     | — (no)                                          | ✅ primary (`evaluation-sync.ts:263-332`)           |
| Calibration-session spawn (`evaluator` agent) | ✅ only here (`evaluator-heartbeat.ts:146-148`) | —                                                  |
| LLM upgrade of heuristic-only sessions    | ✅ rate-based, ≤3/30min (`evaluator-heartbeat.ts:167-312`) | ✅ random 30%, ≤5/10min (`evaluation-sync.ts:337-389`) |
| DB connection                             | `ctx.getDb()` (shared)                          | own `new Database(...)` to avoid WAL bug (`evaluation-sync.ts:205`) |
| Cadence                                   | 30 min (`cron.json:107`)                        | 10 min (`cron.json:482`)                           |
| Skip list for LLM                         | `{"evaluator","may"}` (`evaluator-heartbeat.ts:38`) | same set excluded via `agent === "evaluator"` branch (`evaluation-sync.ts:131`) — `may` is NOT excluded here |

**Real overlap**: both handlers upgrade heuristic-only sessions to LLM via `evaluateStandaloneSession()` (`evaluator-heartbeat.ts:280-288` and `evaluation-sync.ts:363-370`). The two strategies differ:
- evaluation-sync: random sampling, agnostic, runs immediately after its own heuristic batch — newly-written rows are candidates.
- evaluator-heartbeat: deterministic, targets **low-LLM-rate agents first** via a GROUP BY query on `evaluations` (`evaluator-heartbeat.ts:179-193`) — corrects LLM-coverage skew over time.

These are **complementary goals** on the same mechanism.

## 3. Cost / drift risks

- **Double LLM sampling**: worst case one session is heuristic-evaluated at T, then LLM-upgraded by evaluation-sync at T+ε, then picked up again by evaluator-heartbeat ~15 min later because its query filter is `e.evaluatedByHeuristic = 1` (`evaluator-heartbeat.ts:199`). Once the first LLM eval is written, `evaluatedByHeuristic` flips to 0 so the second upgrade is **actually prevented** — confirmed by the INSERT OR REPLACE in `evaluation-sync.ts:254-260` and `evaluator.ts:797`'s persistence path. No duplicate-cost bug in practice.
- **Inconsistent skip set**: `evaluation-sync.ts` only skips `agent === "evaluator"` (`:131`), not `may`. `evaluator-heartbeat.ts` skips both (`:38`). Minor — `may` heartbeats are rare and low-value to evaluate but will occasionally consume an LLM eval slot via evaluation-sync.
- **Two DB connections**: intentional, documented workaround for the WAL checkpoint bug (`evaluation-sync.ts:4-10`). Merging handlers would lose this isolation unless carefully preserved.

## 4. Recommendation: KEEP-BOTH (with boundary doc + one tiny alignment)

**Rationale for KEEP-BOTH, not MERGE:**
1. They answer different questions. evaluation-sync asks *"is every completed session evaluated?"* (coverage). evaluator-heartbeat asks *"is the evaluator itself calibrated, and is LLM-eval coverage per-agent fair?"* (quality/fairness).
2. Different cadences are load-appropriate: 10 min for pure-JS backfill, 30 min for anything that can spawn LLM.
3. Different DB-connection models are **required** by the WAL bug, not accidental.
4. Merging would bundle a calibration-agent-spawn into the 10-min cron or vice versa — both are worse.

**Rationale for not DELETE-ONE:**
- Deleting evaluator-heartbeat loses (a) calibration-session gate and (b) fairness-weighted LLM sampling.
- Deleting evaluation-sync loses the WAL-safe heuristic backfill — the 733-row plateau bug returns.

**Suggested follow-ups (separate sessions, NOT this one):**
1. **Tiny alignment**: add `"may"` to the implicit skip set in `evaluation-sync.ts:131-140` (mirror `SKIP_LLM_EVAL_AGENTS` from `evaluator-heartbeat.ts:38`) and share the constant. ~5-line change.
2. **Boundary doc**: add a 20-line header comment or a new `agents/may/handlers/EVALUATION-ARCHITECTURE.md` that explains: "evaluation-sync = coverage + heuristic writer; evaluator-heartbeat = calibration + fairness sampler; they share `evaluateStandaloneSession()` but are intentionally split because of WAL + cadence + cost." This is documentation only; no code risk.
3. **Optional**: lift `SKIP_LLM_EVAL_AGENTS`, `MAX_LLM_*` constants, and the `evaluateStandaloneSession` call sites into a shared helper in `agents/may/handlers/_shared-evaluation.ts` to prevent future drift. Lowest priority.

## 5. Verdict
Architecture is **not** unhealthy duplication — it is two distinct cron jobs that happen to share one underlying primitive (`evaluateStandaloneSession`, `src/lib/evaluator.ts:797`). The boundary is clear once you read both files, but it is not written down anywhere. The fix is documentation + one constant share, not a merge.
