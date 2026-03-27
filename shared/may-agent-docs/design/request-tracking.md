# Design: Unified Request Tracking

**Status**: Proposal
**Features**: F1 (Request Tracking), F3 (Completion Feedback), F4 (Crash Recovery), F5 (Request Observability)
**Owner**: Bob (design) + Tech-Lead (implementation)

---

## Goal

**Make agents' lives simpler. Infra absorbs the complexity.**

Agents should think about one thing: do the work, call `finish()`. Everything else — tracking who asked what, whether it got done, what to retry after a crash, dedup, ACK ceremonies — is infra's job.

### Agent experience: before and after

| | Before | After |
|--|--------|-------|
| Communication tools | 3 (call, send, handoff) | 2 (call, send) |
| Where to check for work | 2 files (todo.md + SIGNALS.md) | 1 file (todo.md) |
| How to receive an artifact | Read opaque todo pointer → grep SIGNALS.md → find entry → read context → read artifact (3 files) | Read self-contained todo entry → read artifact (1 file) |
| How to acknowledge receipt | Manually edit SIGNALS.md text | Nothing (infra tracks via finish()) |
| How to avoid duplicates | Bob: grep SIGNALS in turn 1, wait, handoff in turn 2 (28 lines of instructions) | Nothing (infra deduplicates automatically) |
| Heartbeat SIGNALS step | Every agent: grep SIGNALS.md for name, process PENDING_ACK | Eliminated |
| What agents must do | Read todo.md, do the work, call finish() | Same — unchanged |

Agents don't gain new responsibilities. They lose ceremony.

---

## Problem

### For agents

Agents must check two files for incoming work (todo.md and SIGNALS.md), learn three communication tools (call, send, handoff), perform manual ACK text edits, and follow a 28-line multi-turn dedup ceremony. SIGNALS.md has grown to 8K+ lines. Agents get it wrong constantly — Bob sent one brief 31 times despite dedup checks, because the grep and handoff ran in parallel.

### For infra

~500 lines of tracking code spread across 4 JSONL files and 2 modules, each reimplementing the same pattern: `appendFileSync` to write, `readFileSync` + parse-every-line + build-a-Map + filter to read, "last entry wins" to simulate updates.

| File | Lines | Writes | Reads | Status |
|------|-------|--------|-------|--------|
| `orders.jsonl` (orders.ts, 211 lines) | human requests | logOrder, updateOrderStatus | getPendingOrders, resetStaleOrders **never called** | write-only |
| `delegations.jsonl` (manager.ts, ~40 lines) | agent→agent call/send | logDelegation | system-status tail | write + display |
| `session-outcomes.jsonl` (lifecycle.ts, ~30 lines) | finish() output | appendFileSync | **nobody** | dead log |
| `recovery.jsonl` (session-recovery.ts, 216 lines) | crash recovery | logRecoveryNeeded, logRecovered | getPendingRecoveries **never called** | write-only |

The recovery code was built but never wired. `getPendingOrders()` exists but is never called on startup. `send()` and `handoff()` are fire-and-forget with zero completion tracking.

---

## Design

### Principle: agents see todo.md, infra sees the DB

Agents check **todo.md** for work and call **finish()** when done. That's their entire interface. The request DB is infra's bookkeeping — agents never touch it, never know it exists. `send()` writes to both todo.md and the DB as one operation.

### Two primitives, not three

`handoff()` merges into `send()`. They do the same thing (write to todo.md, trigger heartbeat) with handoff adding optional validation:

```typescript
agents.send({
  agent: "tech-lead",
  message: "Review P70 enforcement design",
  // Optional — today's handoff-only fields become optional send fields:
  artifact: "agents/bob/workspace/brief-p70.md",   // validated if provided
  context: "Closes OpenClaw vulnerability gap",
  expectations: "Block edit() calls to agent.json",
  notify: ["coach"],   // FYI copies to other agents' todo.md
})
```

When `artifact` is provided, `send()` validates the file exists and deduplicates by (from, to, message-hash). These were handoff's unique features; now they're optional send() features.

**SIGNALS.md is eliminated.** It was 99.3% handoff entries (705/710). Every handoff wrote to SIGNALS.md AND todo.md, then agents read todo.md (which said "go check SIGNALS.md") AND grepped SIGNALS.md. Two writes + two reads for one notification. With unified send(), one write to todo.md, one read by the agent.

### Storage: SQLite via bun:sqlite

`bun:sqlite` is built into the runtime (zero new dependencies). The system already runs under Bun. SQLite replaces all 4 JSONL files with one `requests.db` and eliminates ~400 lines of read-all-parse-filter-map code:

| JSONL pattern | SQLite equivalent |
|---------------|-------------------|
| Append new record, read all, "last entry wins" | `UPDATE ... WHERE requestId = ?` |
| Read entire file, parse every line, filter in JS | `SELECT * WHERE status IN (...)` |
| Scan for duplicates by iterating all entries | Indexed lookup, O(log n) |
| Build parent map in JS for tree traversal | `WITH RECURSIVE` CTE |
| Rewrite entire file to archive old entries | `DELETE WHERE completedAt < ?` |
| 4 separate files with overlapping data | 1 table |

### Schema

```sql
CREATE TABLE requests (
  requestId       TEXT PRIMARY KEY,
  parentRequestId TEXT,
  fromEntity      TEXT NOT NULL,       -- 'human' or agent name
  toAgent         TEXT NOT NULL,
  method          TEXT NOT NULL,       -- 'chat' | 'call' | 'send' | 'workflow'
  task            TEXT NOT NULL,       -- first 500 chars of request
  status          TEXT NOT NULL DEFAULT 'CREATED',
  sessionId       TEXT,
  createdAt       INTEGER NOT NULL,    -- unix ms
  updatedAt       INTEGER NOT NULL,
  completedAt     INTEGER,
  durationMs      INTEGER,
  summary         TEXT,                -- from finish() or lastAssistantText
  error           TEXT,
  errorClass      TEXT,                -- 'infra' | 'logic' | 'abort' | 'overflow'
  retryable       INTEGER,            -- 0 or 1
  -- merged handoff fields (optional)
  artifact        TEXT,                -- file path, validated if present
  context         TEXT,
  expectations    TEXT,
  notify          TEXT                 -- JSON array of FYI agent names
);

CREATE INDEX idx_status    ON requests(status);
CREATE INDEX idx_to_agent  ON requests(toAgent);
CREATE INDEX idx_parent    ON requests(parentRequestId);
CREATE INDEX idx_created   ON requests(createdAt);

PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
```

### Request lifecycle

```
CREATED → IN_PROGRESS → COMPLETED | FAILED | BLOCKED
```

### What creates requests (4 points, all auto)

| Location | from | to | method | source |
|----------|------|----|--------|--------|
| `chat-session.ts` — user sends message | `"human"` | agent | `"chat"` | console/socket/telegram |
| `manager-agents-tool.ts` — send() | caller agent | target agent | `"send"` | — |
| `manager.ts` — callAgent() | parent agent | child agent | `"call"` | — |
| `workflow-tool.ts` — workflow step | workflow agent | step agent | `"workflow"` | — |

Cron heartbeats do **not** create request records. They're scheduled checks, not requests. If a heartbeat processes a todo item, that item's request already exists.

### Known issues with socket tracking (Phase 7j)

Three bugs where socket input bypasses or corrupts request tracking:

1. **Lazy import race condition** — `chat-session.ts` uses async `import("../lib/requests.js")` but calls `_trackRequest?.()` synchronously. On the first call after process restart, the module hasn't loaded yet, so `_trackRequest` is null → first human message is **untracked**. Fix: use synchronous `require()` or top-level `await import()` at module load, not at call time.

2. **`run` command in non-chat mode skips tracking** — When `chatSession` is null (task/cron mode), `may.ts` calls `manager.run()` directly with no `trackRequest()` or `logOrder()`. Any `{"type":"run","agent":"bob","message":"..."}` sent via socket is invisible to the request DB. Fix: add `trackRequest()` to the non-chatSession `run` branch.

3. **Source always hardcoded to `"chat"`** — `chat-session.ts` records `source: "chat"` in orders/requests regardless of whether input came from console, socket, or telegram. The real source is passed to `handleInput(msg, source)` and logged to `human-inputs.jsonl`, but never propagated to `logOrder()` or `trackRequest()`. Fix: pass `source` through `sendMessage()` and `startDirectSession()` into the tracking calls.

### What updates requests (3 points, all auto)

| Location | Trigger | Update |
|----------|---------|--------|
| `manager.ts run()` | session starts | status → IN_PROGRESS, sessionId set |
| `lifecycle.ts finish()` | agent calls finish() | status from params, summary/deliverables set |
| `manager.ts handleCompletion()` | session ends | status → COMPLETED/FAILED, durationMs set |

### Send completion: todo.md checkbox as ground truth

The tricky case: `send()` creates a request, writes to todo.md, triggers heartbeat. How does the request get marked COMPLETED?

1. `send()` writes `- [ ] [req:r1] Fix auth bug (from: may)` to todo.md
2. Heartbeat fires → agent reads todo.md → works on `[req:r1]`
3. Agent marks `- [x]` and/or calls `finish()`

Completion detection (two paths, both work):
- **Immediate**: Agent calls `finish()` → infra updates request via session's requestId
- **Audit**: Hourly job scans todo.md, finds `[req:r1]` marked `[x]` → updates request to COMPLETED

The audit path is the safety net. If the agent forgets `finish()`, the checkbox still closes the loop.

### requestId propagation

When `callAgent()` creates a child request, it sets `parentRequestId`:

```
req_001 (human → may, "fix login bug")
  └─ req_002 (may → tech-lead, "fix auth module")
       └─ req_003 (tech-lead → coder, "implement fix in auth.ts")
```

For `send()`, the requestId is embedded in the todo.md entry as `[req:xxx]`. When the heartbeat processes that item, the requestId flows into the session context.

### Multi-reader notifications

Today handoff has `read_by: ['bob', 'tech-lead', 'coach']`. Usage analysis: 416/700 are single-target `["may"]`.

In unified send(): primary target gets the todo.md entry and request record. Additional agents listed in `notify` get FYI todo entries (no separate request record — they're not expected to act):

```
- [ ] [fyi] Review P70 enforcement design (from: bob → tech-lead, you're CC'd)
```

## Implementation

### New file: `src/lib/requests.ts` (~100 lines)

Replaces `orders.ts` (211 lines) and most of `session-recovery.ts` (216 lines). `classifyError()` stays — it's pure logic, not storage.

```typescript
import { Database } from "bun:sqlite";

// Core functions:
function getDb(persistDir: string): Database           // lazy init, WAL mode
function trackRequest(persistDir: string, opts): string | undefined  // try-catch wrapped
function updateRequest(persistDir: string, requestId, update): void  // try-catch wrapped
function getActiveRequests(persistDir: string): RequestRecord[]
function getRequestsByAgent(persistDir: string, agent: string): RequestRecord[]
function getRequestTree(persistDir: string, requestId: string): RequestRecord[]
function getStaleRequests(persistDir: string, maxAgeMs: number): RequestRecord[]
function isDuplicate(persistDir: string, from, to, taskHash): boolean
function archiveOld(persistDir: string, maxAgeDays: number): number
```

### Wiring changes (~20 lines each, mechanical)

1. **`chat-session.ts`**: Replace `logOrder()` with `trackRequest()`. Remove orders.ts import.
2. **`manager-agents-tool.ts` send case**: Add `trackRequest()`. Include `[req:requestId]` in todo.md line.
3. **`manager-agents-tool.ts`**: Merge handoff logic into send case. Add optional artifact/context/expectations/notify fields.
4. **`manager.ts callAgent()`**: Add `trackRequest()` with `parentRequestId`. Store requestId on session.
5. **`manager.ts handleCompletion()`**: Add `updateRequest()`. Replace `logDelegation()`, `logRecoveryNeeded()`.
6. **`lifecycle.ts finish()`**: Replace `session-outcomes.jsonl` write with `updateRequest()`.
7. **`workflow-tool.ts`**: Add `trackRequest()` per workflow step.

### Files deleted

| File | Lines | Replacement |
|------|-------|-------------|
| `src/lib/orders.ts` | 211 | `requests.ts` |
| `src/lib/session-recovery.ts` | 216 | `classifyError()` moves to `requests.ts`, rest deleted |
| `src/lib/tools/handoff-tool.ts` | ~150 | merged into send() in `manager-agents-tool.ts` |
| `agents/shared/SIGNALS.md` | 8,000+ | eliminated |
| `.state/orders.jsonl` | runtime | `.state/requests.db` |
| `.state/delegations.jsonl` | runtime | `.state/requests.db` |
| `.state/session-outcomes.jsonl` | runtime | `.state/requests.db` |
| `.state/recovery.jsonl` | runtime | `.state/requests.db` |

### Files kept (unchanged)

| File | Reason |
|------|--------|
| `job-history.jsonl` | cron execution log, orthogonal |
| `human-inputs.jsonl` | raw audit trail |
| `todo.md` (per agent) | agent-facing task queue, bash-editable |
| `bulletin.md` | broadcast information, not requests |

### Heartbeat simplification

Every agent's heartbeat.md currently has a step to grep SIGNALS.md. This step is removed:

```diff
- ## 3. Signals
- Check `agents/shared/SIGNALS.md` for PENDING_ACK targeting you.
- grep -i "agent-name" agents/shared/SIGNALS.md | tail -5
```

Bob's heartbeat loses ~40 lines of dedup-checking against SIGNALS.md.

### Auto-escalation (F6)

Wired into `handleCompletion()` — when a session ends, infra checks the outcome and notifies the responsible party:

```typescript
// In handleCompletion(), after status is determined:
const requestId = session.requestId;
const request = requestId ? getRequest(persistDir, requestId) : null;
const parent = request?.parentRequestId ? getRequest(persistDir, request.parentRequestId) : null;
const escalateTo = parent?.fromEntity ?? "may";  // parent's sender, or May if root

if (finishStatus === "blocked" || finishStatus === "failure") {
  // Add todo item to responsible agent
  const msg = `[escalation] ${session.agentName} ${finishStatus}: ${finishSummary}. Session: ${session.sessionId}`;
  appendTodoItem(agentsRoot, escalateTo, msg);
  triggerHeartbeat(escalateTo);
}

if (archiveStatus === "error" && errorClass === "logic") {
  const msg = `[error] ${session.agentName} logic error: ${session.error}. Session: ${session.sessionId}`;
  appendTodoItem(agentsRoot, "may", msg);
}

if (recoveryExhausted) {
  const msg = `[recovery-failed] ${session.agentName} exhausted ${MAX_RECOVERY_ATTEMPTS} retries: ${session.error}. Original task: ${session.task.slice(0, 200)}`;
  appendTodoItem(agentsRoot, "may", msg);
  triggerHeartbeat("may");
}
```

**Key**: escalation target is determined by the request tree, not hardcoded. If tech-lead sent the task, tech-lead gets notified. If May sent it, May gets notified. If there's no parent (human order), May gets notified.

### Startup recovery (F8)

Wired into `may.ts` startup, after `resumeStaleSessions()`:

```typescript
// After session resume, check for orphaned requests
const stale = getStaleRequests(persistDir, 4 * 60 * 60 * 1000); // 4h
for (const req of stale) {
  if (!manager.isSessionAlive(req.sessionId)) {
    updateRequest(persistDir, req.requestId, { status: "CREATED" });
    manager.run(req.toAgent, req.task, { requestId: req.requestId, kind: "job" });
  }
}
```

Replaces the never-called `getPendingOrders()` and `getPendingRecoveries()`.

### Cron jobs

**Audit job** (`agents/may/handlers/audit-requests.ts`, hourly):
- Find CREATED > 2h → stale warning
- Find IN_PROGRESS > 4h with dead session → reset to CREATED, re-trigger
- Scan todo.md for checked `[req:xxx]` items → update matching requests to COMPLETED
- Archive COMPLETED/FAILED > 7 days

**Daily brief integration** (add section to `daily-brief.ts`):
- Requests (24h): N created, N completed, N failed, N stale
- Completion rate, avg duration per agent
- Unresolved requests > 12h: list

## Agent-side updates (after code ships)

Code changes first, then agent docs. If docs update before code, agents will try send() fields that don't exist yet and lose the handoff tool they still need.

### Delete

| File | Reason |
|------|--------|
| `agents/shared/skills/handoff/SKILL.md` | Handoff skill obsolete — send() absorbs it |
| `agents/shared/SIGNALS.md` | Eliminated |

### Rewrite

| File | Change |
|------|--------|
| `agents/shared/CONVENTIONS.md` C1 | "Artifact Handoff (P82)" → "Artifact Delivery": use `agents.send()` with `artifact` field. No SIGNALS.md. P82 compliance is automatic (infra validates artifact exists, deduplicates, tracks lifecycle). |
| `agents/shared/common-sense.md` §5.2 | Remove handoff as separate channel. "Use `call()` for sync work, `send()` for async work. To deliver an artifact, use `send()` with the `artifact` field." |
| `agents/shared/best-practices.md` §13/§16/§19 | Remove all SIGNALS.md protocol, manual ACK format, handoff tool migration notes, P82 enforcement details (~20 references). Replace with: "`send()` handles artifact delivery, dedup, and lifecycle tracking automatically." |

### Remove SIGNALS.md steps from heartbeats

| Agent | What to remove |
|-------|---------------|
| `agents/amy/heartbeat.md` | Step 1 SIGNALS check (~2 lines) |
| `agents/bob/heartbeat.md` | C27 dedup ceremony (~28 lines) + SIGNALS references |
| `agents/evaluator/heartbeat.md` | SIGNALS check in step 1 (~1 line) |
| `agents/may/heartbeat.md` | Entire Step 4 "Signals" + SIGNALS-last rule (~10 lines) |
| `agents/optimizer/heartbeat.md` | SIGNALS grep step (~1 line) |

### Update SOULs

| Agent | What to remove |
|-------|---------------|
| `agents/may/SOUL.md` | SIGNALS PATH note (line 9), heartbeat SIGNALS batching rule (line 3) |

### Update tool presets

| File | Change |
|------|--------|
| `src/app/agent-loader.ts` | Remove `"coordination"` case that creates handoff tool. Artifact validation moves into the `"agents"` preset's send() action. |
| `agents/*/agent.json` (all agents) | Remove `"coordination"` from tool presets. Agents with `"agents"` preset already have send(). Agents without `"agents"` (leaf nodes: coder, evaluator, qa, amy-kimi) need a way to send artifacts — either add `"agents"` preset or a lightweight `"send-only"` preset. |

### Update practices doc

| File | Change |
|------|--------|
| `docs/agent-practices.md` F1 | Update "What infra does for you" to mention send() with artifact field, automatic dedup |
| `docs/agent-practices.md` F3 | Remove "Marking [x] in todo.md but not calling finish() — the checkbox is not a completion signal to infra" — checkbox IS now a valid completion signal via audit |

## Migration

### Phases 1-6: Code (DONE)

Phases 1-6 shipped: requests.ts, wiring into agents-tool/chat-session/manager/lifecycle, handoff backward compat, audit-requests cron, CLI status tool, send-only tool for leaf agents.

### Phase 7: Cleanup (TODO)

Code shipped but old files and contradictory docs remain. This phase removes dead code and updates agent docs to match the new reality.

**Principle**: Code changes first, docs second. Agents must use new tools before docs tell them to.

#### 7a. Delete dead code

| File | Lines | Why |
|------|-------|-----|
| `src/lib/orders.ts` | 211 | Replaced by `requests.ts` |
| `src/lib/session-recovery.ts` | 216 | Replaced by `requests.ts` (keep `classifyError()` — move to `requests.ts` or standalone) |
| `src/lib/tools/handoff-tool.ts` | ~150 | Merged into send() |

Also strip: `logDelegation()` in manager.ts, `session-outcomes.jsonl` writes in lifecycle.ts, old JSONL imports.

#### 7b. Delete dead agent files

| File | Size | Why |
|------|------|-----|
| `agents/shared/SIGNALS.md` | 424KB | Eliminated — unbounded, 99.3% handoff entries |
| `agents/shared/skills/handoff/SKILL.md` | 2.9KB | Obsolete — send() absorbs it |
| `agents/shared/skills/agent-coordination/` | dead | Zero references in any agent file |
| `agents/shared/skills/document-collaboration/` | dead | Zero references |
| `agents/shared/skills/knowledge-sharing/` | dead | Zero references |
| `agents/shared/skills/l3-delegation-metrics/` | dead | Zero references |
| `agents/shared/skills/check-state/` | dead | Zero references |
| `agents/shared/skills/prototype-skill-package/` | dead | Zero references |
| `agents/shared/skills/error-handling/` | dead | Zero references |
| `agents/shared/skills/evaluator-scoring/` | dead | Zero references |
| `agents/shared/skills/file-safety/` | dead | Zero references |
| `agents/shared/skills/web-scraping/` | dead | Zero references |

#### 7c. Rewrite CONVENTIONS.md

Currently 4 conventions. C1 and C4 reference handoff/SIGNALS — both invalid now.

| Convention | Current | New |
|------------|---------|-----|
| C1 | "Artifact Handoff via handoff skill in SIGNALS.md" | "Artifact Delivery: use `agents.send()` with `artifact` field. Infra validates artifact exists, deduplicates, tracks lifecycle." |
| C2 | Transient Strategy (P53) | Keep as-is |
| C3 | Deterministic Verification (P14) | Keep as-is |
| C4 | Skill Compliance Trigger for handoff | Delete entirely — handoff is gone, trigger mechanism was never used |

#### 7d. Rewrite best-practices.md cooperation sections

best-practices.md is 958 lines. The following sections are contradicted by the new system and must be rewritten or deleted:

| Section | Lines | Problem | Action |
|---------|-------|---------|--------|
| Part 13 (Communication Protocols) | §13.1-13.2 | References handoff tool, SIGNALS.md writes, manual ACK format, PENDING_ACK status, read_by metadata, GNAP typed messages | Rewrite to: "Use `call()` for sync, `send()` for async. Artifact delivery uses send(artifact). Infra handles tracking. No ACK ceremony needed." (~10 lines replaces ~55) |
| §15 (Authorization Protocol) | §15 | References budget attachment to delegation | Keep but remove handoff references |
| §16 (Acknowledgment Protocol) | §16 | Manual `[ACK: agent timestamp]` format, entire section | Delete — infra tracks via request lifecycle |
| Part 19 (Harness Engineering) | §19.1-19.5 | Handoff tool as example of "good harness", deprecation tables referencing handoff skill vs handoff tool | Rewrite: the lesson (tool > text protocol) is valid, but all handoff examples are obsolete. Replace with send() examples. Shorten ~90 lines to ~20. |
| Part 20 (Knowledge Lifecycle) | §20.1 | "Uses handoff tool to send to Bob" | Replace with "Uses send() to deliver to Bob" |
| Part 21 (RAEV Protocol) | §21.1-21.5 | Entire RAEV state machine (Request→Ack→Execute→Verify) built on handoff tool | Delete — request tracking DB automates lifecycle. RAEV was behavioral overhead that agents never followed. |

**Net reduction**: ~300 lines removed, ~30 lines added. best-practices.md goes from 958 to ~690 lines.

#### 7e. Update common-sense.md §5.2

Current: mentions handoff as a third channel ("Use the right channel... handoff() for transferring artifacts.")

New: "Use `call()` for sync work (you need the result). Use `send()` for async work (fire-and-forget). To deliver an artifact, use `send()` with the `artifact` field."

One-line fix.

#### 7f. Remove SIGNALS.md steps from heartbeats

| Agent | What to remove |
|-------|---------------|
| `agents/amy/heartbeat.md` | Line 27: SIGNALS check step (~2 lines) |
| `agents/bob/heartbeat.md` | Lines 61-80: C27 dedup ceremony (~20 lines) |
| `agents/evaluator/heartbeat.md` | Line 32: SIGNALS check (~1 line) |
| `agents/may/heartbeat.md` | Lines 8, 39, 63-67, 70: SIGNALS references + Step 4 (~15 lines) |
| `agents/optimizer/heartbeat.md` | Line 14: SIGNALS grep step (~2 lines) |

#### 7g. Update SOULs

| Agent | What to remove |
|-------|---------------|
| `agents/may/SOUL.md` line 3 | SIGNALS.md batch rule in HEARTBEAT RULE |
| `agents/may/SOUL.md` line 9 | SIGNALS PATH note |

#### 7h. Update tool presets

| File | Change |
|------|--------|
| `src/app/agent-loader.ts` | Remove `"coordination"` tool preset case (handoff tool). |
| `agents/*/agent.json` | Remove `"coordination"` from presets where present. Leaf agents (coder, evaluator, qa, amy-kimi) now use send-tool.ts which shipped in Phase 6. |

#### 7i. Update docs

| File | Change |
|------|--------|
| `docs/agent-practices.md` | Already correct for post-F1 world — minor wording adjustments only |
| `docs/README.md` | No change needed |

#### 7j. Fix socket tracking gaps

Three bugs where socket/human input bypasses request tracking (see "Known issues with socket tracking" section above):

| Bug | File | Fix | Size |
|-----|------|-----|------|
| Lazy import race — first message after restart untracked | `src/app/chat-session.ts` | Replace async `import()` with sync import at module load (Bun supports top-level `import` of bun:sqlite) | ~5 lines |
| `run` in non-chat mode skips tracking | `src/app/may.ts` | Add `trackRequest()` + `logOrder()` to the `else` branch of `case "run"` | ~10 lines |
| Source hardcoded to `"chat"` | `src/app/chat-session.ts` | Thread `source` parameter through `sendMessage()` and `startDirectSession()` into tracking calls | ~8 lines |

### Implementation order for Phase 7

1. **7a + 7j first** — delete dead code + fix socket tracking bugs, verify `tsc` and tests pass
2. **7h second** — remove coordination preset, verify agents still load
3. **7b + 7c + 7d + 7e + 7f + 7g together** — all agent file changes in one pass (they're in the gitignored agents/ directory, no compilation)
4. **7i last** — update docs

## Net effect

| Metric | Before | After |
|--------|--------|-------|
| Tracking code | ~500 lines across 4 files + 2 modules | ~100 lines in 1 module |
| JSONL files | 4 (orders, delegations, session-outcomes, recovery) | 0 |
| Communication primitives | 3 (call, send, handoff) | 2 (call, send) |
| SIGNALS.md | 8,000+ lines, unbounded growth | eliminated |
| Heartbeat steps per agent | read todo + grep SIGNALS | read todo |
| Recovery wired | no (built, never called) | yes (getStaleRequests on startup + hourly audit) |
| Escalation wired | no (onSessionBlocked defined, never called) | yes (auto-notify parent on blocked/failure/error/exhaustion) |
| send() completion tracking | none | yes (audit job + finish()) |
| Request tree visibility | none | yes (recursive CTE) |

---

## Changelog

- **2026-03-13**: Created. JSONL-based design with requests.jsonl.
- **2026-03-13**: Revised. Merged handoff into send(). Eliminated SIGNALS.md. Switched from JSONL to SQLite (bun:sqlite, zero deps). Added soft-coupling principle. Scoped heartbeats out of request creation. Added todo.md checkbox as audit-based completion signal.
- **2026-03-13**: Phase 7 (Cleanup) added. Scopes dead code deletion, dead agent file deletion (SIGNALS.md, 11 unused skill dirs, handoff skill), CONVENTIONS.md rewrite, best-practices.md rewrite (~300 lines removed), heartbeat/SOUL SIGNALS removal, tool preset cleanup. Implementation order: dead code → presets → agent files → docs.
- **2026-03-13**: Phase 7j added. Three socket tracking bugs: (1) lazy import race — first message after restart untracked, (2) `run` command in non-chat mode skips tracking, (3) source always hardcoded to "chat" regardless of actual channel. Added source column to request creation table.
