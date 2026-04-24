# Lens D — Fragility: research-sync cron handler

**Date**: 2026-04-17
**Scope**: `agents/may/handlers/research-sync.ts`, `src/lib/research-db.ts`, `agents/may/cron.json`
**Verdict**: **LOW severity** — handler is mostly defensive by accident, but 3 real gaps vs. the `evaluation-sync` sibling pattern.

## Summary

`research-sync` runs every 30 min (`agents/may/cron.json:452-460`, `intervalMs: 1800000`) and calls `syncAll()` to upsert markdown research artifacts into SQLite. The handler is short (62 lines) and relies on `ctx.getDb()` (shared WAL connection) rather than opening/closing its own. Per-file parse errors are already captured inside each syncer (they push to `errors[]` instead of throwing), so the happy path is well‑contained. However, the handler lacks a top‑level `try/catch`, has no overall timeout, and swallows error counts beyond the first 5 — creating a small but real set of silent failure modes compared to the hardened `evaluation-sync` sibling.

## Evidence

### F1. No top-level try/catch or try/finally in the handler
- `agents/may/handlers/research-sync.ts:26-61` — the returned async function has no `try`. Any synchronous throw from `ctx.getDb()`, `syncAll(db, basePath)`, `ctx.log`, or `ctx.emit` propagates to the cron harness.
- Contrast with `agents/may/handlers/evaluation-sync.ts:229` (`try {`) … `:400-401` (`} finally { db.close(); }`) — evaluation-sync both catches and cleans up its private DB connection.
- Net effect: a throw is caught by the cron harness at `src/app/cron.ts:902-919` (`.catch(err => … updateRequest(FAILED) … onError(...))`). So a thrown error is logged and the request is marked FAILED — **not lost**, but not surfaced on the EventBus either.

### F2. No db.close() needed — uses shared connection
- `agents/may/handlers/research-sync.ts:28` — `const db = ctx.getDb();` (shared WAL connection owned by the loader at `src/app/agent-loader.ts:714`).
- Therefore the absence of a `finally { db.close() }` is **correct**, unlike evaluation-sync which opens its own `new Database(dbPath)` (`evaluation-sync.ts:227`). No leak risk here.

### F3. Per-file errors are already caught inside syncers (not re-thrown)
- `src/lib/research-db.ts:116-159` (knowledge), `:184-216` (hypotheses), `:237-346` (experiments) each wrap the per-file body in `try { … } catch (err) { errors.push(...) }`.
- So a single corrupt markdown file cannot abort the whole sync. ✅

### F4. Bulk errors partially swallowed — only first 5 logged
- `agents/may/handlers/research-sync.ts:51-53` — `ctx.log(``[research-sync] Errors: ${allErrors.slice(0, 5).join("; ")}``);`. The `errors` event payload carries a **count only** (line 59: `errors: allErrors.length`), not the messages themselves.
- If e.g. 40 knowledge entries fail to parse, only 5 error strings reach logs; the remaining 35 are discarded every run. Low blast radius but harms debuggability.

### F5. No MAX_PER_RUN cap on inputs
- `src/lib/research-db.ts:105` (`readdirSync(entriesDir).filter…`), `:173`, `:228` scan every file/dir every run. No slicing.
- Compare: `evaluation-sync` and `convention-check` cap per-run work (e.g. `convention-check.ts:144` `MAX_PER_RUN = 20`).
- At current scale (KE-001..~130, H-001..~40, EXP-001..~30) this is fine, but unbounded growth will monotonically increase latency and could starve the 30 min cadence.

### F6. DB-locked / SQLITE_BUSY path is unhandled
- `src/lib/research-db.ts:111-114` (knowledge), `:179-182`, `:233-236` call `db.prepare(...)` outside the per-file try/catch. If the prepare or a later `stmt.run(...)` throws `SQLITE_BUSY` (WAL contention with session-sync which fires every 5 min per `cron.json:470-475`), the whole sync aborts mid‑way and the exception propagates up to `cron.ts:919` → request `FAILED`.
- No retry/backoff. Since `research-sync` and `session-sync` have non-overlapping `offsetMs` (research `240000`, session `60000`, per `cron.json:460,476`), collision risk is small but non-zero under load or long runs.

### F7. Blast radius if the handler hangs
- `src/app/cron.ts:520-525` — the scheduler skips a fire if `isRunning(entry.name)` returns true; `isRunning` (`cron.ts:359-373`) only checks that a request row is `CREATED` or `IN_PROGRESS`.
- The handler body has no `setTimeout`/abort. A hang inside `syncAll` (e.g. a very large `readFileSync` on NFS, or a pathological regex) would leave the request permanently `IN_PROGRESS` and **block every subsequent research-sync fire forever** until the process restarts.
- There is some orphan cleanup at `cron.ts:573-587`, but it only runs on startup; there is no live watchdog for in-process JS handler jobs. This is the most material fragility.

### F8. emit() is not defensively wrapped
- `agents/may/handlers/research-sync.ts:56-60` — `ctx.emit({ type: "research_sync", ... })` is called outside any try. If a bus subscriber throws synchronously (EventBus typically catches — see `src/app/agent-loader.ts:712`), a bug in a downstream listener could surface here. Not currently exploited; low risk.

### F9. Cron wiring sanity
- `agents/may/cron.json:452-460` — enabled, 30 min interval, 4 min offset, handler name matches file stem. No `handlerConfig`. ✅

## Severity

**LOW overall.** The handler is simpler and safer than `evaluation-sync` by virtue of not owning its DB connection and relying on per-file try/catch inside `research-db.ts`. The one non-trivial fragility is F7 (silent permanent hang blocks future runs), mitigated only by process restart.

## Recommended follow-ups (separate sessions)

1. **F7 mitigation** (worth doing): wrap the handler body in `Promise.race([syncAll(...), timeoutAfter(60_000)])` so a hang fails the request instead of wedging the schedule.
2. **F1 hardening** (nice-to-have): add a top-level `try { ... } catch (err) { ctx.log(…); ctx.emit({ type: "research_sync_error", error: String(err) }); throw err; }` so errors surface on the EventBus, not just in the cron harness log.
3. **F4 visibility** (nice-to-have): include up to N error messages in the `research_sync` event payload (or at minimum a per-category count).
4. **F5 future-proofing** (defer until counts grow): add `MAX_PER_RUN` slicing once any artifact class exceeds ~200 files.

No immediate action required.
