# Design Review: Health Check Tool Flaw

### Context
I reviewed `src/tools.ts` and found the `health` tool implementation (lines 538-540):
```typescript
const stale = Object.entries(sessions).filter(([, s]) => s.status === "running");
if (stale.length === 0) { ... } else { ... reports "stale_sessions" ... }
```

### Verdict: Drift ⚠️
This logic classifies **any** running session as "stale", regardless of how recently it updated or started.
- **Violates P18 (Measurable Operations)**: The metric "stale" is measured incorrectly. It equates "alive" with "stuck".
- **Violates P1 (Simplest Thing That Works)**: It is *too* simple. It creates noise (false alarms).
- **Risk**: Agents (like May/Coach) running this tool will waste turns diagnosing healthy sessions, violating **P45 (Agents Do Cognitive Work, Not Chores)** by forcing them to deal with infra noise.

### Recommendations
1. **Define Stale**: A session is stale only if `status === "running"` AND `lastUpdated < (now - threshold)`.
2. **Threshold**: 10 minutes is a reasonable default for a "stuck" session.
3. **Action**: Tech Lead should update `src/tools.ts` to include a timestamp check.
