# Design: `--chat` Flag & Explicit Chat Session

**Status**: Proposed  
**Author**: May (with Hao)  
**Date**: 2025-03-07

## Problem

The current `--keep-session` flag conflates too many concerns, and `setInterfaceAgent()` silently changes `run()` behavior for all sessions of that agent — including heartbeat sessions that should be ephemeral.

### Specific bugs/issues:

1. **Heartbeat-May sessions get `autoClose: "never"`** because `isInterfaceAgent("may")` returns true for ALL `run("may", ...)` calls. These sessions go idle instead of being archived.

2. **`--keep-session` is misleading** — it doesn't mean "keep the session file," it means "persistent interactive chat session with resume, compaction, stdin loop, and idle behavior."

3. **No headless cron-only mode** — `--cron` alone crashes because the code requires either `--keep-session` or `--task`.

4. **`setInterfaceAgent()` is a hidden global** — it changes `run()` behavior based on agent name, not session intent. The manager shouldn't need to know which agent is "special."

## Design

### New flag: `--chat`

Replaces `--keep-session`. Means: "this process has one persistent human-facing chat session."

```
tsx run/launcher.ts --chat --cron --telegram --console
```

### Manager changes

**Remove**: `setInterfaceAgent()`, `isInterfaceAgent()`, `interfaceAgentName`

**Add**: `chatSessionId` — a specific session ID, not an agent name.

```typescript
// Before:
manager.setInterfaceAgent("may")        // stores agent name globally
sid = manager.run("may", task, opts)    // secretly gets autoClose:"never"

// After:
sid = manager.createChatSession("may", { compaction: ... })
// Internally: run("may", task, { autoClose: "never", ... })
// Stores this.chatSessionId = sid

// Resume variant:
sid = manager.resumeChatSession("may", { compaction: ... })
```

**`run()` always creates task sessions** — no `isInterfaceAgent` check:
```typescript
run(name, task, opts?) {
  // autoClose defaults to "immediate" always
  // opts.autoClose can override, but callers shouldn't need to
  autoClose: opts?.autoClose ?? "immediate",
}
```

### Chat session identification

Places that currently check `autoClose === "never"` as proxy for "is chat session" should check `session.sessionId === this.chatSessionId`:

| Location | Currently | After |
|----------|-----------|-------|
| `handleCompletion()` — idle vs archive | `autoClose === "never"` | `autoClose === "never"` (still works — only chat session has it) |
| `compactIdleSession()` | `autoClose !== "never"` | same |
| `followUp()` — reject task session wake | `autoClose !== "never"` | same |
| Notification routing — find interface session | `s.autoClose === "never"` | `s.sessionId === this.chatSessionId` |

Note: `autoClose: "never"` remains a valid field on `ActiveSession`. The change is that only `createChatSession()` sets it — `run()` never does implicitly.

### Flag compatibility

```
--chat  --task  --cron  Result
──────────────────────────────────────────
  ✓       -       ✓     Interactive with cron (current default)
  ✓       -       -     Chat-only, no background jobs
  -       ✓       -     Run task, exit (detached worker)
  -       -       ✓     Headless cron-only (NEW — currently crashes)
  ✓       ✓       -     ERROR: incompatible
  -       -       -     ERROR: nothing to do
```

### I/O flags (unchanged, orthogonal)

- `--console` — pretty terminal output
- `--telegram` — Telegram bot I/O channel
- `--socket` — Unix socket for IPC/steer
- `--agent X` — which agent (default: "may")

These are I/O channels. They work with both `--chat` and `--task` modes (though stdin input only makes sense with `--chat`).

## Changes Required

### 1. `run/may.ts`

```diff
- const KEEP_SESSION = process.argv.includes("--keep-session");
+ const CHAT_MODE = process.argv.includes("--chat");

- if (!KEEP_SESSION && !INITIAL_TASK) {
-   console.error("Error: ephemeral mode requires --task. Use --keep-session for interactive mode.");
+ if (!CHAT_MODE && !INITIAL_TASK && !CRON_ENABLED) {
+   console.error("Error: need --chat, --task, or --cron.");
    process.exit(1);
  }

- manager.setInterfaceAgent(interfaceAgent);
  // (removed — no longer needed)

- if (!KEEP_SESSION) {
+ if (INITIAL_TASK && !CHAT_MODE) {
    // Task mode: run and exit
    sid = manager.run(interfaceAgent, initialTask, { ... });
    await manager.waitForIdle(sid);
+ } else if (CHAT_MODE) {
    // Chat mode: resume or create chat session
-   const resumed = manager.resumeAgent(interfaceAgent, opts);
+   try {
+     sid = manager.resumeChatSession(interfaceAgent, opts);
+   } catch {
+     sid = manager.createChatSession(interfaceAgent, "Ready. Waiting for tasks.", opts);
+   }
    await manager.waitForIdle(sid);
+ } else {
+   // Cron-only: no session, just tick
  }
```

### 2. `src/manager.ts`

```diff
- private interfaceAgentName?: string;
+ private chatSessionId?: string;

- setInterfaceAgent(name: string): void {
-   this.interfaceAgentName = name;
- }
-
- private isInterfaceAgent(name: string): boolean {
-   return name === this.interfaceAgentName;
- }

+ createChatSession(agentName: string, task: string, opts?: RunOptions): string {
+   if (this.chatSessionId) throw new Error("Chat session already exists");
+   const sid = this.run(agentName, task, { ...opts, autoClose: "never" });
+   this.chatSessionId = sid;
+   return sid;
+ }
+
+ resumeChatSession(agentName: string, opts?: { compaction?: ... }): string {
+   // Same as current resumeAgent(), stores chatSessionId
+   const result = this.resumeAgent(agentName, { ...opts, autoClose: "never" });
+   this.chatSessionId = result.resumed.sessionId;
+   return result.resumed.sessionId;
+ }
+
+ getChatSessionId(): string | undefined {
+   return this.chatSessionId;
+ }

  // In run():
  run(name: string, task: string, opts?: RunOptions): string {
    ...
-   autoClose: opts?.autoClose ?? (this.isInterfaceAgent(name) ? "never" : "immediate"),
+   autoClose: opts?.autoClose ?? "immediate",
    ...
  }
```

### 3. Notification routing (in `handleCompletion`)

```diff
  // Find interface session for parent agent
- for (const [sid, s] of this.activeSessions) {
-   if (s.agentName === session.parentAgentName && s.autoClose === "never") {
-     interfaceSid = sid;
+ if (this.chatSessionId && this.activeSessions.has(this.chatSessionId)) {
+   interfaceSid = this.chatSessionId;
```

### 4. `src/detached.ts`

No changes — detached processes use `--task`, never `--chat`.

### 5. Backward compatibility

- `--keep-session` should be kept as alias for `--chat` during transition
- Or just rename in one shot (only used in launcher.ts and may.sh)

## Impact

- **Heartbeat bug fixed**: `run("may", heartbeatMsg)` → `autoClose: "immediate"` → archived on completion
- **Cron-only mode enabled**: `--cron` without `--chat` or `--task` just ticks
- **Clearer mental model**: chat session = explicit, everything else = task
- **Smaller API surface**: no `setInterfaceAgent()`, no hidden name-based behavior

## Migration

1. Implement `createChatSession()` / `resumeChatSession()` on manager
2. Remove `setInterfaceAgent()` / `isInterfaceAgent()`
3. Rename `--keep-session` → `--chat` in may.ts
4. Update launcher.ts default args
5. Update may.sh if it exists
6. Run tests
