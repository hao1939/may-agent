# Design: L3 Delegation Tracking (Cross-Agent Reliability)

**Problem**: We have no visibility into whether inter-agent calls succeed or fail at the *system* level. A Sub-agent might report "Task Complete" but the Main agent might reject the output. This is the **Consensus Hallucination** vector.

**Solution**: Log every `agents.call()` and `agents.send()` event with structured metadata.

## 1. Schema: `.state/delegations.jsonl`

A flat, append-only log.

```json
{
  "timestamp": "ISO8601",
  "traceId": "uuid-v4",
  "sessionId": "s_12345_678",        // The CALLER's session ID (context)
  "parent": "may",                    // The CALLER agent
  "child": "coder",                   // The TARGET agent
  "method": "call",                   // "call" (sync) or "send" (async)
  "status": "success",                // "success", "error", "timeout" (for call) or "sent" (for send)
  "durationMs": 1234,                 // null for "send"
  "error": "Error message if any",    // null if success
  "recovery": false                   // true if this was a retry of a failed call (future)
}
```

## 2. Implementation: `src/lib/manager.ts`

### `logDelegation` (Fix Silent Failure)
Currently `logDelegation` swallows errors. It must:
1. Ensure the directory exists.
2. Log to `console.error` if the write fails (so we see it in logs).

```typescript
  private logDelegation(entry: { ... }): void {
    try {
      // ... (existing logic) ...
      const logPath = join(this.registry.persistDir, "delegations.jsonl");
      appendFileSync(logPath, JSON.stringify(logEntry) + "\n", "utf-8");
    } catch (err) {
      console.error("[Manager] Failed to log delegation:", err); // Fix silent failure
    }
  }
```

### `callAgent` Wrapper
Already implemented but needs review to ensure `parentSessionId` is correctly propagated.

### `agents` Tool
Update `createAgentsTool` to ensure `getCallerSessionId` and `getCallerAgentName` are correctly passed.

## 3. Metrics (Evaluator)
Evaluator will read `delegations.jsonl` to calculate:
- **Integration Success Rate**: (Success Calls / Total Calls) per pair.
- **Drift**: If `May->Coder` success drops below 80%, trigger **Focus Task**.

## 4. Constraint
- **Performance**: Logging must be async or fast. `appendFileSync` is fine for low volume (<10 calls/sec).
- **Privacy**: Do NOT log the *content* of the task/result, only metadata. Content lives in session logs.
