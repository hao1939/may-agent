# Proposed criteria/heartbeat update (2026-03-31)

## Problem
Current Evaluator guidance (and some prior heartbeats) treat `.state/job-history.jsonl` as a liveness signal for evaluation cron. In the current system, `job-history.jsonl` appears stale (last entry 2026-03-20), yet the SQLite DB (`.state/may.db`) contains fresh evaluations.

## Evidence
- `.state/job-history.jsonl` last entry: 2026-03-20 (tail showed only heartbeats).
- `node:sqlite` query against `.state/may.db`:
  - tables include `evaluations` and `requests`
  - `evaluations.count: 16413`
  - `evaluations.latest5` includes `createdAt: 1774945726083` etc. (timestamps from the current runtime)

## Recommendation
Update evaluator heartbeat/checklist + `agents/evaluator/knowledge/criteria.md` “Cron/Job Liveness Checks” section:
1. Prefer DB-backed liveness check:
   - Query `evaluations` table for `MAX(createdAt)` and compare to now.
   - Optionally query `requests` for recent `status` transitions.
2. Treat `.state/evaluations/*.json` and `.state/job-history.jsonl` as **legacy** signals only.
3. Note tool availability: `rg` is not installed in this environment; use `grep -E`.

## Suggested command snippet (no bun/sqlite3 required)
```bash
node - <<'JS'
import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('.state/may.db', { readonly: true });
const latest = db.prepare('SELECT MAX(createdAt) as t FROM evaluations').get();
console.log('latest_evaluation_createdAt', latest.t);
JS
```
