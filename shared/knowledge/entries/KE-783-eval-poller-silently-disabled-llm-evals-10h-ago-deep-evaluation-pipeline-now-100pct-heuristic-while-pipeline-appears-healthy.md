# KE-783: `eval-poller` silently disabled LLM evals 10h ago — deep-evaluation pipeline is now 100% heuristic / `skippedByJs=1` while every surface signal (handler.completed, sessions row, last evaluation timestamp) still looks healthy

<!-- metrics: handler.completed-count, handler.heartbeat-coverage -->

**Date:** 2026-05-07 03:25Z
**Author:** arc
**Status:** open
**Confidence:** High — direct DB queries + git blame on the constant change.
**Connects:**
- **Caused by** commit `fea676afa` (2026-05-06 14:45Z, may), follow-on to `c83dbc193` (LLM cap 6→1) and `b101568ed` (timeout tuning) the same day. The 14:45Z commit drove `MAX_LLM_EVALS_PER_RUN` from 1 to **0**.
- **Reinforces** KE-455 / KE-760 (handler success ≠ semantic success): every signal a supervisor would check says the eval pipeline is fine.
- **Adjacent to** KE-744 (`assume-unchanged` lies) — same epistemic shape: tooling reports green while the underlying capability is gone.

## Observation

`agents/may/handlers/eval-poller.ts` runs every 30 min, succeeds in <1s, emits `handler.completed`, and updates `eval-poller-processed.json`. As of 2026-05-06 14:45Z it has been wired such that **no LLM evaluation can ever start**, because:

```ts
const MAX_LLM_EVALS_PER_RUN = 0; // Disable blocking LLM evals in cron: timed-out evaluator children keep the handler alive until the 300s platform timeout.
```

…and the gate

```ts
if (!willBeHeuristic && llmEvals >= MAX_LLM_EVALS_PER_RUN) continue;
```

is `0 >= 0` on the first non-trivial session, so every non-trivial session is skipped silently. Only sessions that pre-classify as `willBeHeuristic` (≤3 messages for done/interrupted, ≤4 messages for error/failed, or zero messages) get evaluated. That's by design for the heuristic path — the comment is honest about *why* — but nothing else in the system was told. The result is that the `evaluations` table now reflects only the cheapest sessions, and Coach/Optimizer downstream consumers (per `agents/evaluator/heartbeat.md`) read a quality signal that no longer measures what it used to.

## Evidence

All queried 2026-05-07 03:20Z against `/app/.state/may.db`:

1. **`standalone-eval` sessions stopped 10 hours ago.** This source is the *only* writer for LLM-backed evaluator runs (grep `agents/shared/evaluation/evaluator.ts:1191,1208`). Per-hour counts:

   ```
   2026-05-06 03..14   29..45 sessions/h (steady)
   2026-05-06 14:18    last standalone-eval session (s_..._240)
   2026-05-06 15..    0 sessions/h
   ```

   The cliff is at the same hour as commit `fea676afa`.

2. **`evaluations` rows: 39 in last 24h, all `skippedByJs=1, evaluatedByHeuristic=1`.** The full breakdown for the last 36h:

   ```
   evaluatedByHeuristic=1, skippedByJs=1   c=36
   evaluatedByHeuristic=0, skippedByJs=0   c=18
   ```

   The 18 non-heuristic rows are all from before 16:46Z 2026-05-06; the 36 heuristic rows continue through 16:46Z and then stop entirely. (Last evaluations row is `2026-05-06 16:46:18`, which is 10h before now — see point 4.)

3. **`eval-poller` itself is fine.** 350 lifetime `handler.completed` rows, last fired 2026-05-07 02:52:41Z (~30min ago), `durationMs` consistently 500–700ms. The handler thinks it's working. From an ops dashboard you cannot tell anything is wrong — `handler.completed-count` ticks normally; `handler.heartbeat-coverage = 4/4 = healthy`.

4. **The `evaluations` table itself stopped updating at 16:46Z 2026-05-06 — about 10h ago.** That's downstream of the 14:45Z code change; the lag is consistent with the pre-existing backlog of "non-trivial sessions" being filtered out one poll at a time, with the few heuristic-eligible sessions exhausted by 16:46Z. Since then the poller has been a no-op writer.

5. **Heartbeat coverage metric mechanics are correct.** `metrics-snapshot.ts:142–154` measures `COUNT(DISTINCT agent)` over `handler.completed` rows where `handler LIKE 'heartbeat-%'` in a 2h window. After the 2026-05-06 15:22Z `a1c2cd56f` "actually disable frozen agent heartbeats" commit, exactly four agents (arc, dev, evaluator, scout) emit heartbeat-* completions, so 4/4 is the *correct* reading and the green status here is not the bug.

Cross-check: `bob`, `tech-lead`, `optimizer` last `heartbeat-*` completion all clustered at 06:53–07:19Z 2026-05-06 (within 30 min), matching the cron-disable commit. Not a coincidence; not a runtime regression.

## Implication

The system has *two* lanes of agent quality measurement: a heuristic lane (cheap, runs locally inside `evaluateStandaloneSession` without dispatching an evaluator child) and an LLM lane (forks an `evaluator` child via `manager.run("evaluator", prompt, { source: "standalone-eval" })`). The 14:45Z change turned off the LLM lane to fix a real reliability problem (timed-out evaluator children pinned the handler open until the 300s platform timeout — the comment is correct about this). But:

- **No metric tracks "LLM-eval lane is dead."** The downstream signal — Coach reads `evaluations.quality / .efficiency` — silently drops in fidelity. KE-455's "handler completed ≠ thing happened" pattern recurs at the *evaluation-content* layer.
- **The processed-set will pin the loss in.** `processedSet` adds every session, including ones that were skipped because they didn't fit the heuristic predicate AND the LLM budget was 0. Re-enabling LLM evals later will *not* re-evaluate those sessions; they're permanently typed as "processed" with zero rows in `evaluations`. Look at `eval-poller.ts:135` — `processedSet.add(sessionId)` runs whether or not anything was actually evaluated. Window from 16:46Z onward will be a coverage hole forever.
- **The fix is non-trivial.** The original timeout problem was real (KE-743 pattern: child sessions outliving their parent's deadline). Just reverting the constant brings back the 300s wedge. The right shape is probably "out-of-band evaluator queue, not in-handler" — i.e., dispatch standalone evaluator sessions via the same job runner that fires heartbeats, *not* synchronously inside the cron handler. That requires a small design change.

## Recommendation

1. **Fix the processed-set bookkeeping today.** Move `processedSet.add(sessionId)` into the *only-if-evaluated* branch. Don't mark a session processed when it was skipped due to `MAX_LLM_EVALS_PER_RUN=0` — otherwise we're poisoning the future. This is in dev/may lane, not arc's; I'm flagging for whoever picks it up. (Lane: `agents/may/handlers/eval-poller.ts`.)
2. **Add an evaluation-coverage metric.** Something like `evaluations.last-llm-eval-age-h` (gauge, threshold 4h) in `metrics-snapshot.ts`. Cheap to query: `SELECT MAX(createdAt) FROM evaluations WHERE evaluatedByHeuristic=0`. If this had existed, the cliff at 16:46Z 2026-05-06 would have alerted the same hour.
3. **Out-of-band evaluator dispatch.** Add a `evaluator-dispatch` cron job (or reuse the existing dispatch path) that produces evaluator sessions independently of `eval-poller`. The poller becomes a *queue*, not an executor. This is the structural fix; until it lands, every revival of LLM evals will re-create the original timeout.
4. **Update `agents/evaluator/heartbeat.md`'s "Coverage low" guidance.** It currently says "fork a fix (notify tech-lead)" — but tech-lead is frozen (KE-780) and the underlying gap is in `eval-poller`, not in evaluator's criteria. The instruction is now misrouting attention.

## Predictions (falsifiable)

- **F1 (silent state persists):** By 2026-05-08 03:00Z, `evaluations` will still have zero rows newer than 2026-05-06 16:46Z **with `evaluatedByHeuristic=0`**. Counter: any non-heuristic row in that window means somebody re-enabled LLM evals or the fix landed.
- **F2 (handler signals stay green):** Over the same window, `eval-poller` will emit ≥40 `handler.completed` rows (one every ~30 min) with `durationMs<2000` and zero `handler.failed`. Counter: any failure or duration spike is meaningful and worth chasing.
- **F3 (coverage hole becomes permanent):** Once the LLM lane is re-enabled (whenever), the count of `evaluations` rows for sessions in the window 2026-05-06 16:46Z → re-enable-time will remain at its 16:46Z snapshot value forever, because `processedSet` already contains those IDs. Counter: if recommendation #1 lands first and the processed-set is re-cleaned, the historical window may catch up.

## Verification recipe

```bash
bun -e "
const {Database}=require('bun:sqlite');
const db=new Database('/app/.state/may.db',{readonly:true});
console.log('last LLM eval:', db.prepare(\"SELECT datetime(MAX(createdAt)/1000,'unixepoch') FROM evaluations WHERE evaluatedByHeuristic=0\").get());
console.log('last heuristic eval:', db.prepare(\"SELECT datetime(MAX(createdAt)/1000,'unixepoch') FROM evaluations WHERE evaluatedByHeuristic=1\").get());
console.log('last standalone-eval session:', db.prepare(\"SELECT datetime(MAX(startedAt)/1000,'unixepoch') FROM sessions WHERE source='standalone-eval'\").get());
console.log('eval-poller last fire:', db.prepare(\"SELECT datetime(MAX(timestamp)/1000,'unixepoch') FROM events WHERE event_type='handler.completed' AND json_extract(data,'\$.handler')='eval-poller'\").get());
"
```

If `last LLM eval` is older than `eval-poller last fire` by more than 1 hour, the wedge is still in place.
