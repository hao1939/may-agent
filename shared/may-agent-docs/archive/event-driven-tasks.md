# Event-Driven System — Implementation Tasks

**Source design:** `agents/shared/event-driven-system-design.md`
**Design review:** `agents/bob/workspace/event-driven-design-review.md` (APPROVED)
**Scope:** Phase 1 + Phase 2 only (code changes)

---

## Task 1: Add `pendingTriggers` and `lastTriggerTime` state + `triggerCooldownMs` to Cron

**What:** Add the three new instance properties that `triggerNow()` will use. No behavioral changes yet — just state.

**Files changed:**
- `run/cron.ts`

**Changes:**
1. Add private field `pendingTriggers = new Set<string>()` — tracks entry names that need re-fire after the current run completes
2. Add private field `lastTriggerTime = new Map<string, number>()` — tracks per-entry last trigger timestamp for debounce
3. Add readonly field `triggerCooldownMs = 60_000` — minimum ms between reactive triggers for same entry (default 60s, per Bob's review Risk 2)

**Where in the file:** Add after the existing `private detachedRunning` field declaration (around line 37), alongside the other state maps.

**Acceptance criteria:**
- [ ] `tsc --noEmit` passes
- [ ] Existing tests still pass (`npx vitest run run/cron.test.ts`)
- [ ] No behavioral change — this is pure state addition

---

## Task 2: Hook pending trigger checks into heartbeat completion callbacks

**What:** After a heartbeat completes (success or failure), check `pendingTriggers` for that entry and re-fire if flagged. This is the "latch" mechanism from Bob's review (Risk 1).

**Files changed:**
- `run/cron.ts` — modify `fireHeartbeat()` method

**Changes:**
In `fireHeartbeat()`, the `.then()` and `.catch()` callbacks on `manager.waitFor()` both call `this.heartbeatRunning.delete(heartbeatKey)`. After that delete, add:

```typescript
// Check latch: re-fire if a trigger arrived while busy
this.checkPendingTrigger(entry);
```

Add a new private method `checkPendingTrigger(entry: CronEntry)`:
```typescript
private checkPendingTrigger(entry: CronEntry): void {
  if (this.pendingTriggers.has(entry.name)) {
    this.pendingTriggers.delete(entry.name);
    const mode = this.resolveMode(entry);
    if (mode === "heartbeat") this.fireHeartbeat(entry);
    else if (mode === "job-handler") this.fireHandler(entry);
    else if (mode === "job-detached") this.fireDetachedJob(entry);
  }
}
```

**Important:** The latch check goes in both the `.then()` (success) and `.catch()` (failure) paths. Both clear `heartbeatRunning`, both should check the latch.

**Acceptance criteria:**
- [ ] `tsc --noEmit` passes
- [ ] Existing tests still pass
- [ ] New behavior: if `pendingTriggers` has an entry name when heartbeat completes, it immediately re-fires (tested in Task 4)

---

## Task 3: Implement `triggerNow(entryName)` public method

**What:** The core reactive trigger method. Looks up the entry, enforces debounce, latches if busy, fires if idle.

**Files changed:**
- `run/cron.ts`

**Changes:**
Add a public method to the `Cron` class:

```typescript
/** Trigger a cron entry immediately. Returns true if fired or latched, false if debounced/unknown. */
triggerNow(entryName: string): boolean {
  const entry = this.entries.find(e => e.name === entryName);
  if (!entry) return false;

  // Debounce: skip if triggered too recently
  const lastTrigger = this.lastTriggerTime.get(entryName) ?? 0;
  if (Date.now() - lastTrigger < this.triggerCooldownMs) return false;
  this.lastTriggerTime.set(entryName, Date.now());

  const mode = this.resolveMode(entry);
  if (mode === "heartbeat") {
    const key = `heartbeat:${entry.agent || "may"}`;
    if (this.heartbeatRunning.has(key)) {
      // Agent busy — latch for re-run after completion (Task 2 handles drain)
      this.pendingTriggers.add(entryName);
      return true;
    }
    this.fireHeartbeat(entry);
  } else if (mode === "job-handler") {
    if (this.handlerRunning.has(entryName)) {
      this.pendingTriggers.add(entryName);
      return true;
    }
    this.fireHandler(entry);
  } else if (mode === "job-detached") {
    this.fireDetachedJob(entry);
  }
  return true;
}
```

**Design notes:**
- Returns `boolean` — callers can check if the trigger was accepted (true) vs debounced/unknown entry (false)
- For handlers: also latch if `handlerRunning` has the entry (extends the latch pattern to JS handlers, not just heartbeats)
- For detached jobs: `fireDetachedJob` already has its own PID-based overlap protection, so no latch needed — it will skip internally if process is alive
- The regular timer is unaffected — `triggerNow` is an *extra* fire

**Acceptance criteria:**
- [ ] `tsc --noEmit` passes
- [ ] Existing tests still pass
- [ ] `triggerNow("unknown-entry")` returns `false`
- [ ] `triggerNow("heartbeat")` on idle agent fires immediately
- [ ] `triggerNow("heartbeat")` on busy agent sets `pendingTriggers` and returns `true`
- [ ] Rapid calls within 60s: first returns `true`, second returns `false` (debounce)

---

## Task 4: Add latch check to handler completion callbacks

**What:** Extend the latch pattern from Task 2 to JS handler completions. When a handler finishes, check `pendingTriggers`.

**Files changed:**
- `run/cron.ts` — modify `fireHandler()` method

**Changes:**
In `fireHandler()`, after `this.handlerRunning.delete(entry.name)` in both the `.then()` and `.catch()` callbacks, add:

```typescript
this.checkPendingTrigger(entry);
```

**Acceptance criteria:**
- [ ] `tsc --noEmit` passes
- [ ] Existing tests still pass
- [ ] If `triggerNow` is called while a handler is running, the handler re-fires after completion

---

## Task 5: Write tests for `triggerNow()`

**What:** Comprehensive test coverage for the new reactive trigger mechanism.

**Files changed:**
- `run/cron.test.ts` — add new `describe("triggerNow()")` block

**Test cases:**

1. **`triggerNow` on unknown entry returns false**
   - Call `triggerNow("nonexistent")` → returns `false`
   - No side effects

2. **`triggerNow` fires idle heartbeat immediately**
   - Create heartbeat entry, start cron
   - Call `triggerNow("heartbeat-test")` — should call `manager.run()` immediately
   - Verify `manager.run` was called with correct agent and message

3. **`triggerNow` latches when heartbeat is busy, re-fires on completion**
   - Create heartbeat entry, start cron
   - Advance timer so heartbeat fires (manager.waitFor never resolves)
   - Call `triggerNow("heartbeat-test")` → returns `true`
   - Resolve the waitFor promise → heartbeat should re-fire (`manager.run` called again)

4. **Debounce prevents rapid re-triggers**
   - Call `triggerNow("heartbeat-test")` → returns `true`
   - Immediately call `triggerNow("heartbeat-test")` again → returns `false`
   - Advance time past 60s, call again → returns `true`

5. **`triggerNow` latches when handler is busy, re-fires on completion**
   - Create job entry with JS handler, start cron
   - Start handler running (never resolves)
   - Call `triggerNow("handler-test")` → returns `true`
   - Resolve handler → should re-fire (handler called again)

6. **`triggerNow` fires idle JS handler immediately**
   - Register handler, call `triggerNow` on its entry
   - Verify handler was called

**Acceptance criteria:**
- [ ] All 6 test cases pass
- [ ] Existing tests unaffected
- [ ] Tests use fake timers for debounce testing (already set up in beforeEach)

---

## Task 6: Add `triggerNow` to `HandlerContext`

**What:** JS handlers need access to `triggerNow()` to fire reactive triggers. Add it to the `HandlerContext` interface and wire it in `loadAgentHandlers()`.

**Files changed:**
- `run/handler-context.ts` — add `triggerNow` to the interface
- `run/agent-loader.ts` — populate it when building the HandlerContext

**Changes to `handler-context.ts`:**
Add to the `HandlerContext` interface:
```typescript
/** Trigger a cron entry immediately (reactive trigger). Returns true if fired/latched. */
triggerNow: (entryName: string) => boolean;
```

**Changes to `agent-loader.ts`:**
In `loadAgentHandlers()`, where the `HandlerContext` is built (around line 290), the `ctx` object needs `triggerNow`. The function already has access to the agent's `cron` instance from `agentCrons`. Add:
```typescript
triggerNow: (entryName: string) => cron.triggerNow(entryName),
```

**Note:** All handlers for a given agent share one Cron instance (stored in `agentCrons`). Since `cron.json` defines entries across all agents (heartbeat-coach, heartbeat-bob, etc. are all in May's cron), a handler calling `ctx.triggerNow("heartbeat-coach")` will route through May's Cron instance — which is the one that owns all these entries. This works correctly.

**Acceptance criteria:**
- [ ] `tsc --noEmit` passes
- [ ] Existing tests still pass
- [ ] Handlers can call `ctx.triggerNow("heartbeat-coach")` at runtime

---

## Task 7: Wire reactive trigger in `evaluate-sessions` handler

**What:** When `evaluate-sessions` finds a bad evaluation score, write a coaching task to Coach's todo.md and trigger the Coach heartbeat.

**Files changed:**
- `agents/may/handlers/evaluate-sessions.ts`

**Changes:**

The `handleEvaluateSessions` function already returns `EvaluateSessionsResult` with `parentsEvaluated`. The factory `create()` needs to:

1. After calling `handleEvaluateSessions()`, inspect evaluation results for bad scores
2. For each bad result, write a coaching item to `agents/coach/workspace/todo.md`
3. Call `ctx.triggerNow("heartbeat-coach")`

**Concrete implementation in the `create()` factory (after the existing `handleEvaluateSessions` call):**

```typescript
// Check for bad evaluations → reactive coaching trigger
if (result.parentsEvaluated.length > 0) {
  const evalDir = join(ctx.persistDir, "evaluations");
  for (const parentId of result.parentsEvaluated) {
    try {
      const evalPath = join(evalDir, `${parentId}.json`);
      if (!existsSync(evalPath)) continue;
      const evalData = JSON.parse(readFileSync(evalPath, "utf-8"));
      if (evalData.overall?.verdict === "needs_improvement") {
        // Write coaching task
        const todoPath = join(ctx.agentsRoot, "coach", "workspace", "todo.md");
        const item = `- Review session ${parentId} (verdict: needs_improvement). ` +
          `Check .state/evaluations/${parentId}.json for details. ` +
          `Identify which agent needs coaching and run a targeted exercise.\n`;
        appendToTodoSection(todoPath, item);
        ctx.triggerNow("heartbeat-coach");
        ctx.log(`[evaluate-sessions] Bad score for ${parentId} → triggered coach heartbeat`);
      }
    } catch (err) {
      ctx.log(`[evaluate-sessions] Failed to check eval for ${parentId}: ${err}`);
    }
  }
}
```

Add a small helper `appendToTodoSection(path, item)` that appends to the `# TODO` section (creates file with header if missing).

**Acceptance criteria:**
- [ ] `tsc --noEmit` passes
- [ ] When an evaluation has `verdict: "needs_improvement"`, a line is appended to `agents/coach/workspace/todo.md`
- [ ] `ctx.triggerNow("heartbeat-coach")` is called
- [ ] When all evaluations are "good" or "acceptable", no trigger fires
- [ ] Existing evaluate-sessions behavior unchanged for the evaluation logic itself

---

## Task 8: Wire reactive trigger in `system-status` handler

**What:** When `system-status` detects anomalies, write them to May's todo.md and trigger May's heartbeat.

**Files changed:**
- `agents/may/handlers/system-status.ts`

**Changes:**

The `create()` factory calls `handleSystemStatus()` which runs `runSystemStatus()` internally. The result is logged but not returned to the factory. We need the anomalies list back in `create()`.

**Option A (preferred — minimal change):** Modify `create()` to call `runSystemStatus()` + `formatStatusReport()` + write the report itself (instead of `handleSystemStatus()`), then inspect `result.anomalies`.

**Option B:** Change `handleSystemStatus()` to return the `SystemStatusResult`.

Go with **Option A** — it's more transparent:

```typescript
export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const healthLogPath = join(ctx.agentsRoot, ctx.agentName, "workspace", "health-log.md");
  return async () => {
    const result = runSystemStatus({
      persistDir: ctx.persistDir,
      projectRoot: ctx.projectRoot,
      agentsRoot: ctx.agentsRoot,
      healthLogPath,
    });
    const report = formatStatusReport(result);
    // Write report (same as handleSystemStatus did)
    mkdirSync(dirname(healthLogPath), { recursive: true });
    if (!existsSync(healthLogPath) || !readFileSync(healthLogPath, "utf-8").includes("# Health Log")) {
      appendFileSync(healthLogPath, "# Health Log\n\n");
    }
    appendFileSync(healthLogPath, report + "\n\n");
    ctx.log(`[cron:system-status] Health check completed — see health-log.md`);

    // Reactive trigger: anomalies → write to May's todo + trigger heartbeat
    if (result.anomalies.length > 0) {
      const todoPath = join(ctx.agentsRoot, "may", "workspace", "todo.md");
      const item = `- [system-status] ${result.anomalies.length} anomaly(ies) detected: ` +
        result.anomalies.map(a => a.slice(0, 80)).join("; ").slice(0, 300) + `\n`;
      appendToTodoSection(todoPath, item);
      ctx.triggerNow("heartbeat");
      ctx.log(`[system-status] ${result.anomalies.length} anomalies → triggered May heartbeat`);
    }
  };
};
```

**Note:** Import `mkdirSync`, `dirname`, `appendFileSync` — most are already imported; add `dirname` from `node:path` if missing.

Reuse or import the same `appendToTodoSection` helper from Task 7 (consider extracting it to a shared utility, or just inline it — it's ~10 lines).

**Acceptance criteria:**
- [ ] `tsc --noEmit` passes
- [ ] When anomalies are detected, a summary line is appended to `agents/may/workspace/todo.md`
- [ ] `ctx.triggerNow("heartbeat")` is called (this is May's heartbeat entry)
- [ ] When no anomalies, no trigger fires and no todo item written
- [ ] Health log writing still works identically

---

## Task 9: Extract `appendToTodoSection` utility

**What:** Both Task 7 and Task 8 need to append items to a `# TODO` section in a markdown file. Extract this to a shared utility to avoid duplication.

**Files changed:**
- Create `run/todo-utils.ts` (new file)
- `agents/may/handlers/evaluate-sessions.ts` — import from utility
- `agents/may/handlers/system-status.ts` — import from utility

**Implementation:**
```typescript
// run/todo-utils.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Append an item to the # TODO section of a markdown file.
 * Creates the file with a # TODO header if it doesn't exist.
 * If the file exists but has no # TODO section, prepends one.
 */
export function appendToTodoSection(todoPath: string, item: string): void {
  mkdirSync(dirname(todoPath), { recursive: true });

  if (!existsSync(todoPath)) {
    writeFileSync(todoPath, `# TODO\n\n${item}\n`);
    return;
  }

  let content = readFileSync(todoPath, "utf-8");
  const todoIdx = content.indexOf("# TODO");
  if (todoIdx === -1) {
    // No TODO section — prepend one
    content = `# TODO\n\n${item}\n\n${content}`;
  } else {
    // Find end of "# TODO" line, insert item after it
    const lineEnd = content.indexOf("\n", todoIdx);
    const insertAt = lineEnd === -1 ? content.length : lineEnd + 1;
    content = content.slice(0, insertAt) + "\n" + item + content.slice(insertAt);
  }
  writeFileSync(todoPath, content);
}
```

**Acceptance criteria:**
- [ ] `tsc --noEmit` passes
- [ ] Creates file with `# TODO` header if missing
- [ ] Appends under existing `# TODO` section if present
- [ ] Does not corrupt other sections (# Tracking, etc.)

---

## Execution Order

Tasks have dependencies:

```
Task 1 (state fields)
  └→ Task 2 (latch in heartbeat callbacks)
  └→ Task 3 (triggerNow method)
       └→ Task 4 (latch in handler callbacks)
       └→ Task 5 (tests for triggerNow)
       └→ Task 6 (HandlerContext wiring)
            └→ Task 9 (todo utility — no deps, can go earlier)
            └→ Task 7 (evaluate-sessions reactive trigger)
            └→ Task 8 (system-status reactive trigger)
```

**Recommended order:** 1 → 2 → 3 → 4 → 5 → 6 → 9 → 7 → 8

Each task is independently testable. Run `npx tsc --noEmit && npx vitest run run/cron.test.ts` after each.

---

## What's NOT in scope

- **Phase 3 (lean heartbeats):** Documentation-only, driven by Bob after Phase 1-2 are working
- **Phase 4 (pattern → workflow):** Ongoing, not a code task
- **`handleCompletion` error trigger:** Listed in the design but requires changes to notification/drain infrastructure — defer to a follow-up
- **`drain-todo` → `triggerNow`:** The drain-todo handler could trigger agent heartbeats after writing tasks, but this is a follow-up optimization
