# QA Heartbeat — Unreviewed Findings (2026-04-24)

## Context
- Repository appears **not** to be a git working tree at `/app` (no `.git`), so I could not inspect recent commits/diffs.
- `package.json` lists only `better-sqlite3` as a dependency; dev tooling (`tsc`, `vitest`) is not installed, so mandatory QA commands cannot be executed.

## Findings
### 1) Environment / tooling gap (blocks standard verification)
- `./node_modules/.bin/tsc --noEmit` → **missing** (`No such file or directory`).
- `./node_modules/.bin/vitest --run` → **missing** (`No such file or directory`).
- `node_modules/.bin` contains only `prebuild-install`, `rc`, `semver`.

Impact: cannot perform baseline typecheck/test verification required by QA protocol.

### 2) Code sweep: `src/product-search.js`
Read file and performed light correctness review.

Potential issues:
- **IMPORTANT**: `row.price.toFixed(2)` assumes `row.price` is a Number. If SQLite returns `price` as string/NULL, this will throw `TypeError: toFixed is not a function`. A defensive conversion (`Number(row.price)`) and/or null handling would prevent runtime crashes.
- **MINOR**: `searchProducts()` uses `SELECT *` and then formats subset; could explicitly select needed columns for clarity/perf.

No further files reviewed in-depth this heartbeat.

## Convention Alert follow-up
Alert mentioned: `C1.4 at 60%, C8.2 at 60%`. I could not locate the convention definitions within this heartbeat; recommend mapping these codes to specific behavior so we can target remediation.
