# Lens D: Silent-failure modes in the evaluator pipeline

Scope: `agents/may/handlers/evaluator-heartbeat.ts` (313 lines), `src/lib/evaluator.ts` (986 lines). `agents/may/handlers/evaluation-sync.ts` does not exist (confirmed via `ls agents/may/handlers/`; it was merged into `evaluator-heartbeat.ts` — see prior cycle’s architecture note). All line refs below were read in this session.

## Summary

The two-tier fix (2da1d05d) added a retry + `verdict:"parse_error"` path to `evaluateStandaloneSession` (evaluator.ts:868–883), which closes the "zero/zero = stored as quality=0" hole. But several silent-fail seams remain: (a) swallowed `catch {}` blocks in the handler, (b) an early-return when `parsed.agents[label]` is missing that writes no row and no log (evaluator.ts:889), and (c) no circuit breaker against a dead evaluator agent, so outages burn budget every heartbeat with no visible error.

No "marked evaluated but quality=null" hazard was found — `upsertEvaluation` is a single `INSERT OR REPLACE` with all fields (requests.ts:654–676), so mid-batch crashes leave no partial rows; the session simply stays heuristic-only and gets re-sampled (idempotent).

## Silent-fail modes found

1. **Bare `catch {}` swallows DB errors as "0"** — `evaluator-heartbeat.ts:70`, `:87`, `:115`. Any SQL failure on the `evaluations` / `sessions` count queries is hidden; handler then decides `pipelineStale = (0 && 0>0) = false` and silently skips calibration.
2. **Sampling queries swallow failures with early `return`** — `evaluator-heartbeat.ts:205` and `:236`. If either the agent-rate query or the candidate-session query throws (e.g. schema drift, missing `parentSessionId` column), the handler returns with no log at all; the LLM sampler appears to run but does nothing.
3. **Unreadable workspace files skipped silently** — `evaluator-heartbeat.ts:103`. `statSync` errors per file are dropped; worst case `newestMtime=0` → `workspaceStale=false` (staleness masked).
4. **JSON parse failure masked by "Keep defaults"** — `evaluator.ts:299` (`} catch { // Keep defaults }` in `parseTaskEvaluation`). The warning at evaluator.ts:313–317 does fire for overall-zero-zero, but a *partially* malformed payload (e.g. valid `overall` but throwing on `agents` subtree) can silently yield an empty `parsed.agents` map with non-zero `overall`, which bypasses both the retry trigger and the warning.
5. **`if (!agentScores) return null` — silent skip, no row, no log** — `evaluator.ts:888–889`. If the evaluator LLM produces valid JSON but under a different agent key than `agent` or `"${agent} (session ${sid})"`, the function returns `null`; no eval row is written, no warning is logged, and the same session is eligible for re-sampling every heartbeat (wasted LLM cost, invisible).
6. **Isolated re-eval best-effort `catch {}`** — `evaluator.ts:745`. Any failure in the Phase-C isolated pass is swallowed; the contextual score stands silently even if the isolation check would have downgraded it. Comment explicitly acknowledges "best-effort" but there is no counter/log.
7. **No distinction between "evaluator agent failed" and "evaluator returned zeros"** — both paths land in the same retry branch (evaluator.ts:868). If `manager.waitFor` resolves with `lastAssistantText = ""` because the evaluator crashed, it looks identical to a zero-score verdict. Retry will hit the same failure; row is saved with `verdict:"parse_error"` *only if* `parsed.agents[label]` happens to exist — otherwise path #5 fires and nothing is written.
8. **No concurrency guard on `hasLLMEvaluation` → `upsertEvaluation`** — read at `evaluator.ts:813`, write at `:895`. Two overlapping handler runs could both pass the check and both spawn evaluator sessions for the same `sessionId`; `INSERT OR REPLACE` means only the last row survives, but the extra LLM call ($0.03–0.05) is burned silently. Low probability given current serial cron, but no invariant enforces it.

## Blast radius — amy-kimi billing outage

Per-heartbeat, the handler spawns up to `MAX_LLM_EVALS_PER_RUN = 3` standalone evals (evaluator-heartbeat.ts:33) plus optionally 1 calibration eval (evaluator-heartbeat.ts:151–164). With the evaluator agent down:

- Each `manager.run("evaluator", …)` at evaluator.ts:860 and :869 returns empty text. That triggers the retry (evaluator.ts:869) → second failed spawn, same result.
- Outcome per session: either `verdict:"parse_error"` row written (if label match succeeds) or `null` return with nothing persisted (path #5). No backoff, no circuit breaker, no aggregated error — only the per-session `catch` at evaluator-heartbeat.ts:302 logs individual failures.
- Calibration spawn at evaluator-heartbeat.ts:160 adds one more failed call; logged via `:164` but not counted.
- Worst case: **up to 8 evaluator spawns per heartbeat** (3 primary × 2 retries + 1 calibration + 1 unlikely extra) during an outage, with no backoff. At ~12 heartbeats/hour this can silently burn hours of billing on failing LLM calls while scoreboard metrics keep looking "fresh" (rows get written as parse_error).

## Recommended fixes (prioritized, read-only — no code changes this session)

**P1 — add a circuit breaker around the evaluator spawn.** In `evaluator.ts` around line 860/869, if two consecutive `manager.waitFor` results return empty `lastAssistantText` in the same handler run, set a process-local flag and short-circuit remaining candidates for the rest of the heartbeat. Prevents outage cost amplification.

**P1 — replace path #5 silent null with a persisted "eval_skipped" row.** At `evaluator.ts:888`, when `agentScores` is missing, write a minimal `upsertEvaluation` row with `skippedByJs: true` and `verdict:"eval_missing"` so the session is not re-sampled every heartbeat. Also emit a `console.warn` with `sessionId`, `agent`, and the parsed agent keys for diagnosis.

**P2 — log, don't swallow, in handler `catch {}` blocks.** Convert the four bare `catch {}` at evaluator-heartbeat.ts:70, 87, 103, 115 and the two silent-return catches at :205, :236 to `catch (err) { ctx.log(...) }`. Keeps current behavior but surfaces DB/schema drift.

**P3 — tighten `parseTaskEvaluation` warning (evaluator.ts:313).** Also warn when `Object.keys(defaultResult.agents).length === 0`, not only when `overall` is zero/zero. Catches the partial-parse case in mode #4.

**P3 — add a metric counter for "standalone eval returned null / parse_error"**, surfaced in the existing system-status report. Gives visibility to invisible regressions without changing any call sites.

## Follow-ups (for next heartbeat, not this session)

- Decide whether concurrency guard (#8) is worth a row-level lock or can be left as "acceptable waste" given serial cron.
- Consider whether path #5 should prefer any key in `parsed.agents` as a best-effort fallback (already done in `evaluateTask` at evaluator.ts:613–619) rather than returning null.
