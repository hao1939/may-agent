# Lens D (Fragility) — Evaluator sessions with opCount=0

**Date:** 2026-04-17
**Scope:** why 42 evaluator sessions in the last 6h all show `opCount=0` in `.state/may.db`.
**Verdict:** **Legitimate state, not a bug** — but genuinely fragile: opCount is a meaningless signal for the evaluator agent, and nothing marks these sessions as "evaluation succeeded" in a way an operator can grep for. Diagnosis only; fix deferred.

## Summary

The evaluator is a pure-reasoning agent. Its designed happy path is: receive task → emit JSON response → call `finish`. It does **not** call `bash`, `write`, `edit`, or `commit` — the only tools that increment `opCount` per `src/lib/manager-utils.ts:143` (`STATE_CHANGING_TOOLS = new Set(["bash", "write", "edit", "commit"])`) and `src/lib/manager-receipts.ts:236` / `:276-279` (`if (isStateChanging) { session.opCount++; ... }`). DB persistence is done by the **JS caller**, not by the evaluator itself: `src/lib/evaluator.ts:898-921` (`upsertEvaluation(persistDir, {...})` inside `evaluateStandaloneSession`). So `opCount=0` is the expected steady state for every successful evaluator session.

## Evidence

### DB shape (last 6h)
- 42 evaluator sessions, **all** `status='done'`, **all** `opCount=0`, **all** `source=NULL`, `kind='job'`, durations 5.3-14.3s (avg 8.9s) — query on `sessions` table via `bun:sqlite` (columns per `PRAGMA table_info(sessions)`: `opCount` INTEGER default 0, `source` nullable TEXT).
- 297 rows inserted into `evaluations` in the same window; 257 `evaluatedByHeuristic=1`/`skippedByJs=1` (the heuristic sync path) and **40 LLM rows** (`evaluatedByHeuristic=0 AND skippedByJs=0`). The 40 LLM rows ≈ the 42 sessions (delta explained by retry double-runs at `src/lib/evaluator.ts:867-885` — one prompt can spawn a second `manager.run("evaluator", prompt)` on line 869 if the first returns default-zero).
- Historical baseline: 3108 evaluator sessions total, **2401 (77%) have opCount=0**. Non-zero values are rare tail (98 at op=1, ~80 at op=2-6). This pattern is long-standing, not a recent regression.

### Code trace — why opCount stays at 0
1. `agents/may/handlers/evaluator-heartbeat.ts:158` and `:193-230` (the `sampleAndEvaluateTopLevel` path) select heuristic-only top-level sessions and call `evaluateStandaloneSession(...)` for each.
2. `evaluateStandaloneSession` at `src/lib/evaluator.ts:807-921` builds a prompt, spawns `manager.run("evaluator", prompt)` at line 859, awaits `manager.waitFor(...)`, parses `lastAssistantText`, and writes the row via `upsertEvaluation(persistDir, {...})` at lines 898-921 with `evaluatedByHeuristic: false, skippedByJs: false` (src/lib/evaluator.ts:911-912).
3. Inside the spawned evaluator session, the agent is configured with `tools: ["coding", "cite-source", "finish"]` (`agents/evaluator/agent.json:5-9`, which expands to `read/write/edit/bash/cite-source/finish` per `agents/evaluator/TOOLS.md:3`). The designed output is a single JSON blob in the assistant message followed by `finish` — neither `finish` nor `cite-source` nor `read` are in `STATE_CHANGING_TOOLS` (src/lib/manager-utils.ts:143), so `opCount` is never incremented.
4. The DB write that records the evaluation happens in the **parent** session (the cron handler), not the evaluator child — so the evaluator has nothing to persist and genuinely does no state-changing work.

### Is anything short-circuiting?
- Early-exit paths in `evaluateStandaloneSession` that return without spawning an LLM: `hasLLMEvaluation(persistDir, sessionId)` at line 813 and empty-messages at line 823. Both return **before** `manager.run` — so they would produce **no session row at all**, not a zero-op row. The 42 zero-op rows must therefore all be real LLM spawns.
- Duration evidence corroborates: 5.3-14.3s is consistent with a real `gpt52` LLM turn (the agent's model per `agents/evaluator/agent.json:4`). A stubbed/failed spawn would be sub-second.

### Operator-visibility gap
- Nothing in the `sessions` row distinguishes "evaluator ran and produced a verdict" from "evaluator was stubbed". `source` is NULL for all 3108 historical evaluator sessions (query on `sessions` grouped by `source`) — notably, the `source: "evaluator-heartbeat"` tag at `agents/may/handlers/evaluator-heartbeat.ts:158` is only set by the calibration path (`callAgent` call), **not** by the `manager.run` path used inside `evaluateStandaloneSession` (src/lib/evaluator.ts:859). So the per-session-evaluation spawns are untagged.
- Ground truth that the work happened lives in a **different table**: the matching `evaluations` row (joined by `sessionId` of the evaluated target, not the evaluator session itself). An operator looking only at `sessions` can't tell success from skip.

## Severity
**Low / informational.** System is working correctly. Risk is purely operator-interpretation: dashboards or heuristics that treat `opCount=0` as "idle/skipped" will mis-classify evaluator sessions. No cost leak, no data loss.

## Recommended action (single paragraph, not a fix task)
Don't change the eval architecture — the JS-owns-the-write design is fine. Cheapest improvement: pass `source: "standalone-eval"` (or similar) into the `manager.run` call at `src/lib/evaluator.ts:859` and `:869` so these sessions are identifiable in the `sessions` table without a join. Secondary option: document in `agents/evaluator/DOMAIN.md` (or tech-lead's heartbeat.md) that `opCount=0` is the normal state for evaluator and pointer to `evaluations.createdAt` as the real success signal. Do **not** add a synthetic opCount bump — that would corrupt the metric's meaning for every other agent.

## Follow-up (for a later session, not this one)
- One-line fix: add `source` option to the two `manager.run("evaluator", ...)` call sites in `src/lib/evaluator.ts` (lines 859, 869). Requires checking whether `manager.run` accepts an options object like `manager.callAgent` does (`agents/may/handlers/evaluator-heartbeat.ts:159` shows `{ source: "evaluator-heartbeat" }` works for `callAgent`).
