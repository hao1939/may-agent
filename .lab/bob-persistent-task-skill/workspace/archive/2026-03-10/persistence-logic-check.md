# Session Simplification: Verification of Persistence Logic

## 1. `run(name: string, ...)`
```typescript
persistent: this.isInterfaceAgent(name),
```
✅ Correct. If `name` is the interface agent (May), it persists. If not (Coder/Cron), it doesn't.

## 2. `resumeAgent(agentName: string, ...)`
```typescript
persistent: this.isInterfaceAgent(agentName),
```
✅ Correct. Resumed sessions respect the flag.

## 3. `handleCompletion(session: ActiveSession)`
```typescript
if (session.persistent) {
  // Idle, followUp, etc.
} else {
  // Archive, remove, die.
}
```
✅ Correct. Non-persistent sessions are cleaned up.

## 4. `drainUndeliveredNotifications()`
```typescript
if (s.agentName === parentAgent && s.persistent) {
```
✅ Correct. Only persistent sessions (Chat) can receive async notifications.

## Conclusion
The binary model "Chat + Task" is enforced. Sub-agents are now ephemeral task workers.
