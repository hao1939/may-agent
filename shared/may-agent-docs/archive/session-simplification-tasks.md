# Session Simplification — Implementation Tasks

**Source**: `session-simplification-proposal.md` (approved), Bob's review, `simplification-status.md`
**Date**: 2025-03-08
**Author**: May (decomposition for coder)

## Overview

Replace the `persistent: boolean` field with `autoClose: "immediate" | "never"` across the session model. The Manager determines the policy from the agent name — callers never choose.

**Current state**: `run/cron.ts` already uses fresh sessions (no persistent). `may.ts` calls `manager.setInterfaceAgent()` but the method doesn't exist yet. The `persistent` field still controls all branching in `manager.ts`.

---

## Task 1: Add `setInterfaceAgent()` and `autoClose` field to `ActiveSession`

**Goal**: Introduce the new infrastructure without changing any behavior yet. After this task, `autoClose` exists but `persistent` still drives all logic.

### Files to change

**`src/manager.ts`**:
1. Add private field `private interfaceAgentName?: string;` to `SubagentManager`.
2. Add public method:
   ```typescript
   setInterfaceAgent(name: string): void {
     this.interfaceAgentName = name;
   }
   ```
3. Add helper method:
   ```typescript
   private isInterfaceAgent(name: string): boolean {
     return name === this.interfaceAgentName;
   }
   ```
4. Add `autoClose: "immediate" | "never"` field to the `ActiveSession` interface (alongside `persistent` — both coexist temporarily).
5. In `run()` (line ~867), set **both** fields:
   ```typescript
   persistent: opts?.persistent ?? false,
   autoClose: this.isInterfaceAgent(name) ? "never" : "immediate",
   ```
6. In `resumeAgent()` (line ~1151), set **both** fields:
   ```typescript
   persistent: opts?.persistent ?? false,
   autoClose: this.isInterfaceAgent(agentName) ? "never" : "immediate",
   ```

### Tests
- All 21 existing tests pass (no behavior change).
- Optionally: add a unit test that `setInterfaceAgent` + `isInterfaceAgent` work correctly.

### Commit message
`feat: add setInterfaceAgent() and autoClose field (coexists with persistent)`

---

## Task 2: Replace `persistent` checks with `autoClose` checks in `handleCompletion`

**Goal**: The main branching logic in `handleCompletion()` switches from `session.persistent` to `session.autoClose`.

### Files to change

**`src/manager.ts`** — `handleCompletion()` (lines ~519–668):

1. **Line 549**: Change `if (session.persistent)` → `if (session.autoClose === "never")`.
   - The entire block (lines 549–571) stays the same — it handles interface agent idle transition + compaction.

2. **Line 495** in `compactPersistentSession()`: Change `if (!session.persistent) return;` → `if (session.autoClose !== "never") return;`.

3. **Lines 633–644** (notification routing — find persistent session for parent agent): Change `s.persistent` → `s.autoClose === "never"`.

4. **Lines 734–741** (drain undelivered notifications — find persistent session): Change `s.persistent` → `s.autoClose === "never"`.

5. Update comments throughout to reference `autoClose` instead of `persistent`.

### Tests
- All 21 existing tests pass. Behavior is identical because `autoClose` mirrors `persistent` (both set from the same source in Task 1).

### Commit message
`refactor: handleCompletion uses autoClose instead of persistent`

---

## Task 3: Remove `persistent` from `ActiveSession`, `RunOptions`, and `SubagentDefinition`

**Goal**: Delete the `persistent` field everywhere. The `autoClose` field (set internally by the Manager) is now the sole mechanism.

### Files to change

**`src/manager.ts`**:
1. Remove `persistent: boolean` from `ActiveSession` interface (line 139).
2. Remove `persistent?: boolean` from `RunOptions` interface (line 151).
3. Remove `persistent: opts?.persistent ?? false` from `run()` (line ~867) — only `autoClose` remains.
4. Remove `persistent: opts?.persistent ?? false` from `resumeAgent()` (line ~1151) — only `autoClose` remains.
5. Remove `persistent?: boolean` from `resumeAgent()` opts parameter (line 978).
6. Remove comment on line 1489 referencing "non-persistent idle".
7. Update doc comments on `run()` (line ~819) to reference `autoClose`.

**`src/types.ts`**:
1. Remove `persistent?: boolean` from `SubagentDefinition` (lines 85–91).

**`run/may.ts`**:
1. Verify no `persistent` is passed to `run()` or `resumeAgent()`. (Currently it doesn't — confirmed.)

**`run/handler-context.ts`**:
1. Update comment on line 27: "Agent's persistent session ID getter" → "Agent's interface session ID getter" (cosmetic).

### Tests
- All 21 existing tests pass.
- `grep -rn "persistent" src/manager.ts` returns only the workspace prompt string on line ~422 (which is unrelated — refers to "persistent workspace directory").

### Commit message
`refactor: remove persistent field — autoClose is sole session lifecycle mechanism`

---

## Task 4: Enforce `autoClose` policy in Manager (no caller override)

**Goal**: Callers cannot choose `autoClose`. The Manager enforces it based on `isInterfaceAgent()`. Make the `run()` and `resumeAgent()` APIs enforce binary policy.

### Files to change

**`src/manager.ts`**:
1. Remove `autoClose` from `RunOptions` (if it was added — it should NOT be in RunOptions at all). Confirm `autoClose` is only set internally in `run()` and `resumeAgent()`.
2. In `run()`, assert the invariant: task sessions (non-interface) MUST get `autoClose: "immediate"`. No opt-in/opt-out.
   ```typescript
   autoClose: this.isInterfaceAgent(name) ? "never" : "immediate",
   ```
3. In `resumeAgent()`, same enforcement. Also: `resumeAgent` should only succeed for the interface agent. Add a guard:
   ```typescript
   if (!this.isInterfaceAgent(agentName)) {
     throw new Error(`Cannot resume task agent "${agentName}" — only the interface agent can be resumed`);
   }
   ```
4. In `followUp()` (line ~1549): Add guard — `followUp` that wakes an idle session should only work for interface agent sessions:
   ```typescript
   if (session.status === "idle" && session.autoClose !== "never") {
     throw new Error(`Cannot wake task session "${sessionId}" — task sessions do not support followUp`);
   }
   ```
   (Note: under the new model, task sessions should never be idle, so this is a defensive check.)

### Tests
- All 21 existing tests pass.
- Add new test: calling `resumeAgent()` for a non-interface agent throws.
- Add new test: `followUp()` on a running task session works (steer is allowed).

### Commit message
`feat: enforce autoClose policy — Manager controls session lifecycle`

---

## Task 5: Remove `done`/`error` as live session states

**Goal**: Live sessions are `running`, `idle`, or `interrupted`. The `done`/`error` distinction becomes archive metadata only.

### Files to change

**`src/manager.ts`** — `ActiveSession.status` type:
1. Change from `"running" | "done" | "error" | "interrupted" | "idle"` to `"running" | "interrupted" | "idle"`.
2. In `handleCompletion()` task session branch (lines ~574–581): Instead of setting `session.status` to `"done"` or `"error"`, set it to `"interrupted"` for abort, or proceed directly to archive. The archive metadata (registry `updateSessionStatus`) can still record `"done"` or `"error"`.
   - Actually, per the proposal: when a task session goes idle, it immediately auto-closes (archives). The archive status records whether it was `done` or `error`. The **live** status never shows `done`/`error` because the session is removed before anyone can observe it.
   - Simplification: The task session path in `handleCompletion` becomes:
     ```typescript
     // Determine archive status
     const archiveStatus = wasAborted ? "interrupted" : (session.error ? "error" : "done");
     this.registry.updateSessionStatus(session.sessionId, archiveStatus, session.error);
     // ... unsubscribe, archive, remove from activeSessions ...
     ```
   - The session's in-memory `status` field never transitions to `done`/`error` — it goes from `running` → (removed).

**`src/types.ts`** — `SessionInfo.status`:
1. Keep `"done" | "error" | "interrupted"` for `SessionInfo` because the `onSessionComplete` callback and `result()` API report terminal states from archive data.
2. The **live** `status()` method will only ever return `"running"` or `"idle"`.

**`src/types.ts`** — `PersistedSession.status` (in `persistence.ts`):
1. Keep `"done" | "error" | "interrupted" | "idle"` for persisted data — these are archive/historical states.

**`src/manager.ts`** — `buildResultFromSession()` (line ~1397):
1. The `session.status` cast to `"done" | "error"` needs adjustment. Since the session is already removed by the time `buildResultFromSession` is called from the promise chain, use the archive status instead, or capture the archive status before removal.
   - Better approach: capture `archiveStatus` in a local variable and store it on the session before removal:
     ```typescript
     // In handleCompletion, before delete:
     session.status = archiveStatus as any; // or add a separate field
     ```
   - Or: change `buildResultFromSession` to derive status from `session.error` + abort state rather than `session.status`.

### Tests
- All 21 existing tests pass.
- Verify `manager.status()` never returns `"done"` or `"error"` for any active session.

### Commit message
`refactor: done/error are archive metadata, not live session states`

---

## Task 6: Update crash recovery to respect autoClose policy

**Goal**: `cleanupStaleSessions()` marks all stale sessions as interrupted. `resumeAgent()` only restores the interface agent. Task sessions found in `running`/`idle` state on startup are marked `failed`.

### Files to change

**`src/manager.ts`** — `cleanupStaleSessions()` (line ~940):
1. Already marks everything as `"interrupted"` — this is correct. No change needed.

**`src/manager.ts`** — `resumeAgent()` (line ~978):
1. Already handled in Task 4 (guard against non-interface agents). Verify the guard works.

**`run/may.ts`** (lines ~612–639):
1. The resume flow already tries `resumeAgent(interfaceAgent)` and falls back to a fresh session. Verify this works with the new `isInterfaceAgent` guard — it should, because `may.ts` already calls `setInterfaceAgent(interfaceAgent)` before resuming.

### Tests
- Existing tests pass.
- Add test: on startup, stale task sessions are marked interrupted (not resumed).
- Add test: stale interface agent session is resumable.

### Commit message
`feat: crash recovery respects autoClose — only interface agent is restored`

---

## Task 7: Clean up comments, docs, and naming

**Goal**: Remove all references to the old `persistent` model. Update comments, doc strings, and any markdown docs.

### Files to change

**`src/manager.ts`**:
1. Rename `compactPersistentSession` → `compactIdleSession` (or `compactSessionOnIdle`).
2. Update all comments mentioning "persistent" to use "interface agent" / "autoClose: never".
3. Update `SubagentManagerOptions.onSessionComplete` doc comment.

**`run/cron.ts`**:
1. Update comments on lines 6, 203, 262 that reference "persistent heartbeat sessions".

**`run/handler-context.ts`**:
1. Line 27: already handled in Task 3.

**`agents/shared/session-simplification-proposal.md`**:
1. Mark as implemented / update status.

**`agents/bob/workspace/simplification-status.md`**:
1. Update all checkboxes to done.

### Tests
- All tests pass (no behavior change).

### Commit message
`docs: update comments and docs for autoClose model`

---

## Dependency Graph

```
Task 1 (add autoClose + setInterfaceAgent)
   │
   ▼
Task 2 (switch handleCompletion to autoClose)
   │
   ▼
Task 3 (remove persistent field everywhere)
   │
   ▼
Task 4 (enforce policy — no caller override)
   │
   ├──► Task 5 (done/error → archive metadata)
   │
   └──► Task 6 (crash recovery)
         │
         ▼
      Task 7 (cleanup comments/docs)
```

Tasks 5 and 6 can be done in parallel after Task 4. Task 7 is last.

---

## Risk Notes

1. **`may.ts` calls `setInterfaceAgent()` before `run()`** — this is already the case (line 553 vs line 603). If `setInterfaceAgent` hasn't been called, all sessions default to `autoClose: "immediate"`. This is safe (fail-closed).

2. **`buildResultFromSession` status mapping** — Task 5 changes when the status is set. Must ensure the promise chain still resolves with correct `TaskResult.status`. Test carefully.

3. **Notification routing uses `s.persistent`** — Must be updated in Task 2 to `s.autoClose === "never"` or else notifications won't route to the interface agent after Task 3 removes `persistent`.

4. **No test file for `manager.ts`** — The existing tests are for `rolling-compaction` and `cron`. Integration tests for manager behavior may need to be added in Tasks 4–6. If full manager tests are too heavy, verify manually via `may.ts` startup.
