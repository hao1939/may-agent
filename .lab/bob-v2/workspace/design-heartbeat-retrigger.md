# Design: Heartbeat Re-trigger Mechanism

## Context
Agents are currently idle 73-99% of the time because cron heartbeats fire on fixed intervals (e.g., every 10 minutes). If an agent finishes a task in 1 minute, it sits idle for 9 minutes even if it has more work in its `todo.md`.

## Goal
Implement a "Post-Heartbeat Re-trigger" mechanism that immediately re-fires the agent if:
1. The heartbeat session completes successfully.
2. The agent has remaining work in `todo.md`.
3. The re-trigger limit (default 3) has not been reached.

## Design

### 1. The Trigger Signal
We will use the **filesystem as truth**.
- **Signal**: Existence of unchecked tasks (`- [ ]`) in `agents/[agent]/workspace/todo.md`.
- **Why**: This is the canonical source of truth for agent work. It requires no special output formatting from the agent and works even if the agent crashes or forgets to explicitly signal "more work".

### 2. The Mechanism (in `src/app/cron.ts`)
We will modify the `Cron` class to track consecutive re-triggers and check for work after heartbeat completion.

**New State:**
- `retriggerCounts: Map<string, number>` — tracks consecutive re-triggers per entry.
- `MAX_RETRIGGERS = 3` — prevents infinite loops if an agent fails to clear a task.

**Logic Flow (in `fireHeartbeat` completion):**
1. Session finishes.
2. Clear `heartbeatRunning` flag.
3. Check `pendingTriggers` (latch). If a trigger arrived while busy, fire immediately (standard behavior).
4. If **no** pending trigger fired:
   a. Read `agents/[agent]/workspace/todo.md`.
   b. If it contains `- [ ]` (unchecked tasks):
      - Check `retriggerCount < MAX_RETRIGGERS`.
      - If yes: Increment count, log "Re-triggering", and call `triggerNow(entry.name, { force: true })`.
      - If no: Reset count, log "Max re-triggers reached", wait for next interval.
   c. If no tasks: Reset `retriggerCount`.

### 3. Changes Required

#### A. Update `src/app/cron.ts`
1. **Imports**: Add `readFileSync`, `resolve`, `join`, `existsSync`.
2. **Properties**: Add `private retriggerCounts = new Map<string, number>();`.
3. **`triggerNow`**: Add `force` option to bypass cooldown.
4. **`fireHeartbeat`**:
   - In the `.then()` block (success path):
     - Implement the re-trigger logic.
   - In the `.catch()` block (failure path):
     - Reset `retriggerCount` (don't fast-loop on failures).
5. **Helper**: Add `private hasRemainingWork(agentName: string): boolean`.

## Implementation Plan

### `src/app/cron.ts`

```typescript
// ... imports

export class Cron {
  // ... existing props
  private retriggerCounts = new Map<string, number>();
  readonly maxRetriggers = 3;

  // ...

  // Update signature to accept options
  triggerNow(entryName: string, opts?: { force?: boolean }): boolean {
    const entry = this.entries.find((e) => e.name === entryName);
    if (!entry) return false;

    // Debounce: skip if triggered too recently (unless forced)
    const lastTrigger = this.lastTriggerTime.get(entryName) ?? 0;
    if (!opts?.force && Date.now() - lastTrigger < this.triggerCooldownMs) return false;
    this.lastTriggerTime.set(entryName, Date.now());

    // ... existing logic ...
  }

  // ...

  private fireHeartbeat(entry: CronEntry): void {
    // ... setup ...

    this.manager.waitFor(sessionId)
      .then((taskResult) => {
        this.heartbeatRunning.delete(heartbeatKey);

        // 1. Check latch (external triggers while busy)
        this.checkPendingTrigger(entry);
        
        // 2. If not already running again, check for internal re-trigger
        if (!this.heartbeatRunning.has(heartbeatKey)) {
          this.checkRetrigger(entry);
        }

        this.appendJobResult({ ... });
        // ... notify ...
      })
      .catch((err) => {
        // Failure: reset count (safety)
        this.retriggerCounts.set(entry.name, 0);
        // ... existing error handling ...
      });
  }

  private checkRetrigger(entry: CronEntry): void {
    const agentName = entry.agent || "may";
    const count = this.retriggerCounts.get(entry.name) ?? 0;

    if (this.hasRemainingWork(agentName)) {
      if (count < this.maxRetriggers) {
        this.retriggerCounts.set(entry.name, count + 1);
        // Using console.log or bus.emit if available, strictly logging to internal system for now
        // Call triggerNow with force: true to bypass debounce
        this.triggerNow(entry.name, { force: true });
      } else {
        this.retriggerCounts.set(entry.name, 0); // Reset after max reached
      }
    } else {
      this.retriggerCounts.set(entry.name, 0); // Reset if no work
    }
  }

  private hasRemainingWork(agentName: string): boolean {
    try {
      // Robust path resolution
      const todoPath = resolve(this.projectRoot, "agents", agentName, "workspace", "todo.md");
      if (!existsSync(todoPath)) return false;
      const content = readFileSync(todoPath, "utf-8");
      // Check for unchecked markdown checkboxes: "- [ ]"
      return content.includes("- [ ]");
    } catch {
      return false;
    }
  }
}
```

### Verification
1. **Mock Test**: Create a dummy `todo.md` with tasks.
2. **Trigger**: Fire heartbeat.
3. **Expectation**: Agent runs -> finishes -> re-fires immediately -> runs again -> finishes -> ... (up to 3 times).

This design follows **P1 Simplest Thing That Works** (uses file system state, minimal logic) and **P31 Adhoc vs Periodic** (drains the queue).
