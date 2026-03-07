# Review: Chat Flag & Explicit Chat Session

## Status
**APPROVED WITH MODIFICATIONS**

The proposal correctly identifies a critical design flaw: coupling "interface agent" status to the agent *name* rather than the session *intent*. This causes side effects where heartbeat sessions (which should be ephemeral) become zombie processes because they happen to run as "may".

## 1. Flag Design & Modes
The `--chat` flag is semantically correct. It separates the *execution mode* (interactive chat) from the *agent identity* (may/bob/etc).

- **Current**: `process.argv.includes("--keep-session")` → creates implicit persistent session
- **Proposed**: `process.argv.includes("--chat")` → explicitly calls `createChatSession`

This aligns with our "Explicit > Implicit" philosophy.

## 2. Manager Changes & Edge Cases

### A. Race Conditions in `chatSessionId`
The proposal adds `this.chatSessionId` as a single string.
```typescript
createChatSession(agentName, ...) {
  if (this.chatSessionId) throw new Error("Chat session already exists");
  ...
}
```
**Risk**: If the manager restarts (process crash), it rehydrates from disk. Does it know which existing session was the chat session?
- **Fix Required**: On startup, `manager` needs to know if it should *resume* an existing chat session or start fresh. The `chatSessionId` needs to be durable or re-discoverable.
- **Recommendation**: The proposal handles this in `may.ts` (the caller) via `resumeChatSession`. The manager doesn't need to persist `chatSessionId` to disk, as long as `may.ts` calls `resumeChatSession` on boot. This seems correct.

### B. Notification Routing
The change to notification routing is critical:
```typescript
// Before
if (s.agentName === session.parentAgentName && s.autoClose === "never")
// After
if (this.chatSessionId && this.activeSessions.has(this.chatSessionId))
```
**Edge Case**: What if the user runs `may` as a task (CLI tool), and that task spawns sub-agents?
- The sub-agents complete.
- The parent `may` session is a *task session* (not chat).
- Who gets the notification?
- **Current Design**: The parent *should* get the notification if it's still running.
- **Proposed Code**: It only notifies `this.chatSessionId`.
- **Correction**: Notification routing should check:
  1. Is the parent session still active? (Use `parentSessionId`)
  2. If yes, notify it directly.
  3. If no, is there a chat session acting as a fallback receiver?
  The proposal implies notifications *only* go to the chat session. This breaks deep task chains where an intermediate agent needs to know its child finished.

**Recommendation**: Keep the routing logic general.
```typescript
// Notify parent session directly if active
if (session.parentSessionId && this.activeSessions.has(session.parentSessionId)) {
  // notify parent
}
// Fallback: Notify interface/chat session if parent is gone?
// Actually, standard behavior is: notifications go to parent.
// The "interface agent" logic was a hack because we lost track of parent IDs across restarts.
```
If we fix the session ID tracking, we don't need "interface agent" routing at all. But for now, routing to `chatSessionId` is a safe fallback for "user-facing updates".

## 3. Migration Path
The migration plan is clean but misses one detail: **existing valid sessions**.
If I have a running session `s_123` (my main chat) and I upgrade the code:
1. `may.ts` starts with `--chat`.
2. It calls `resumeChatSession("may")`.
3. `manager` looks for latest "may" session.
4. It finds `s_123`.
5. It sets `this.chatSessionId = "s_123"`.
6. **Success**.

The migration seems non-destructive.

## 4. `resumeAgent` vs `resumeChatSession`
The proposal keeps `resumeAgent`.
- `resumeChatSession`: Resumes the *most recent* session for that agent and marks it as the chat session (`autoClose: "never"`).
- `resumeAgent`: Resumes a specific session? Or most recent?

Currently `resumeAgent` resumes the most recent session.
**Confusion Risk**: If I call `resumeAgent("may")`, does it become a chat session?
**Proposal**: `resumeChatSession` should internally call `resumeAgent` but enforce the `autoClose: "never"` override.
The proposal implementation does exactly this:
```typescript
resumeChatSession(...) {
  const result = this.resumeAgent(..., { autoClose: "never" });
  this.chatSessionId = result.resumed.sessionId;
}
```
This is correct.

## 5. Simpler Alternatives?
Could we just pass `autoClose: "never"` to `run()`?
- Yes, but we still need to know *which* session is the "interface" for UI routing (stdio, telegram).
- The `chatSessionId` property on Manager is useful for "who owns the console?".

## Verdict & Modifications

**Approved**, with one correction on Notification Routing.

### Required Fix: Notification Logic
Do not strictly replace the logic with *only* `chatSessionId`.
Preserve the ability for a parent task session to receive notifications from its children.

```typescript
// Proposed fix for handleCompletion / notifyParent
let targetSid = session.parentSessionId;

// If parent is not active, fall back to chat session (if it's the conceptual parent)
if (!targetSid || !this.activeSessions.has(targetSid)) {
  if (session.parentAgentName === this.activeSessions.get(this.chatSessionId)?.agentName) {
    targetSid = this.chatSessionId;
  }
}
```
Actually, the simplest reliable rule is: **Notifications go to `parentSessionId`**.
If the parent is dead/archived, the notification is dropped (or logged).
The "interface agent" hack was specifically because the interface agent *is* the parent of top-level tasks.
So:
- If `session.parentSessionId` exists → notify that ID.
- If `session.parentSessionId` is missing (top level) → no notification needed (user sees output).

The only special case is: **Cross-process notifications**.
If the parent is in another process, we need to know that.
The proposal's focus on `chatSessionId` simplifies this: "The chat session is the one that stays alive."

**Correction**:
Ensure `createChatSession` sets `autoClose: "never"`.
Ensure `run` sets `autoClose: "immediate"` (default).

This solves the original bug (heartbeat sessions staying alive).

## Next Steps
1. Apply the changes to `src/manager.ts`.
2. Update `run/may.ts`.
3. Verify `heartbeat` tasks now auto-close.
