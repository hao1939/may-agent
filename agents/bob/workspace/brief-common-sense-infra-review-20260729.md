# Common Sense Infra Review — 2026-07-29

## Summary

Reviewed `common-sense.md` (unchanged since prior review) and coach's behavioral verification status. **Highest priority unbuilt mechanism: evaluation result persistence (IT-87).** The eval-poller runs and evaluates sessions, but results vanish — they're logged but never persisted to DB or files. Coach has no infra help requests outstanding but remains stuck doing manual verification.

## Design Brief: Evaluation Result Persistence

### Problem

The eval-poller (`agents/may/handlers/eval-poller.ts`) runs every 30 minutes, successfully calls `evaluateStandaloneSession()`, and gets back quality/efficiency/verdict scores. But:

1. Results are only `ctx.log()`'d — not written to any queryable store
2. `.state/evaluations/` has had no new files since Mar 24 (4+ months)
3. The `context-learn` event is dispatched but only feeds the learning pipeline, not a metrics/query surface
4. Coach cannot query "what did session X score?" — has to manually sample sessions

### Evidence

- `.state/evaluations/` last file: `2026-03-24` (confirmed via `ls -lt`)
- `eval-poller-processed.json`: `lastRunAt: 1777511753870` (minutes ago), 815 lines of processed session IDs
- Eval-poller line 167: `ctx.log(...)` is the only output — no `writeFileSync` of evaluation results
- `evaluateStandaloneSession()` returns `{ quality, efficiency, verdict }` but caller discards after logging

### Proposed Fix

**Option A (minimal — 15 lines):** After the `ctx.log(...)` in eval-poller.ts (~line 167), persist the result:

```ts
// After getting result from evaluateStandaloneSession:
const evalDir = resolve(ctx.persistDir, "../evaluations");
mkdirSync(evalDir, { recursive: true });
writeFileSync(
  resolve(evalDir, `${sessionId}.json`),
  JSON.stringify({ sessionId, agent: meta.agent, ...result, evaluatedAt: Date.now() }, null, 2)
);
```

**Option B (better — emit to DB via event):** Emit a structured event that a handler can insert into a `session_evaluations` table:

```ts
ctx.dispatchEvent("session-evaluated", {
  sessionId, agent: meta.agent,
  quality: result.quality,
  efficiency: result.efficiency,
  verdict: result.verdict,
});
```

Then coach/optimizer can `query_db("SELECT * FROM session_evaluations WHERE agent = ? AND quality < 0.5")`.

**Recommendation:** Option B. A DB table is queryable by all agents. File-per-session doesn't scale and isn't searchable.

### Priority: P0

This is the single highest-leverage fix for the coaching system. Without it:
- Coach's behavioral verification is open-loop (manual session sampling)
- No automated detection of quality regressions
- The metric `eval.coverage` can't improve

### Owner: tech-lead

### Second Priority: C1.3 Write-Readback Nudge (P1)

The `verify-after-write` guard exists at `agents/shared/guards/verify-after-write.ts` but coach's data shows only ~15% write-readback compliance (#22 in tracker: 6 consecutive ❌). The guard may not be active or may not be effective. Investigation needed: is the guard registered and firing? If so, why is compliance still ❌?

### Coach Behavioral Status

All 8 "How to Think" items in common-sense.md verified ✅ by coach. No new infra help requests. The only implicit need is IT-87 (this brief's primary item).

### Ownership — No Changes Needed

`common-sense.md` is human-controlled. No items recently built that require ownership transfer. The `verify-after-write` guard exists but its activation status is unclear — not a doc ownership issue.
