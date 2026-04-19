# SPEC: Session Kind Tagging

**Author**: May (supervisor)  
**Date**: 2026-04-12  
**Status**: Draft — for tech-lead review  
**Scope**: `SessionKind` type, session creation, migration of existing data

---

## Problem

The `kind` column in the `sessions` table has only 3 values: `job`, `call`, `chat`. This was designed for lifecycle/resume semantics (jobs auto-resume, calls are parent-owned, chats persist). However, 93% of sessions are `kind=job`, which tells us nothing about **what type of work** a session performs.

**Current distribution** (19,624 sessions):

| kind | count | % |
|------|-------|---|
| job  | 18,255 | 93.0% |
| call | 1,317 | 6.7% |
| chat | 52 | 0.3% |

To distinguish heartbeats from work sessions from evaluations, we must parse task text with fragile regex patterns. This makes dashboard queries, utilization analysis, and agent productivity tracking unreliable.

## Current Workarounds

Today's classification relies on task text heuristics:
- **Heartbeats**: `task LIKE '%heartbeat%'` — catches ~15,576 sessions (79.4%)
- **Work sessions**: `task LIKE '%[WORK SESSION]%'` — catches ~438 (2.2%)  
- **Evaluations**: `task LIKE '%Task Tree Evaluation%' OR task LIKE '%Evaluate each agent%'` — catches ~799 (4.1%)
- **Cron jobs**: `task LIKE '[cron:%'` — catches ~671 (3.4%)
- **Digests**: `task LIKE '%Session Digest Request%'` — catches ~10 (0.1%)

These heuristics are unreliable because:
1. They depend on agents/callers using exact prefixes (not enforced)
2. New task types require new regex patterns
3. `source` column exists but is rarely populated (18,940 of 19,624 sessions have `source=NULL`)

## Proposal: Add `subkind` Column

### Why not change `kind`?

The existing `kind` values (`job`, `call`, `chat`) drive **lifecycle behavior**:
- `resumeStaleSessions()` filters by kind to decide what to resume vs abort
- `chat` sessions use `autoClose: "never"` and are never auto-resumed independently  
- `call` sessions are aborted (not resumed) on restart since their parent is gone

Mixing semantic tags into `kind` would break this lifecycle logic. A heartbeat is still a `job` for resume purposes. An evaluation is still a `job`.

**Solution**: Add a new `subkind` column for semantic classification, keeping `kind` for lifecycle.

### Proposed `subkind` Values

| subkind | Description | Detection logic | Est. count |
|---------|-------------|-----------------|------------|
| `heartbeat` | Agent heartbeat cycle | Task contains `heartbeat` or matches `Read agents/*/heartbeat.md` | 15,576 |
| `work` | Substantive forked work session | Task contains `[WORK SESSION]` | 438 |
| `evaluation` | Session/task-tree evaluation | Task contains `Task Tree Evaluation` or `Evaluate each agent` | 799 |
| `digest` | Session digest generation | Task contains `Session Digest Request` | 10 |
| `cron` | Cron-triggered job (non-heartbeat) | Task starts with `[cron:` | 671 |
| `task` | One-shot dispatched task | Dispatched via `fork()`/`message()` without `[WORK SESSION]` prefix | ~756 |
| `chat` | Human conversation | `kind='chat'` | 52 |
| `call` | Synchronous sub-agent call | `kind='call'` | 1,317 |
| `checkpoint` | Checkpoint save | Task equals `checkpoint` or is a checkpoint save | ~10 |

Note: `task` is the catch-all for sessions that don't match other patterns. These include implementation tasks, reviews, investigations, and ad-hoc work dispatched by agents.

### Classification Logic (at session creation time)

```typescript
function classifySubkind(task: string, kind: SessionKind, source?: string): string {
  // Lifecycle kinds map directly
  if (kind === "chat") return "chat";
  if (kind === "call") return "call";
  
  // Task text patterns (order matters — most specific first)
  if (/\[WORK SESSION\]/.test(task)) return "work";
  if (/heartbeat|Read agents\/[^/]+\/heartbeat\.md/.test(task)) return "heartbeat";
  if (/Task Tree Evaluation|Evaluate each agent/.test(task)) return "evaluation";
  if (/Session Digest Request/.test(task)) return "digest";
  if (/^\[cron:/.test(task)) return "cron";
  if (task === "checkpoint") return "checkpoint";
  
  // Default
  return "task";
}
```

### Caller Override

Allow callers to set `subkind` explicitly in `RunOpts`:

```typescript
interface RunOpts {
  // ... existing fields ...
  /** Semantic session classification. Auto-detected from task text if not set. */
  subkind?: SessionSubkind;
}
```

This is better than relying purely on task text parsing because:
1. Cron infrastructure knows it's firing a cron job — it can set `subkind: "cron"` directly
2. `fork()` callers know if they're dispatching work — can set `subkind: "work"`
3. Evaluator dispatch code knows it's creating an evaluation — can set `subkind: "evaluation"`

Auto-detection from task text is the fallback when callers don't specify.

## Schema Changes

### Migration

```sql
-- Add column
ALTER TABLE sessions ADD COLUMN subkind TEXT;

-- Create index for filtering
CREATE INDEX idx_sess_subkind ON sessions(subkind);

-- Backfill existing data
UPDATE sessions SET subkind = 'chat' WHERE kind = 'chat';
UPDATE sessions SET subkind = 'call' WHERE kind = 'call';
UPDATE sessions SET subkind = 'work' WHERE task LIKE '%[WORK SESSION]%' AND kind = 'job';
UPDATE sessions SET subkind = 'heartbeat' WHERE (task LIKE '%heartbeat%' OR task LIKE 'Read agents/%heartbeat.md%') AND kind = 'job' AND subkind IS NULL;
UPDATE sessions SET subkind = 'evaluation' WHERE (task LIKE '%Task Tree Evaluation%' OR task LIKE '%Evaluate each agent%') AND kind = 'job' AND subkind IS NULL;
UPDATE sessions SET subkind = 'digest' WHERE task LIKE '%Session Digest Request%' AND kind = 'job' AND subkind IS NULL;
UPDATE sessions SET subkind = 'cron' WHERE task LIKE '[cron:%' AND kind = 'job' AND subkind IS NULL;
UPDATE sessions SET subkind = 'checkpoint' WHERE task = 'checkpoint' AND kind = 'job' AND subkind IS NULL;
UPDATE sessions SET subkind = 'task' WHERE subkind IS NULL;
```

### Type Definition

```typescript
// In persistence.ts
export type SessionSubkind = 
  | "heartbeat"   // Agent heartbeat cycle
  | "work"        // Substantive forked work
  | "evaluation"  // Session/task-tree evaluation
  | "digest"      // Session digest generation
  | "cron"        // Cron-triggered non-heartbeat job
  | "task"        // Generic dispatched task
  | "chat"        // Human conversation
  | "call"        // Synchronous sub-agent call
  | "checkpoint"; // Checkpoint save
```

## Impact on Existing Code

### Session Persistence (`requests.ts`)

The INSERT statement needs the new column:
```sql
INSERT INTO sessions (..., subkind) VALUES (..., ?)
```

### Resume Logic (`manager.ts`)

**No change needed.** `resumeStaleSessions()` filters by `kind`, which is unchanged. `subkind` is purely informational.

### Web UI (`web.ts`, `socket.ts`)

Add `subkind` to the session queries and expose it to the frontend. This allows the UI to show session types with icons/colors:
- 💓 heartbeat
- 🔨 work  
- 📊 evaluation
- 📋 digest
- ⏰ cron
- 📝 task

### Dashboard Queries

Before (fragile):
```sql
SELECT COUNT(*) FROM sessions 
WHERE task LIKE '%heartbeat%' AND agent = 'bob'
  AND startedAt > ?
```

After (clean):
```sql
SELECT COUNT(*) FROM sessions 
WHERE subkind = 'heartbeat' AND agent = 'bob'
  AND startedAt > ?
```

### Source Column (`source`)

The existing `source` column (`agents.fork`, `workflow`, `callAgent`, `cron`, NULL) overlaps slightly with `subkind`. However:
- `source` tracks **how** a session was created (fork, workflow, cron trigger, etc.)
- `subkind` tracks **what type of work** the session performs

These are orthogonal. A heartbeat can be triggered by cron (`source=cron`) or by the main loop (`source=null`). A work session can be created via fork (`source=agents.fork`) or workflow (`source=workflow`).

Keep both columns. They answer different questions.

## Implementation Plan

1. **Add `SessionSubkind` type** to `persistence.ts`
2. **Add `classifySubkind()` function** to `manager-utils.ts`
3. **Add `subkind` field** to `PersistedSession` and `RunOpts`
4. **Set `subkind` in `run()`** — use explicit value from opts, or auto-detect from task text
5. **Update INSERT** in `requests.ts` to include `subkind`
6. **Run migration** — ALTER TABLE + backfill
7. **Update web UI queries** to include `subkind`
8. **Update cron/evaluator/digest dispatch** to pass explicit `subkind`
9. **Rebuild binary** to include changes

### Estimated Effort
- Implementation: ~1 coder session
- Testing: verify migration, verify new sessions get correct subkind
- No behavioral changes to any agent — purely additive

## Open Questions

1. **Should `subkind` be NOT NULL with a default?** Leaning yes: `DEFAULT 'task'` so new sessions always have a value even if classification is skipped.
2. **Should we expose `subkind` in session digests?** Yes — evaluator could use it to weight sessions differently (heartbeats vs work sessions).
3. **Future subkinds**: If new session types emerge (e.g., `gym`, `security-scan`), they can be added to the type union and classification logic without migration.
