# Workflow Guardrails v3 — Structural Write-First Enforcement

**Date**: 2025-07-01
**Problem**: V2 guardrails (prompt-based retry with escalation) achieved only 62.5% success rate. Workers ignore write-first instructions even after retry.

## Root Cause
Workers read files, analyze, plan, and run out of context/time before writing. The retry prompt ("your first call MUST be write()") is still just a prompt — the worker can ignore it.

## V3 Approach: Structural Enforcement

Instead of asking the worker to write first, **enforce it programmatically** by intercepting tool calls.

### Design

1. **First-call gate**: After the worker session starts, intercept its first tool call. If it's not `write()` or `edit()`, reject it with an error message and force the worker to call write/edit first.

2. **Implementation**: Wrap the worker's tool dispatch so the first N calls are validated:
   - Call 1 MUST be `write()` or `edit()` → rejected otherwise with clear error
   - After first write/edit succeeds, all tools are unlocked

3. **Fallback write**: If the worker's first 3 tool calls are all rejected (none are write/edit), auto-terminate the worker turn and log failure. Don't waste tokens on a worker that won't comply.

### Code Changes to `master-worker.ts`

#### Change 1: Add tool gate to worker session (before line ~327)

Before `await worker.prompt(workerPrompt)`, configure the worker session with a tool interceptor:

```typescript
// V3 GUARDRAIL: Structural write-first enforcement
// Gate the worker's first tool call — must be write() or edit()
let workerHasWritten = false;
let rejectedCalls = 0;
const MAX_REJECTED = 3;

worker.setToolGate((toolName: string) => {
  if (workerHasWritten) return true; // unlocked after first write
  if (toolName === 'write' || toolName === 'edit') {
    workerHasWritten = true;
    return true;
  }
  rejectedCalls++;
  if (rejectedCalls >= MAX_REJECTED) {
    return { reject: true, message: 'TERMINATED: You failed to write a file in your first 3 tool calls. Session ended.' };
  }
  return { reject: false, message: `🚫 BLOCKED: Your first tool call must be write() or edit(). You called ${toolName}(). Write your output file FIRST, then you can read/bash.` };
});
```

#### Change 2: Remove v2 retry logic (lines ~340-360)

The retry-after-zero-output logic becomes unnecessary since the structural gate prevents the failure mode. Remove the retry block and replace with a simpler log:

```typescript
if (changedFiles.length === 0) {
  ctx.log(`[work] ⚠️ Iteration ${iteration} produced NO output files despite write-first gate`);
}
```

### Implementation Note

The `setToolGate` API may not exist on the worker session object. If not, the alternative is:
- **Option A**: Modify the `Session` class to support tool call interception (preferred — reusable)
- **Option B**: Use a wrapper prompt that includes XML-enforced output format (weaker)
- **Option C**: Have the orchestrator pre-create a stub file via `write()` before handing off to the worker, so the worker's task is `edit()` not `write()` (pragmatic workaround)

**Recommended**: Start with Option C (orchestrator writes stub) as it requires zero infrastructure changes, then pursue Option A for long-term reliability.

### Option C Detail (Immediate Implementation)

In `master-worker.ts`, before calling `worker.prompt()`:

```typescript
// V3 GUARDRAIL: Pre-create output stub so worker edits rather than creates
const expectedOutput = `outputs/${taskSlug}-iter${iteration}.md`;
const stubPath = join(outputsDir, `${taskSlug}-iter${iteration}.md`);
if (!existsSync(stubPath)) {
  writeFileSync(stubPath, `# Iteration ${iteration} Output\n\n<!-- Worker: replace this with your deliverable -->\n`, 'utf-8');
  ctx.log(`[work] 📝 Pre-created stub: ${expectedOutput}`);
}
```

Then modify the worker prompt to reference the stub:
```typescript
const workerPrompt = `## Task (Iteration ${iteration})
OUTPUT FILE: ${expectedOutput} (already created — use edit() to fill it in)
${guidance}`;
```

## Success Criteria
- 90%+ of worker iterations produce at least one modified file
- No more than 2 consecutive zero-output iterations before auto-termination

## Risks
- Option C (stub files) means "file changed" might just be the stub, not real content → need content-length check
- Tool gate (Option A) requires Session class changes that may have side effects
