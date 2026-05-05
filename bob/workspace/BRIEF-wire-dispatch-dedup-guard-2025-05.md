# BRIEF: Wire Dispatch Dedup Guard into Project Iteration Dispatch

## Date: 2025-05-05
## Status: READY TO IMPLEMENT
## Parent: EXP-860 Layer 3

## Current State

| Integration Point | Status | Location |
|---|---|---|
| Heartbeat dispatch | ✅ Wired | `heartbeat-data.ts:394-397` |
| Project iteration (`runMasterWorker`) | ❌ Not wired | `master-worker-unified.ts` |
| Direct `agents.fork()` calls | ❌ Agent-level (skill) | N/A — agent discretion |

## What's Done

- `dispatch-dedup-guard.ts` — fully implemented, 9/9 tests pass
- Heartbeat integration — guards heartbeat sessions via `shouldDispatch(agent, "heartbeat")`
- Tests at `dispatch-dedup-guard.test.ts` — all passing

## What Remains: Project Iteration Guard

### Option A: Add dedup config to `MasterWorkerConfig` (recommended)

Add an optional `dedup` field to `MasterWorkerConfig`:

```typescript
// In master-worker-unified.ts
import { shouldDispatch, recordDispatch, recordOutcome } from "./dispatch-dedup-guard.js";

export interface DedupConfig {
  enabled: boolean;
  agent: string;        // which agent is running
  taskLabel?: string;    // override task prefix (default: projectDir basename)
}

export interface MasterWorkerConfig {
  // ...existing fields...
  dedup?: DedupConfig;
}
```

In `runMasterWorker()`, before the iteration loop:

```typescript
if (config.dedup?.enabled) {
  const label = config.dedup.taskLabel ?? config.projectDir;
  const check = shouldDispatch(config.dedup.agent, `project:${label}`);
  if (!check.allowed) {
    return { iterations: 0, stopped: true, stopReason: `dedup-blocked: ${check.reason}` };
  }
  recordDispatch(config.dedup.agent, `project:${label}`);
}
```

After the loop completes, record outcome:

```typescript
if (config.dedup?.enabled) {
  const label = config.dedup.taskLabel ?? config.projectDir;
  const status = result.stopReason.includes("error") ? "error" : "success";
  recordOutcome(config.dedup.agent, `project:${label}`, status);
}
```

### Option B: Wrapper function (lighter touch)

```typescript
export function withDedupGuard(
  agent: string,
  taskLabel: string,
  runFn: () => Promise<RunResult>
): Promise<RunResult> {
  const check = shouldDispatch(agent, taskLabel);
  if (!check.allowed) {
    return Promise.resolve({ iterations: 0, stopped: true, stopReason: `dedup-blocked: ${check.reason}` });
  }
  recordDispatch(agent, taskLabel);
  return runFn().then(result => {
    const status = result.stopReason.includes("error") ? "error" : "success";
    recordOutcome(agent, taskLabel, status);
    return result;
  });
}
```

## Impact

Based on April data: project iteration zombies were ~30% of total zombies. Heartbeat guard (already live) covers the other ~70%. This would close the remaining gap.

## Who Should Implement

Tech-lead or architect — this touches shared infrastructure. Bob can PR the code; wiring into callers requires knowing which agents use `runMasterWorker` in production handlers.
