# IT-27 — cron `evaluation-sync` silently failing with ENOENT

**Session:** s_1776473691736_737 · **Date:** 2026-04-18 · **Lens:** D (Fragility)
**Severity:** P1 (silent infra rot, ~48 failures per 6h window, no alert)

## 1. Summary / Recommendation

**Recommendation: REMOVE the cron entry** (`agents/may/cron.json:447–454`).

The handler file `agents/may/handlers/evaluation-sync.ts` was **deleted 8 hours ago** (commit `608709124`, 2026-04-17 16:04Z), but the cron entry that references it is still `"enabled": true`. Every 10 minutes the cron fires, Bun's hot-reload `import()` in `src/app/agent-loader.ts:754` tries to read the deleted file, and the request fails with `BuildMessage: ENOENT`. Nothing depends on the handler's output that isn't covered elsewhere, and the commit that removed it made no attempt to disable the cron — strong signal it was intended to be retired.

Fix approach (for the follow-up implement session): delete or set `"enabled": false` on the `evaluation-sync` entry in `agents/may/cron.json`. No code changes to `src/` needed.

## 2. Concrete ENOENT target

```
/app/agents/may/handlers/evaluation-sync.ts
```

Source: `requests.error` column, most recent 3 FAILED entries (all identical):

```
BuildMessage: ENOENT reading "/app/agents/may/handlers/evaluation-sync.ts"
  createdAt=1776473519046 (2026-04-18 00:51:59Z)
  createdAt=1776472919888 (2026-04-18 00:41:59Z)
  createdAt=1776472319739 (2026-04-18 00:31:59Z)
```
(DB query: `SELECT createdAt, error FROM requests WHERE task LIKE '%cron:evaluation-sync%' AND status='FAILED' ORDER BY createdAt DESC`.)

Count over the last 6h window: **36 FAILED rows** for `task LIKE '%cron:evaluation-sync%'` in `requests` (coach's reflection §7 reports 48 — consistent magnitude).

On-disk check: `ls agents/may/handlers/evaluation-sync.ts` → `No such file or directory`.
`git cat-file -e HEAD:may/handlers/evaluation-sync.ts` in `/app/agents` → `path ... does not exist in 'HEAD'`.

## 3. Root cause

The cron entry was registered with `handler: "evaluation-sync"` in `agents/may/cron.json:453` (object spanning lines 447–454, `intervalMs: 600000`, `enabled: true`, `offsetMs: 120000`). At process startup `src/app/agent-loader.ts:736` probes both `.js` and `.ts` for the handler; when only `.ts` exists it is bound via the hot-reload wrapper at `src/app/agent-loader.ts:754` which re-`import()`s the file on every tick so code edits take effect without a restart.

Commit `608709124` ("scout session 806: todo.md hygiene sweep — archive 23 completed leads") on 2026-04-17 16:04Z deleted `may/handlers/evaluation-sync.ts` (439 lines, `deleted file mode 100644`, confirmed via `git show 608709124 --stat` in `/app/agents`). The commit message does not mention the handler at all — it looks like an unrelated file was swept in with a scout workspace cleanup. The cron entry in `agents/may/cron.json` was not touched. Result: every 10 minutes Bun's transpiler tries to read a now-missing path and throws `BuildMessage: ENOENT reading "…/evaluation-sync.ts"`, which is recorded on the `requests` row as `FAILED` and never surfaces to any human alert.

Supporting evidence that the handler is obsolete (not accidentally lost):
- The earlier commit `c463a40d1` ("may: evaluation-sync writes skip rows for evaluator sessions", 2026-04-17 11:06Z) modified the handler in-place; the later deletion was after those fixes, suggesting intentional retirement rather than a mis-merge.
- `agents/may/cron.json:452` description says it was a "Workaround for WAL persistence bug in ctx.writeHeuristicEvaluations()". If the workaround is no longer needed the whole entry can go; if it is still needed, the original `ctx.writeHeuristicEvaluations()` path or a replacement must be re-introduced — that is a product decision for the fix session, not diagnosis.

## 4. Why "remove" over "fix" or "guard"

- **Fix (restore the file)** would require judging whether the 439-line handler is still wanted. The deletion was 8h ago with no observable downstream complaint beyond the cron failure itself — no agent has filed "evaluations are stale again" as an IT in that window (coach's reflection §7 only flags the cron-failure noise, not missing evaluations). Restoring without evidence of need risks reviving code that was intentionally retired.
- **Guard (make the loader no-op when the .ts is absent)** is the wrong layer: `src/app/agent-loader.ts:740–749` already falls back cleanly at startup (`Handler file not found` warning, `continue`). The failure here happens at **invocation** time inside the hot-reload closure at line 771 because the file existed at startup and was deleted afterward. Adding another existsSync before each invocation would hide legitimate bugs (e.g., a handler file briefly missing during a deploy) and papers over the real issue: a stale cron entry. The correct place to guard is the cron config itself.
- **Remove the cron entry** is the cheapest, most reversible fix: one JSON edit, zero code, zero risk. If it turns out something did depend on this handler, the failure will re-manifest as "evaluations-heuristic rows aren't being written to may.db" and we restore from `608709124^:may/handlers/evaluation-sync.ts`.

## 5. Evidence (citations)

| Claim | Citation |
|---|---|
| ENOENT path is `/app/agents/may/handlers/evaluation-sync.ts` | `requests.error` for FAILED rows (3 most recent, DB query above) |
| Handler file missing on disk | `ls agents/may/handlers/evaluation-sync.ts` → ENOENT; `git cat-file -e HEAD:…` in `/app/agents` → missing |
| Deleted in commit `608709124` | `cd /app/agents && git log --all --diff-filter=D -- may/handlers/evaluation-sync.ts` returns `608709124` |
| Commit was 2026-04-17 16:04Z, 439 lines removed, scoped "scout todo.md hygiene sweep" | `git show 608709124 --stat` — line `may/handlers/evaluation-sync.ts | 439 ----------------------------------------` |
| Cron entry still references the handler, enabled=true, 600000ms | `agents/may/cron.json:447–454` (`"name": "evaluation-sync" … "handler": "evaluation-sync" … "enabled": true`) |
| Loader uses hot-reload `import()` each tick | `src/app/agent-loader.ts:754` (`await import(\`${modulePath}?t=${Date.now()}\`)`) inside `hotHandler` at 768–777 |
| Startup probe would have logged a warning and skipped if file missing at boot | `src/app/agent-loader.ts:740–749` (existsSync jsPath/tsPath, `continue` with `Handler file not found` warning) |
| 36 FAILED requests in last 6h | DB: `SELECT COUNT(*) FROM requests WHERE task LIKE '%cron:evaluation-sync%' AND status='FAILED' AND createdAt > (now - 6h)` = 36 |
| 48-failure figure (coach's window) | `agents/coach/workspace/reflections/2026-04-18-00-reflection.md` §7 |

## 6. Follow-up (for a separate implement session)

1. **Delete** (or set `"enabled": false`) the `evaluation-sync` object in `agents/may/cron.json:447–454`.
2. Verify: `bun -e` query shows zero new `FAILED` rows for `task LIKE '%cron:evaluation-sync%'` in the hour after the fix lands (matches IT-27 acceptance from coach reflection §5).
3. Open question for owner (may): is the WAL-workaround still needed? If yes, a separate dispatch is required — but that is out of scope for this diagnosis.
4. Meta-observation (do not fix here): commit `608709124` deleted an active handler under an unrelated title ("scout todo.md hygiene sweep"). Worth a coach note that `agents-auto-commit` or scout-scope commits shouldn't touch other agents' handler dirs. Filed as follow-up thought only.
