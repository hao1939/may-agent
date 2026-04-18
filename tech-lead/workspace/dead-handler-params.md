# Dead Weight: Unused Handler Parameters & Dead Config in Cron Handlers

**Date:** 2026-04-17  
**Files examined:** evaluation-sync.ts, evaluator-heartbeat.ts, research-sync.ts

---

## Finding 1: `_now` parameter accepted but unused
**File:** `agents/may/handlers/evaluator-heartbeat.ts`, line 188  
**Severity:** Low (cosmetic)

`sampleAndEvaluateTopLevel(ctx, db, _now)` receives a `_now: number` parameter (passed from line 58) but never references it. The function uses `db.prepare()` queries with no time filtering. The `_now` parameter is dead weight passed through from the outer closure.

**Recommended action:** Remove the parameter; if time-bounding is needed later, add it then.

---

## Finding 2: `db.query()` called on SqliteDb — likely broken
**File:** `agents/may/handlers/evaluator-heartbeat.ts`, lines 66-68 and 78-85  
**Severity:** Medium (functional bug)

The handler calls `db.query(sql, params)` but `SqliteDb` interface (`src/lib/db.ts:22`) only exposes `exec`, `prepare`, `run`, `close` — no `query()` method. In bun:sqlite, `Database.query()` returns a `Statement` object, not a row. So `(row as any)?.cnt` evaluates to `undefined`, falling back to `0`.

**Impact:** `recentEvalCount` is always 0 and `unevaluatedCount` is always 0. This means the calibration logic (Part 2 of the handler) never triggers a calibration session because `pipelineStale = (0 === 0 && 0 > 0)` → `false`. The calibration path is effectively dead code — it can only trigger on `workspaceStale`.

**Recommended action:** Change `db.query(...)` to `db.prepare(sql).get(...params)` to actually retrieve rows.

---

## Finding 3: Hardcoded `.state` path vs `ctx.persistDir`
**File:** `agents/may/handlers/evaluation-sync.ts`, line 261  
**Severity:** Low (inconsistency)

evaluation-sync.ts uses `join(ctx.projectRoot, ".state")` for `persistDir` when calling `evaluateStandaloneSession()`. The sibling handler evaluator-heartbeat.ts uses `ctx.persistDir` (line 288) for the same call. This is an inconsistency — if `persistDir` ever changes, evaluation-sync.ts would break.

**Recommended action:** Use `ctx.persistDir` consistently.

---

## Finding 4: `_entry: CronEntry` unused in all three handlers
**File:** All three files  
**Severity:** None (idiomatic — underscore prefix is intentional)

All three `create()` functions receive `_entry: CronEntry` and ignore it. This is standard TypeScript convention for satisfying an interface signature. Not a real issue — noted for completeness only.

---

## Summary

| # | Finding | Severity | Action |
|---|---------|----------|--------|
| 1 | `_now` param unused in sampleAndEvaluateTopLevel | Low | Remove param |
| 2 | `db.query()` doesn't exist on SqliteDb — calibration path dead | **Medium** | Fix to `db.prepare().get()` |
| 3 | Hardcoded `.state` vs `ctx.persistDir` | Low | Use `ctx.persistDir` |
| 4 | `_entry` unused (idiomatic) | None | No action |

**Follow-up:** Finding 2 should be dispatched as a bug fix — the evaluator calibration logic has never worked via the `pipelineStale` trigger path.
