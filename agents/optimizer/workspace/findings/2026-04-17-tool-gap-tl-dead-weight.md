# Tool Gap Analysis: Tech-Lead 82-op Dead Weight Session

**Session**: s_1776398501274_313 (tech-lead, 82 ops, status=done)
**Task**: Lens C: Dead Weight — Unused or redundant cron handlers
**Eval**: quality=1.0, efficiency=0.8, verdict=good

## Key Finding: 82 ops for a cron audit is excessive

The session made **95 tool calls** (82 ops counted by framework) — roughly 85 were bash commands.
The session spent ~60 bash calls just trying to locate where cron handler files live on disk, going through a long search spiral:

1. **Handler file hunt (calls 2-69)**: ~67 bash calls searching for handler `.ts` files. The session checked `agents/may/handlers/`, `src/cron/`, `src/handlers/`, git history, branches, compiled binary strings, `/proc/`, and many dead-end paths. Root issue: handlers are loaded at runtime (possibly compiled into the binary or on a different branch) and the session couldn't find them on disk.

2. **DB verification (calls 70-90)**: ~20 calls confirming handlers DO run (convention_checks has 90K rows) even though source files aren't visible.

3. **Write + finish (calls 91-95)**: 5 calls to write finding and finish.

## Repeated Patterns / Tool Gaps

### Pattern 1: "Where is this file?" spiral (67 calls)
The session ran `find`, `grep -rn`, `git log`, `git show`, `ls` in dozens of variations trying to locate handler source files. A **`locate-handler`** or **`resolve-cron-handler`** tool/script that knows the handler resolution logic (agents/<name>/handlers/ → built-in → binary-embedded) would have answered this in 1 call.

### Pattern 2: DB access fumbling (calls 29-35)
Multiple attempts to query SQLite — first tried `sqlite3` CLI (not available), then `require('bun:sqlite')` (wrong import), then finally `import { Database } from 'bun:sqlite'`. This is a known friction point. The session's context.md may not have had the DB access snippet.

### Pattern 3: Git archaeology for deleted/moved files (calls 42-54)
13 calls doing `git log --diff-filter=D`, `git merge-base`, `git show <sha>:path` to understand if handlers were deleted, moved, or on another branch. A **`file-history <path>`** script wrapping common git archaeology patterns would collapse this to 1-2 calls.

## Recommendations

1. **Handler resolution docs**: Add to tech-lead context.md: "Cron handlers resolve via agent-loader.ts hotHandler(). Files live in agents/<name>/handlers/ but may be compiled into the binary. Check `convention_checks` or `metrics_snapshots` tables to verify they run."

2. **DB access snippet already exists** in optimizer/coach/may context — verify tech-lead has it too.

3. **No new tool needed** — the 67-call spiral was mostly a knowledge gap (where handlers live), not a tooling gap. Injecting the right context would prevent this.

## Verdict

This session's inefficiency came from **missing architectural knowledge**, not missing tools. The handler resolution path is non-obvious and should be documented in shared knowledge. The session still delivered a quality finding (eval=1.0) but burned ~60 unnecessary ops getting there.
