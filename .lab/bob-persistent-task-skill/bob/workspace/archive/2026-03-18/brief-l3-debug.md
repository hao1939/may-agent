# Brief: Add Temporary Debug Logging to L3 Delegation

**Problem**: I cannot see `console.error` output from the main process. I need to verify *if* `logDelegation` is being called and *where* it thinks it's writing.

**Goal**: Make `logDelegation` in `src/lib/manager.ts` write to `/tmp/debug-delegation.log` on failure (or success).

## Task
Modify `src/lib/manager.ts` inside `logDelegation`:
1. Use `fs.appendFileSync("/tmp/debug-delegation.log", ...)` to log:
    - `logPath` (where it thinks persistDir is).
    - `success` or `error` message.
    - `timestamp`.
2. Do this *inside* the existing try/catch block (so it logs errors too).

**Example**:
```typescript
try {
  const logPath = join(this.registry.persistDir, "delegations.jsonl");
  appendFileSync(logPath, JSON.stringify(logEntry) + "\n", "utf-8");
  appendFileSync("/tmp/debug-delegation.log", `[SUCCESS] Wrote to ${logPath}\n`);
} catch (err) {
  appendFileSync("/tmp/debug-delegation.log", `[ERROR] Failed to write to ${logPath}: ${err.message}\n`);
}
```

**Constraint**: This is temporary debug code. We will remove it after verifying.
