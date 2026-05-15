# Phase 1 Prototype: Guard Redirect via steer()

**Status**: ✅ IMPLEMENTED  
**Branch**: `review/guard-redirect-phase1`  
**Commit**: `4ad2d9f`

This is the minimal implementation — extends BeforeToolCallResult with a `redirect` field, 
and adds steer() injection in wrapToolsWithReceipts when a guard requests a redirect.

## What Was Implemented

### 1. `src/lib/tools/compose-guards.ts` — Extended BeforeToolCallResult

Added `redirect` and `steer` optional fields to the interface.

### 2. `src/lib/manager-receipts.ts` — Handle redirect + steer in wrapToolsWithReceipts

- On `block + redirect`: calls `agent.steer()` with structured workflow guidance
- On non-blocking `steer`: injects steering message without blocking the tool

### 3. `src/lib/tools/finish-guard.ts` — FM-3.3 redirects to verify-wrap

When finish-guard detects writes without verification, it now returns a redirect to `verify-wrap`.

### 4. `test/guard-redirect.test.ts` — 4 tests

- Guard redirect on block calls steer()
- Guard block without redirect does NOT call steer()
- Non-blocking steer injects message
- Backward compatibility: undefined guard result → no steer

## Test Results

- All 4 new tests pass
- All 56 finish-guard tests pass
- All 7 manager-receipts tests pass
- Full suite: 1885/1886 pass (1 pre-existing failure in research-db.test.ts)

## Changes Required

### 1. `src/lib/tools/compose-guards.ts` — Extend BeforeToolCallResult

```typescript
export interface BeforeToolCallResult {
  block: boolean;
  reason: string;
  // NEW: optional redirect to a workflow
  redirect?: { workflow: string; task: string };
  // NEW: optional steering message (injected after turn, non-blocking)
  steer?: string;
}
```

### 2. `src/lib/manager-receipts.ts` — Handle redirect in wrapToolsWithReceipts

In the `if (guardResult?.block)` block, after the existing blocked-call handling:

```typescript
if (guardResult?.block) {
  // Existing: return blocked text...
  
  // NEW: if guard also requested a redirect, inject a steering message
  //       so the agent knows what to do next
  if (guardResult.redirect) {
    const redirectSession = getSession();
    if (redirectSession?.agent) {
      redirectSession.agent.steer({
        role: "user",
        content: [{ type: "text", text:
          `🔄 **Guard redirect**: The "${guardResult.redirect.workflow}" workflow is recommended.\n\n` +
          `Reason: ${guardResult.reason}\n\n` +
          `Run: \`workflow("${guardResult.redirect.workflow}", "${guardResult.redirect.task}")\``
        }],
        timestamp: Date.now(),
        source: "system",
      });
    }
  }
  
  return { content: [...], details: undefined };
}

// NEW: non-blocking steer (guard allowed the call but wants to inject guidance)
if (guardResult?.steer) {
  const steerSession = getSession();
  if (steerSession?.agent) {
    steerSession.agent.steer({
      role: "user",
      content: [{ type: "text", text: guardResult.steer }],
      timestamp: Date.now(),
      source: "system",
    });
  }
}
```

### 3. `src/lib/tools/finish-guard.ts` — Return redirect to verify-wrap

In the block where finish-guard detects no verification:

```typescript
// Instead of:
return { block: true, reason: "No verification evidence..." };

// Return:
return { 
  block: true, 
  reason: "No verification evidence found in session transcript.",
  redirect: { 
    workflow: "verify-wrap", 
    task: "Verify the changes described in the finish summary before completing"
  }
};
```

## Execution Flow

```
Agent: finish({ status: "success", summary: "Fixed bug" })
  
→ finish-guard runs, sees no verification evidence
→ Returns { block: true, reason: "...", redirect: { workflow: "verify-wrap", ... } }
  
→ wrapToolsWithReceipts:
    1. Returns blocked tool_output (agent sees the error)
    2. Calls agent.steer() with redirect guidance
    
→ After current turn completes, agent receives steering message:
    "🔄 Guard redirect: The verify-wrap workflow is recommended.
     Run: workflow("verify-wrap", "Verify the changes...")"
     
→ Agent's next turn: runs the workflow
→ Workflow verifies changes, adds evidence to transcript  
→ Agent calls finish() again — this time with verification evidence
→ finish-guard: allow ✓
```

## Why steer() not just better error text?

1. **steer() arrives as a new user message** — the agent processes it as a fresh instruction, not as an error to rationalize away
2. **steer() arrives AFTER the current turn** — the agent gets a clean start to address the issue
3. **The redirect is structured** — workflow name + task, not prose that the agent might misinterpret
4. **It's additive** — the blocked error text still arrives (backward compatible), the steer is bonus guidance

## Lines of Code Estimate

- compose-guards.ts: +2 lines (new fields on interface)
- manager-receipts.ts: +20 lines (redirect/steer handling)
- finish-guard.ts: +3 lines (redirect field on existing blocks)
- Total: ~25 LoC

## Risk Assessment

- **Low risk**: steer() is explicitly designed for mid-session message injection
- **Low risk**: redirect is purely advisory — agent can ignore it  
- **Low risk**: backward compatible — guards that don't return redirect/steer work identically
- **Medium risk**: steer() timing — need to verify the message arrives between turns, not mid-tool-execution (it should, based on pi-agent-core docs: "injected after the current assistant turn finishes")
