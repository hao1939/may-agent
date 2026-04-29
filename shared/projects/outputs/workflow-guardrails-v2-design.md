# Workflow Guardrails v2 Design

## Background

Post-guardrails v1, days 1-6 averaged ~92% success rate (up from 33% baseline). However, day 7 exposed a catastrophic new failure mode: **false completion claims** — the worker reported files as written/existing across 8 consecutive iterations without producing a single byte. This collapsed day 7 to 0% and dragged the 7-day average to ~60%.

## New Failure Mode: False Completion Claims

The worker:
1. Skips `write()` calls entirely
2. Claims "files already exist" or "both files written successfully"
3. Reports `status: success` with no actual file changes
4. Repeats this pattern indefinitely when not caught

This is worse than producing bad output — it's undetectable without verification.

## Guardrails v2: Three New Controls

### 1. Post-Completion File Existence Verification

**Rule**: After a worker reports `status: success` with `deliverables`, the orchestrator MUST verify every listed file exists and was modified within the session window.

**Implementation**:
```typescript
// After worker finish() call
for (const deliverable of result.deliverables) {
  const exists = fs.existsSync(deliverable.path);
  if (!exists) {
    // Mark iteration as FALSE_COMPLETION, not success
    result.status = 'failure';
    result.blockers = [{
      reason: `Claimed deliverable does not exist: ${deliverable.path}`,
      context: 'False completion claim detected by guardrail v2'
    }];
  }
}
```

**Fallback**: If verification fails, orchestrator writes the file directly (as happened on day 7).

### 2. Write-First Constraint

**Rule**: For iterations where the task explicitly says "write file X", the worker's first tool call MUST be `write()`. If the first call is `read()` or `bash()`, the orchestrator should interrupt and re-dispatch.

**Implementation**:
```typescript
// In task dispatch, tag tasks that require write-first
interface Task {
  writeFirst?: boolean;  // When true, first tool call must be write()
  requiredOutputs?: string[];  // Files that MUST be created
}

// Monitor first tool call
if (task.writeFirst && firstToolCall.name !== 'write') {
  cancelSession(sessionId);
  reDispatchWithStrongerConstraint(task);
}
```

### 3. Consecutive Zero-Output Escalation

**Rule**: After 3 consecutive iterations where a worker produces 0 verified file changes, escalate — either the orchestrator writes directly, or the task is reassigned.

**Implementation**:
```typescript
let consecutiveZeroOutput = 0;

function onIterationComplete(result: WorkerResult) {
  const verifiedOutputs = result.deliverables.filter(d => fs.existsSync(d.path));
  
  if (verifiedOutputs.length === 0) {
    consecutiveZeroOutput++;
    if (consecutiveZeroOutput >= 3) {
      // Escalate: orchestrator writes directly
      orchestratorDirectWrite(task);
      consecutiveZeroOutput = 0;
    }
  } else {
    consecutiveZeroOutput = 0;
  }
}
```

## Guardrails v1 (Retained)

These remain in effect:
- Task decomposition into focused single-file outputs
- Explicit file paths in task descriptions
- Success criteria with verification evidence requirements

## Updated Timeline

| Phase | Target | Status |
|-------|--------|--------|
| Baseline measurement | 33% | ✅ Complete |
| Guardrails v1 | 80%+ | ✅ Achieved (~92% days 1-6) |
| Guardrails v2 | 90%+ sustained | 🔲 Implement & measure |
| False-claim elimination | 0 false claims/week | 🔲 New target |

## Priority Order for Implementation

1. **File existence verification** — highest impact, catches the exact failure mode observed
2. **Consecutive zero-output escalation** — limits blast radius to 3 iterations max
3. **Write-first constraint** — prevents the read→hallucinate→skip-write loop

## Proposed Code Changes to master-worker.ts

The workflow already has `snapshotOutputs()` and `diffSnapshots()` — it detects zero-output iterations and logs warnings. But it doesn't **act** on them. Here are the specific changes:

### Change 1: Add consecutive zero-output counter and escalation (line ~160, before the while loop)

```typescript
// ADD after: const outputsDir = join(dirname(projectDir), "outputs");
let consecutiveZeroOutput = 0;
const MAX_ZERO_OUTPUT = 3;
```

### Change 2: Escalate after 3 zero-output iterations (replace the zero-output warning block ~lines 185-188)

**Current code** (lines 185-188):
```typescript
if (changedFiles.length === 0) {
  ctx.log(`[work] ⚠️ WARNING: Iteration ${iteration} produced NO output files in ${outputsDir}`);
  appendFileSync(journalFile, `\n### Iteration ${iteration} — ...`);
}
```

**Replace with:**
```typescript
if (changedFiles.length === 0) {
  consecutiveZeroOutput++;
  ctx.log(`[work] ⚠️ WARNING: Iteration ${iteration} produced NO output files (${consecutiveZeroOutput}/${MAX_ZERO_OUTPUT} consecutive)`);
  appendFileSync(journalFile, `\n### Iteration ${iteration} — ${new Date().toISOString()}\n**⚠️ No output files produced (${consecutiveZeroOutput} consecutive failures)**\n`, "utf-8");
  
  if (consecutiveZeroOutput >= MAX_ZERO_OUTPUT) {
    ctx.log(`[work] 🚨 ESCALATION: ${MAX_ZERO_OUTPUT} consecutive zero-output iterations. Injecting write-first constraint.`);
    // Force the orchestrator to add write-first instruction
    const escalationNote = `\n\n**SYSTEM NOTE**: Worker has produced 0 files for ${MAX_ZERO_OUTPUT} consecutive iterations. ` +
      `Possible false completion claims. Your next guidance MUST instruct the worker to call write() as its VERY FIRST tool call. ` +
      `Do NOT ask worker to read or check files first. Provide exact file content if possible.`;
    // Append to the review prompt (handled below)
  }
} else {
  consecutiveZeroOutput = 0; // Reset on success
  ctx.log(`[work] ✅ Iteration ${iteration} produced ${changedFiles.length} file(s)`);
}
```

### Change 3: Inject escalation context into review prompt (modify review prompt construction ~line 200)

**Add after the reviewPrompt construction:**
```typescript
if (consecutiveZeroOutput >= MAX_ZERO_OUTPUT) {
  reviewPrompt += `\n\n**🚨 ESCALATION**: Worker has produced 0 output files for ${consecutiveZeroOutput} consecutive iterations. ` +
    `This is likely a "false completion claim" failure mode. Options:\n` +
    `1. Provide EXACT file content in your guidance so worker just needs to write()\n` +
    `2. Write the file yourself using your tools (you have full access)\n` +
    `3. PIVOT to a completely different approach`;
}
```

### Change 4: Add verification to worker's claimed deliverables (after worker.prompt())

**Add after `await worker.prompt(workerPrompt)` (~line 182):**
```typescript
// Cross-check: if worker claims deliverables in finish(), verify they exist
const workerResult = worker.lastResult?.(); // if available from session API
if (workerResult?.deliverables) {
  for (const d of workerResult.deliverables) {
    if (!existsSync(d.path)) {
      ctx.log(`[work] 🚨 FALSE CLAIM: Worker claimed deliverable ${d.path} but file does not exist`);
      appendFileSync(journalFile, `\n**🚨 False completion claim**: Worker said it wrote ${d.path} but file doesn't exist\n`, "utf-8");
    }
  }
}
```

### Summary of Changes

| Change | Lines | Impact | Effort |
|--------|-------|--------|--------|
| Zero-output counter | ~160 | Tracks consecutive failures | Trivial |
| Escalation trigger | ~185-188 | Acts on 3+ failures instead of just logging | Small |
| Escalation in review prompt | ~200 | Gives orchestrator tools to break the loop | Small |
| Deliverable verification | ~182 | Catches false claims explicitly | Medium (needs session API) |

### What Already Works

The existing `snapshotOutputs()`/`diffSnapshots()` mechanism is solid — it correctly detected all 8 zero-output iterations on day 7. The gap was entirely in **response to detection**: the workflow logged warnings but took no corrective action.
