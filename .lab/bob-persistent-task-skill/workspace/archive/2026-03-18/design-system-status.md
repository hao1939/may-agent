# Design: System Status Tool (`system-status`)

**Date:** 2026-03-13
**Author:** Bob
**Status:** Implemented
**Related:** `agents/may/workspace/brainstorm-system-observability.md`

## 1. Executive Summary
We need a "single pane of glass" to see what the agent system is doing right now and what it has accomplished recently. Currently, this requires manually grepping multiple log files. 

We will build a `system-status` tool (and CLI wrapper) that aggregates real-time data from `.state/` and markdown context files into a dashboard view.

## 2. Architecture

### 2.1 Component Location
- **Tool**: `src/lib/tools/system_status.ts` (New tool)
- **CLI Adapter**: `src/lib/tools/index.ts` (Export it so it's callable via `pi` or agent harness)

### 2.2 Data Flow
The tool operates in **ReadOnly** mode, aggregating data from 5 sources:

1.  **Active Sessions** (`.state/sessions/*/meta.json`)
    -   *Source of Truth*: Directory listing of `.state/sessions/` (excluding `history` directory).
    -   *Data*: Agent, Task, StartTime (Duration).
2.  **Recent History** (`.state/sessions/history/`)
    -   *Source of Truth*: The last ~50 directories in `history/` (sorted by timestamp in filename).
    -   *Data*: Status (success/fail), Duration, Error messages.
3.  **Delegations** (`.state/delegations.jsonl`)
    -   *Source of Truth*: Last ~50 lines of `delegations.jsonl`.
    -   *Data*: Who called whom, error rates in delegation.
4.  **Cron/Jobs** (`.state/job-history.jsonl`)
    -   *Source of Truth*: Last ~50 lines of `job-history.jsonl`.
    -   *Data*: Heartbeat health, cron execution status.
5.  **Strategic Context**
    -   `agents/shared/focus-tasks.md` (Current focus)
    -   `agents/may/workspace/todo.md` (Operational queue)

## 3. Output Specification

The tool outputs a structured Markdown block.

### Example Output
```markdown
# System Status: 2026-03-13 22:15 UTC

## 🟢 Active Sessions (3)
- **scout** (s_177...882): "Deep dive on P95" (Running 14m 20s)
- **bob** (s_177...901): "Heartbeat" (Running 1m 05s)
- **may** (s_177...912): "Triage inbox" (Running 12s)

## 📉 Last Hour (Window: 60m)
- **Throughput**: 14 sessions completed
- **Success Rate**: 92% (13/14)
- **Failures**: 
  - `coder` (s_177...800): "Linter error" (via `.state/sessions/history/...`)
- **Top Agents**: Bob (6), May (4), Coder (4)

## 🔄 Recent Delegations (Last 10)
- bob -> optimizer (success)
- bob -> tech-lead (error: "Context limit")
- may -> scout (success)

## 🎯 Strategic Context
- **Focus**: "Security & Hierarchy (P84/P85)" (from `focus-tasks.md`)
- **Ops Queue**: 12 items pending (from `todo.md`)
- **System Health**: All cron jobs passing (last 30m)
```

## 4. Implementation Logic

### 4.1 "Recent History" Optimization
**Constraint**: We have 3,530+ history folders. Scanning all is O(N) and slow.
**Solution**:
- The folders are named `s_{TIMESTAMP}_...`.
- `fs.readdir` returns filenames.
- Sort filenames descending.
- Slice the top 50.
- Only `fs.readFile` the `meta.json` for those 50.
- **Do not** recursively walk the whole history directory.

### 4.2 Aggregation Logic
1.  **Read Active**:
    -   `glob('.state/sessions/*/meta.json')`
    -   Calculate `duration = Date.now() - startedAt`
2.  **Read History**:
    -   `readdir('.state/sessions/history')` -> sort desc -> take 50.
    -   Read `meta.json` for each.
    -   Filter `endedAt > Date.now() - 1 hour`.
    -   Compute stats (count, success%, avg duration).
3.  **Read Logs** (`delegations.jsonl`, `job-history.jsonl`):
    -   Use a "tail" helper (read last 10KB of file, split by newline, take last N lines).
    -   **Do not** read 50MB files into memory.
4.  **Read Context**:
    -   Read `focus-tasks.md`, extract first non-empty line after header.

### 4.3 Code Structure (Draft)
```typescript
// src/lib/tools/system_status.ts

export const systemStatus: Tool = {
  name: "system_status",
  description: "Get a high-level dashboard of system activity, active sessions, and recent history.",
  parameters: {
    type: "object",
    properties: {
      windowMinutes: { type: "number", description: "Lookback window in minutes (default 60)" }
    }
  },
  handler: async ({ windowMinutes = 60 }) => {
    // 1. Get Active Sessions
    const active = await getActiveSessions();
    
    // 2. Get History Stats (Smart Read)
    const history = await getHistoryStats(windowMinutes);
    
    // 3. Get Logs (Tail)
    const delegations = await tailLog('.state/delegations.jsonl', 10);
    
    // 4. Get Context
    const focus = await readFocus();
    
    return formatMarkdown({ active, history, delegations, focus });
  }
};

async function getHistoryStats(windowMinutes: number) {
   // fs.readdir -> sort -> slice(0, 50) -> read meta.json -> filter by time
}
```

## 5. Constraints & Edge Cases

1.  **Race Conditions**: A session might move from `active` to `history` while the tool runs.
    -   *Handling*: Accept slight inconsistency. If it vanishes from active and isn't in history yet, it's missing for one read. Acceptable for observability.
2.  **Large Files**: `delegations.jsonl` grows indefinitely.
    -   *Handling*: MUST implement a `tailFile` utility that reads from the end using `fs.open` + `read` with position. **Never** `fs.readFile` the whole log.
3.  **Truncated JSON**: `meta.json` might be half-written.
    -   *Handling*: Wrap `JSON.parse` in try/catch. If corrupt, ignore that entry.

## 6. Action Plan for Tech-Lead
1.  Create `src/lib/utils/tail.ts` (if not exists) for efficient log reading.
2.  Create `src/lib/tools/system_status.ts`.
3.  Implement the "Sort & Slice" logic for history.
4.  Register tool in `src/lib/tools/index.ts`.
5.  Verify by running `agents.call("may", "check system status")`.
