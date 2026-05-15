# DESIGN: Mechanical Finish Gate (H-GATE1)

**Date**: 2025-01-28  
**Author**: bob  
**Status**: READY_TO_IMPLEMENT  
**Priority**: P0  
**Builds on**: intervention-coverage-audit-2029-09.md, EXP-610, EXP-860

## Problem

Prompt-based write constraints fail 100% of the time in failed sessions. Agents call `finish(success)` with zero file artifacts despite explicit instructions to write first. The anti-shallow rule (≥5 tool calls) helps but doesn't guarantee artifacts.

## Solution: Post-Session Verification in master-worker.ts

Add a mechanical check in the orchestrator **after** the worker completes. If the worker claims `success` but the session trace shows zero `write()` or `edit()` calls, reject the result and either:
1. Re-dispatch with stronger framing (one retry), OR
2. Mark the iteration as FAILED and log it

### Implementation Location

`agents/shared/workflows/master-worker.ts` — after worker returns, around line ~450-500 (where orchestrator processes worker output).

### Pseudocode

```typescript
// After worker session completes:
function validateWorkerOutput(sessionResult: WorkerResult): ValidationResult {
  const hasWriteOps = sessionResult.toolCalls.some(
    tc => tc.name === 'write' || tc.name === 'edit'
  );
  const claimsSuccess = sessionResult.finish?.status === 'success';
  
  if (claimsSuccess && !hasWriteOps) {
    return {
      valid: false,
      reason: 'ZERO_ARTIFACT_SUCCESS',
      action: 'retry_once' // or 'fail'
    };
  }
  
  // Also check: verification_evidence must reference real tool outputs
  if (claimsSuccess && (!sessionResult.finish?.verification_evidence?.length)) {
    return {
      valid: false, 
      reason: 'NO_VERIFICATION_EVIDENCE',
      action: 'accept_with_warning' // less severe
    };
  }
  
  return { valid: true };
}
```

### Retry Injection (on first failure)

```
YOUR PREVIOUS SESSION CLAIMED SUCCESS BUT PRODUCED ZERO FILES.
This is mechanically rejected. You MUST either:
1. Write at least one file (edit or write tool), then finish(success)
2. finish(failure) with an honest explanation of why you couldn't produce output
There is no third option. An empty success is impossible.
```

### Edge Cases

1. **Task is truly read-only** (e.g., "verify X is correct"): The gate should be skippable for tasks explicitly tagged as `verification-only`. Add a flag in the orchestrator's task dispatch.
2. **Agent writes via bash** (e.g., `echo > file`): Count bash commands that include redirect operators (`>`, `>>`, `tee`) as write operations.
3. **Agent reads but finds nothing to do**: This is the NON_DELIVERY pattern. Force either a completion-evidence file or explicit failure.

### Metrics

- **Baseline**: 5/5 (100%) of failed sessions exhibit NON_DELIVERY pattern
- **Target**: <2/10 (<20%) after gate deployment
- **Measurement**: Count sessions where finish(success) + zero artifacts after gate is live

## Risk Assessment

- **Low risk**: Gate only affects `finish(success)` + zero writes. Normal sessions always write.
- **False positive rate**: Near zero. Legitimate read-only tasks are rare and can be flagged.
- **Retry cost**: One extra iteration per caught failure. Far cheaper than evaluator catching it post-hoc.

## Existing Infrastructure (verified 2025-01-28)

**Already deployed** (master-worker.ts ~line 520):
- `snapshotOutputs()` compares `outputs/` dir before/after each worker iteration
- Consecutive zero-output counter with auto-terminate at `MAX_ZERO_OUTPUT * 2`
- EXP-511 proved retries have 0% recovery rate → retry block removed

**Gaps in existing system**:
1. Only monitors `outputs/` directory — misses writes to `workspace/`, `skills/`, etc.
2. Doesn't distinguish worker's `finish(success)` claim from actual output
3. Zero-output retry was killed (0% recovery), but single retry with *different framing* untested
4. EXP-510/565 inject threats but never mechanically verify

**Implementation approach**: Rather than parsing session transcripts for tool calls (complex), extend `snapshotOutputs()` to also check the project's `workspace/` and any paths mentioned in the worker's `finish()` deliverables field. This is simpler and uses existing patterns.

## Next Steps

1. **Quick win**: Verify what `MAX_ZERO_OUTPUT` is set to (grep the file)
2. **Design**: Extend diffSnapshots to check workspace/ in addition to outputs/
3. **Propose to architect**: Mechanical rejection of finish(success) when zero files changed across ALL monitored dirs
4. **Measure**: After deployment, track NON_DELIVERY rate in next 10 evaluated sessions
