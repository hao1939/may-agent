# Lens B: Top-Level Heartbeat LLM Evaluation Coverage

**Question:** Do top-level heartbeat sessions (no `parentSessionId`, e.g. coach/scout/tech-lead/qa) ever receive LLM evaluation, or only heuristic?

**Answer:** **YES — they receive LLM evaluation via two independent sampling paths.** The 57h-old checkpoint claim ("evaluation-sync.ts heuristic-evaluates 100%; no LLM sampling for top-level") is **STALE** and should be deleted.

---

## 1. Current pipeline (who triggers what)

Three entry points write evaluations for sessions:

1. **Child-session auto-eval** — `src/app/may.ts:417-453`. Bus subscriber on `session_end`; gated by `if (!info.parentSessionId) return;` at `src/app/may.ts:423`. Calls `evaluateTask()` (`src/lib/evaluator.ts:459`). Covers *child* sessions only.

2. **Cron heuristic sync + 30% LLM sampling** — `agents/may/handlers/evaluation-sync.ts`. Runs on cron. Heuristic-evaluates unevaluated sessions (pure JS, no LLM, comment `agents/may/handlers/evaluation-sync.ts:13`), THEN samples ~30% of heuristic-evaluated sessions and upgrades them to LLM via `evaluateStandaloneSession()` (`agents/may/handlers/evaluation-sync.ts:388-432`). Cap: `MAX_LLM_PER_RUN = 5` (`agents/may/handlers/evaluation-sync.ts:391`).

3. **Evaluator heartbeat — priority LLM sampling** — `agents/may/handlers/evaluator-heartbeat.ts`. Explicitly targets the top-level gap. Header comment: *"Top-level LLM sampling (new): Picks a small batch of heuristic-only top-level sessions and upgrades them to LLM evaluations via `evaluateStandaloneSession()`. This fixes the gap where `evaluateTask()` only fires for child sessions (requires parentSessionId)"* (`agents/may/handlers/evaluator-heartbeat.ts:9-13`). Query filters `s.parentSessionId IS NULL` at `agents/may/handlers/evaluator-heartbeat.ts:225`. Cap: `MAX_LLM_EVALS_PER_RUN = 3` (`agents/may/handlers/evaluator-heartbeat.ts:33`). Sort: lowest LLM-eval-rate agent first (`agents/may/handlers/evaluator-heartbeat.ts:211`).

Both cron paths skip `SKIP_LLM_EVAL_AGENTS = {"evaluator", "may"}` (`agents/may/handlers/evaluation-sync.ts:44`, `agents/may/handlers/evaluator-heartbeat.ts:39`).

The underlying LLM call is `evaluateStandaloneSession()` at `src/lib/evaluator.ts:813`, with a process-local circuit breaker that trips after 2 consecutive empty evaluator responses (`src/lib/evaluator.ts:811, 819-826`).

## 2. Answer with citations

- **evaluateTask() gating (child-only) confirmed:** `src/app/may.ts:423` — `if (!info.parentSessionId) return;`
- **Top-level LLM path #1 exists:** `agents/may/handlers/evaluation-sync.ts:399-401` — `.filter(() => Math.random() < 0.3).slice(0, MAX_LLM_PER_RUN)` feeding `evaluateStandaloneSession()` at `agents/may/handlers/evaluation-sync.ts:409`.
- **Top-level LLM path #2 exists:** `agents/may/handlers/evaluator-heartbeat.ts:223-228` selects `parentSessionId IS NULL` heuristic-only sessions; loop at `agents/may/handlers/evaluator-heartbeat.ts:285-307` invokes `evaluateStandaloneSession()`.

**Conclusion:** Top-level heartbeat sessions are sampled for LLM evaluation by both `evaluation-sync` (random 30%, up to 5/run) and `evaluator-heartbeat` (priority by lowest-LLM-rate agent, up to 3/run). The prior checkpoint's claimed gap no longer exists.

## 3. Gap status

**No gap.** Both sampling paths are live and reference `evaluateStandaloneSession` directly. No fix needed.

Possible follow-ups (NOT this session's work; noted for dispatch board if prioritized):
- The two paths overlap (both target heuristic-only sessions via `evaluateStandaloneSession`). Worth checking whether double-sampling wastes LLM budget or if the `hasLLMEvaluation(persistDir, sessionId)` guard at `src/lib/evaluator.ts:830` already makes this idempotent — it does; redundant calls are cheap-reject. Low priority.
- Circuit breaker (`src/lib/evaluator.ts:811`) is process-local; if evaluator is flaky across restarts, samples can repeatedly burn 2 LLM calls each run before tripping. Monitoring-only concern.

## 4. Checkpoint disposition

**Declare stale and delete.** The 57h checkpoint from `s_1776288692069_126` (step #1) describes an architecture that has since been fixed:

> "evaluateTask() in may.ts only fires for sessions with parentSessionId. Top-level heartbeat sessions (coach, qa, scout, etc.) never trigger it. evaluation-sync.ts heuristic-evaluates 100% of sessions."
> "fix_approach: Add LLM evaluation sampling to evaluation-sync.ts…"

The proposed fix **has been implemented** — first inside `evaluation-sync.ts` (path #1 above) and again, more deliberately, inside `evaluator-heartbeat.ts` (path #2, with the exact rationale quoted in its header at `agents/may/handlers/evaluator-heartbeat.ts:9-13`). The checkpoint is misleading to future sessions and should be removed from recall.
