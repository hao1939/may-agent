# May-as-Gatekeeper: Engineering Analysis

**Date**: 2026-04-15
**Status**: Draft — awaiting Hao review

## Problem

Agents can currently propose and execute system-level changes (heartbeat restructuring, new workflows, cross-agent context edits) without human review. We want May to catch these, pause execution, alert Hao, and wait for approval before they land.

## 1. Integration with persistent-task

### How it works today

`persistent-task.ts` already checks `Status` at two points:
1. **Line ~104** (`parseProjectState`): parses `**Status**: <value>` from the project file
2. **Line ~357** (iteration loop top): re-reads the file each iteration and exits on `paused`, `cancelled`, or `done`

### Adding pending-review

**Detection**: Add `pending-review` to the status checks at line ~357, alongside `paused`/`cancelled`:

```ts
if (state.status === "pending-review") {
  return ctx.done(
    `Paused for human review. Approval needed at ${config.projectPath}.`
  );
}
```

**How it gets set**: The owner/reviewer agent (typically May or tech-lead) writes `**Status**: pending-review` to the project file when the review phase detects a system-level change. No workflow code change needed for *setting* it — the reviewer writes it directly.

**Resuming**: Hao sends `/approve <task-id>` via Telegram → May reads the project file → sets `**Status**: active` → next cron cycle picks it up and re-enters the persistent-task loop (same crash-recovery path that already handles mid-iteration restarts).

**LOC**: ~8 lines in persistent-task.ts (one status check + one helper).

## 2. Non-persistent-task gating

For regular forked sessions, the simplest mechanism: **May simply doesn't dispatch the next step.**

May already controls dispatch. When an agent proposes a system-level change via `agents.message()`, May's follow-up handler can:

1. Write the proposal to `agents/may/workspace/approval-ledger.md` with status `pending`
2. Send a Telegram alert
3. Not fork the implementing session

On approval, May's next heartbeat reads the ledger, sees `approved`, and dispatches normally.

This requires zero new code — it's a behavioral pattern in May's context/heartbeat, not a code mechanism. May already decides what to fork and when. Adding "check the ledger before dispatching system-scope work" is a context.md instruction.

**LOC**: 0 code changes. ~5 lines added to May's context.md.

## 3. Telegram handler changes

### Current state

`telegram.ts` line ~168 maps slash commands to input strings:
```ts
const cmdMap: Record<string, string> = {
  "/cancel": "cancel",
  "/status": "status",
  "/reload": "reload",
  "/close": "close",
  "/agents": "status",
};
```

Unknown `/commands` get the slash stripped and pass through as regular input (line ~196).

### Minimal change: no code needed

`/approve EXP-042` already reaches May as input text `"approve EXP-042"` (unknown commands pass through). `/reject EXP-042 too risky` becomes `"reject EXP-042 too risky"`. `/pending` becomes `"pending"`.

May interprets these as natural language instructions during her input handler. She:
1. Finds the matching entry in the approval ledger
2. Updates the project file Status if persistent-task
3. Records the decision in the ledger
4. Replies via Telegram with confirmation

**LOC**: 0 in telegram.ts. May handles it via existing natural-language input path.

### Optional: explicit command mapping (~4 LOC)

If we want `/approve` to show up in `/help`, add 3 entries to cmdMap and 3 lines to the help text. Low priority — natural language routing already works.

## 4. May's monitoring hook

### Recommendation: Option B — agents send REVIEW_REQUEST messages

**Why not A** (peek at sessions): Requires May to inspect every active session's output for design docs — expensive, fragile regex matching, high false-positive rate.

**Why not C** (file-write guard): Guards are brittle (KE-004) and create false positives when environment changes.

**Option B flow**:

1. Agent writes a proposal (design doc, heartbeat change, etc.)
2. Agent calls `agents.message("may", "REVIEW_REQUEST: <one-line description>", { context_files: ["path/to/proposal.md"] })`
3. May's next heartbeat picks up the message, reads the proposal
4. May classifies: **agent-scoped** (auto-approve, log to ledger) vs **system-scoped** (alert Hao, set pending-review)
5. For system-scoped: May sends Telegram alert, writes to ledger with status `pending`

**What triggers agents to send REVIEW_REQUEST?** A context.md instruction for each agent:
> Before executing changes to: (a) another agent's heartbeat/context, (b) shared workflows, (c) src/ infrastructure, (d) cross-agent protocols — send a REVIEW_REQUEST to May with the proposal file.

This is behavioral, not code. Agents already know how to call `agents.message()`.

**LOC**: 0 code changes. ~3 lines per agent context.md (~15 lines total across 5 agents).

## 5. Approval ledger

**Path**: `agents/may/workspace/approval-ledger.md`

**Format**:
```markdown
# Approval Ledger

## 2026-04-15T10:30:00Z — EXP-042 persistent-task customization
- **Proposer**: tech-lead
- **Scope**: system (modifies shared workflow)
- **Proposal**: agents/shared/may-agent-docs/design/persistent-task-amendments.md
- **May's judgment**: System-scoped — touches shared workflow used by all agents
- **Decision**: approved — Hao 2026-04-15T11:02:00Z
- **Reason**: "Good analysis, proceed"

## 2026-04-15T09:15:00Z — heartbeat step reorder
- **Proposer**: optimizer
- **Scope**: system (heartbeat structural change)
- **Proposal**: (inline message)
- **May's judgment**: System-scoped — KE-008 violation risk
- **Decision**: rejected — Hao 2026-04-15T09:20:00Z
- **Reason**: "KE-008: no heartbeat restructuring"
```

Entries are prepended (newest first). May reads this during her heartbeat to check for pending items and to calibrate her judgment over time.

**LOC**: 0 code. Template created once by May.

## Summary: total implementation cost

| Component | Code LOC | Context/behavioral LOC | Notes |
|-----------|----------|----------------------|-------|
| persistent-task status check | ~8 | 0 | Add `pending-review` handling |
| Non-persistent gating | 0 | ~5 | May context.md instruction |
| Telegram commands | 0 | 0 | Natural language path works |
| Telegram help text (optional) | ~4 | 0 | Low priority polish |
| Agent REVIEW_REQUEST | 0 | ~15 | Context.md for 5 agents |
| Approval ledger | 0 | 0 | Template file, no code |
| **Total** | **~8-12** | **~20** | |

## Sequencing

1. **Now**: Create approval ledger template, add REVIEW_REQUEST instructions to agent context files
2. **Next heartbeat cycle**: May starts checking for REVIEW_REQUEST messages, writing to ledger
3. **When needed**: Add the ~8 LOC to persistent-task.ts for `pending-review` status
4. **Optional**: Add `/approve` `/reject` `/pending` to Telegram help text

Steps 1-2 are zero-code and can ship immediately as context changes.
