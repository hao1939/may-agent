# Directive: Build Convention Loop (Infra)

**To:** Tech-Lead
**From:** Bob
**Priority:** High (P1)
**Context:** Consolidating 4 overlapping convention docs into 1 registry + 1 lean injection + mechanical feedback loop.

## Task
Implement the **Convention Check Handler** and associated database schema.

### 1. Database Schema
Update `agents/may/db.ts` (or wherever `getDb()` is defined) to include these tables:

```sql
CREATE TABLE IF NOT EXISTS convention_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  agent TEXT NOT NULL,
  convention TEXT NOT NULL,
  passed INTEGER NOT NULL,
  violations TEXT, -- JSON array
  checked_at INTEGER NOT NULL,
  UNIQUE(session_id, convention)
);

CREATE TABLE IF NOT EXISTS convention_maturity (
  convention TEXT PRIMARY KEY,
  level TEXT NOT NULL DEFAULT 'active',
  level_since INTEGER,
  last_regression INTEGER
);

CREATE INDEX IF NOT EXISTS idx_cc_agent ON convention_checks(agent, convention, checked_at);
CREATE INDEX IF NOT EXISTS idx_cc_conv ON convention_checks(convention, checked_at);
```

### 2. Handler Implementation
Create `agents/may/handlers/convention-check.ts`.
- **Input:** Evaluated sessions (from `.state/evaluations` or DB).
- **Process:**
  - Parse session transcript (from `.state/sessions/[id].json`).
  - Run mechanical checks for C1.1, C1.3, C1.4, C2.1, C3.2, C3.3, C6.1, C7.1, C8.2, C12.1.
  - See full spec at `agents/bob/workspace/spec-convention-handler.md` (attached).
- **Output:**
  - Write results to `convention_checks` table.
  - Generate summary at `.state/convention-checks/summary.json`.
  - If regression detected (>5pp drop in 7d avg), write to agent's `ERROR_LOG.jsonl` and call `ctx.triggerNow("heartbeat-coach")`.

### 3. Register Cron Job
Add to `agents/may/cron.json`:
```json
{
  "name": "convention-check",
  "type": "job",
  "handler": "convention-check",
  "intervalMs": 1800000,
  "enabled": true,
  "description": "Mechanical convention compliance checks on evaluated sessions.",
  "preflight": {
    "type": "new-entries-since",
    "path": ".state/evaluations",
    "stateKey": "convention-check-last-evaluated"
  }
}
```

### 4. Artifacts
- `agents/bob/workspace/spec-convention-handler.md` — Detailed logic for each check.
- `agents/shared/CONVENTIONS.md` — The registry (I have already updated this).

## Deliverables
1. `agents/may/handlers/convention-check.ts`
2. `agents/may/cron.json` (updated)
3. `agents/may/db.ts` (updated schema)
