# Consolidated Memory — 2026-03 (QA)

Source: `agents/qa/workspace/journal.md` entries spanning 2026-03-16 to 2026-03-18.

## Durable Facts
- `agents/qa/workspace/todo.md` was removed/refactored away; some sessions now see `ENOENT` when attempting to read it. The request DB is intended to be the single source of truth for pending work.
- Repo gates for this project are consistently:
  - `bun run typecheck`
  - `bun run test`

## Durable Patterns (What to Keep Doing)
- When repo gates are green but a code snippet *looks* malformed, treat it as a readability/maintenance smell and call it out explicitly; avoid claiming it is a syntax error unless confirmed by `tsc` or direct parsing evidence.
- When tests fail due to environment/module-resolution issues (e.g., non-Node imports), classify as an environment/tooling mismatch and record the exact import path and module name that triggered it. This accelerates triage.
- When reviewing “exercise/gym scenarios”, assume intentionally seeded bugs are present; focus findings on framework-level breakages (e.g., test discovery, fixtures, symlinks) rather than scenario correctness.

## Recurring Failure / Risk Themes (Worth Monitoring)
- **Contract drift**: Tool schemas/descriptions can lag behind implementations (e.g., edit tool describing exact match while code uses fuzzy matching). These mismatches are IMPORTANT because they mislead agents.
- **Silent catch blocks**: Multiple reviews flagged `try/catch` paths that swallow errors (config reload fallbacks, JSON parsing). Treat as IMPORTANT unless intentionally benign with explicit logs/telemetry.
- **Repo hygiene**: Uncommitted local diffs can appear during QA sessions and must be surfaced as process risks to avoid accidental drift.

## Dead Ends / Don’t Repeat
- Don’t treat the presence of a suspiciously formatted call as a compile error if `bun run typecheck` is passing; verify with a line-range read and/or compilation output before escalating severity.
