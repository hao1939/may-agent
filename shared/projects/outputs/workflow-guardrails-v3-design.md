# V3 Guardrails Design: Structural Write-First Enforcement

## Overview

V3 moves write-first enforcement from prompt instructions (v1/v2) to **structural interception**: the master-worker system rejects a worker's first tool call unless it is `write()` or `edit()`, when the task requires producing a file.

## Problem Statement

- V1 (prompt-only): ~50% compliance
- V2 (stronger prompts + retry): ~62.5% compliance
- Workers still frequently call `read()` or `bash()` first despite instructions
- Prompt-based enforcement has a ceiling; structural enforcement is needed

## Design: Tool-Call Interceptor

### Concept

After dispatching a task to the worker, the master intercepts the worker's **first tool call**. If the task is tagged as `write-first` and the first tool call is not `write()` or `edit()`, the call is **rejected with an error message** before execution, forcing the worker to retry with a write call.

### Detection Logic

```typescript
function isWriteFirstTask(task: string): boolean {
  const writeFirstPatterns = [
    /\bwrite\b.*\bfile\b/i,
    /\bproduce\b.*\b(report|doc|analysis|file)\b/i,
    /\bcreate\b.*\b(file|document|report)\b/i,
    /\bgenerate\b.*\boutput\b/i,
    /WRITE-FIRST CONSTRAINT/i,
  ];
  return writeFirstPatterns.some(p => p.test(task));
}
```

### Interceptor Logic

```typescript
interface ToolCall {
  name: string;
  parameters: Record<string, unknown>;
}

function enforceWriteFirst(toolCall: ToolCall, isFirstCall: boolean, taskIsWriteFirst: boolean): 
  { allowed: boolean; errorMessage?: string } {
  
  if (!taskIsWriteFirst || !isFirstCall) {
    return { allowed: true };
  }

  const writeTools = ['write', 'edit'];
  if (writeTools.includes(toolCall.name)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    errorMessage: `WRITE-FIRST VIOLATION: Your first tool call must be write() or edit(), not ${toolCall.name}(). ` +
      `Write your deliverable first, then use other tools to refine. Retrying...`
  };
}
```

### Integration Point in master-worker.ts

The current code (lines ~320-360) works as follows:
1. `worker.prompt(workerPrompt)` dispatches the task (line ~322)
2. After completion, `diffSnapshots()` checks if files were produced (line ~327)
3. If zero output, a retry prompt is sent via `worker.prompt(retryPrompt)` (line ~339)
4. After 3 consecutive zero-output iterations, escalation occurs (line ~349)
5. After 6 consecutive, auto-termination (line ~354)

**V3 does NOT change this flow.** Instead, it wraps `worker.prompt()` to intercept tool calls structurally. The worker agent infrastructure (likely in the agent SDK) needs a tool-call hook.

#### Approach A: Pre-prompt injection with system-level tool restriction (Recommended)

If the agent SDK supports tool restrictions per-prompt, restrict the first turn to only `write`/`edit`:

```diff
  // Line ~322, replace:
  await worker.prompt(workerPrompt);
  
  // With:
+ const writeFirstTools = ['write', 'edit'];
+ if (isWriteFirstTask(guidance)) {
+   // First prompt: only allow write/edit tools
+   await worker.prompt(workerPrompt, { allowedTools: writeFirstTools });
+   // Follow-up prompt unlocks all tools
+   await worker.prompt('Good. Now continue with any tools needed to complete the task.');
+ } else {
+   await worker.prompt(workerPrompt);
+ }
```

#### Approach B: Custom tool wrapper (if SDK doesn't support tool restrictions)

Wrap the tool execution layer to reject non-write calls on first invocation:

```typescript
// Add before the work loop:
function createWriteFirstProxy(originalWorker: Worker): Worker {
  let firstCallEnforced = false;
  return new Proxy(originalWorker, {
    get(target, prop) {
      if (prop === 'prompt') {
        return async (prompt: string, opts?: any) => {
          firstCallEnforced = false; // Reset per prompt
          return target.prompt(prompt, {
            ...opts,
            toolCallInterceptor: (call: ToolCall) => {
              if (!firstCallEnforced) {
                firstCallEnforced = true;
                if (!['write', 'edit'].includes(call.name)) {
                  return {
                    reject: true,
                    error: `BLOCKED: First tool call must be write() or edit(), got ${call.name}(). Try again.`
                  };
                }
              }
              return { reject: false };
            }
          });
        };
      }
      return (target as any)[prop];
    }
  });
}
```

#### Diff for retry path (line ~339):

```diff
  // The retry prompt already exists. V3 enhancement: also structurally enforce on retry.
  const retryPrompt = `🚨 YOUR PREVIOUS ATTEMPT...`;
- await worker.prompt(retryPrompt);
+ if (isWriteFirstTask(guidance)) {
+   await worker.prompt(retryPrompt, { allowedTools: ['write', 'edit'] });
+   await worker.prompt('Continue with any tools needed.');
+ } else {
+   await worker.prompt(retryPrompt);
+ }
```

## Behavioral Notes

1. **Only first tool call is intercepted** — after the worker makes a valid write/edit call, all subsequent calls proceed normally
2. **Error is returned as a tool result** — the worker sees it as a failed tool call and naturally retries
3. **No token waste** — rejection happens before execution, so no read/bash output is generated
4. **Retry budget** — uses existing retry logic; if worker fails 3 times to comply, escalate as usual
5. **Task detection is conservative** — only tasks matching write-first patterns are enforced; pure investigation tasks are unaffected

## Expected Impact

- Should push compliance from 62.5% to 90%+ since the model physically cannot execute a non-write first call
- The remaining <10% failure would be workers that exhaust retries by repeatedly trying non-write calls (unlikely with error message guidance)

## Files to Modify

1. **`master-worker.ts`** — Add `isWriteFirstTask()`, `enforceWriteFirst()`, and hook into tool execution loop
2. **No other files need changes** — this is purely in the dispatch/execution layer

## Testing Plan

1. Dispatch 8 write-first tasks, verify all produce write() as first tool call
2. Verify non-write-first tasks are unaffected
3. Verify retry count is not inflated (rejection shouldn't count as a full retry)
