# M2: Provider Circuit Breaker — Implementation

## Problem
When an LLM provider has an outage or rate-limits an agent, the system wastes compute retrying the same failing agent every heartbeat cycle (every 30 min). With 7 agents, a provider issue causes 14+ wasted sessions/hour.

## Solution

### New file: `agents/shared/workflows/circuit-breaker.ts`

A stateless (JSON file-backed) circuit breaker that:

1. **Tracks consecutive errors** per agent in `agents/shared/circuit-breaker-state.json`
2. **Trips after 3 consecutive errors** — blocks the agent from running LLM sessions
3. **Auto-generates SIGNAL file** at `agents/<name>/SIGNAL-circuit-breaker.md` with:
   - What happened (error count, timestamps)
   - How to re-enable (delete the file)
4. **Auto-resets on success** — if an agent succeeds, counter goes to 0
5. **Manual re-enable** — delete the SIGNAL file OR call `resetCircuitBreaker()`

### Integration points

#### Heartbeat (`heartbeat-data.ts`)
- **Before `runAgent()`**: `checkCircuitBreaker()` — skips entire heartbeat if breaker is open
- **After `runAgent()`**: `recordOutcome()` — tracks success/failure

### API

```typescript
// Check if agent can run (returns null = OK, string = blocked reason)
checkCircuitBreaker(agentsRoot: string, agent: string): string | null

// Record session outcome (updates counter, trips/resets breaker)
recordOutcome(agentsRoot: string, agent: string, isError: boolean, errorDetail?: string): void

// Manually reset an agent's breaker
resetCircuitBreaker(agentsRoot: string, agent: string): void
```

## Files Modified
- `agents/shared/workflows/circuit-breaker.ts` — **NEW** — Core circuit breaker logic
- `agents/shared/workflows/heartbeat-data.ts` — Added import + check before `runAgent()` + record after

## Expected Impact
- During provider outages: saves 7-14 sessions/hour (all affected agents auto-disabled after 3 failures)
- Normal operation: zero overhead (just a JSON file read per heartbeat)
- Recovery: automatic on success or manual SIGNAL file deletion
