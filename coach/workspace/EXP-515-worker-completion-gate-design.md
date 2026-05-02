# EXP-515: Worker Completion Verification Gate

**Date**: 2026-05-13
**Status**: DESIGN
**Author**: coach
**Builds on**: EXP-500 (structural injection works), EXP-510 (completion checklist concept), KE-480 (text dead)

## Problem

Worker sessions declare `finish(success)` without verifying their work actually landed. This is a structural analog of verify-after-edit but at the session level. From EXP-510 analysis:
- 93% of compute is worker sessions
- Workers have no behavioral instructions (only task prompt)
- Text coaching cannot reach workers (confirmed by EXP-460)

The specific failure mode: worker finishes with "success" but:
1. Files written don't match what was requested
2. Tests weren't run to verify
3. Partial implementation declared complete

## Hypothesis

Adding a **structural pre-finish check** in master-worker.ts that validates worker output before accepting "success":
- Check that ≥1 file was written/edited during the session
- If task mentions tests, check that a test command was run
- If neither condition met, inject a "verify your work" prompt before accepting finish

**Target**: ≥30% reduction in incomplete worker tasks (from EXP-510 baseline TBD)

## Design

### Treatment (in master-worker.ts)

After worker session completes, before accepting result:
```typescript
// EXP-515: Verify worker actually produced output
const hasWrites = workerMessages.some(m => 
  m.toolName === 'write' || m.toolName === 'edit');
const hasTests = workerMessages.some(m =>
  m.toolName === 'bash' && m.content?.includes('test'));

if (!hasWrites && !hasTests) {
  // Re-prompt: "You haven't written any files. Verify your task is complete."
  ctx.log('[work] EXP-515: No output detected, requesting verification');
  await worker.prompt('VERIFICATION REQUIRED: You have not written or edited any files this session. Please either:\n1. Complete the actual work (write/edit files)\n2. Explain why no file changes are needed\nDo NOT call finish() without producing deliverables.');
}
```

### Measurement

1. **Baseline**: Count sessions with finish(success) but 0 writes (pre-deployment)
2. **Treatment**: Same metric post-deployment
3. **Target**: Reduce "empty success" rate by ≥30%

### Prerequisites

- EXP-510 baseline measurement (audit 30 worker sessions)
- EXP-500 confirmation (ensure structural injection pattern is stable)

## Next Steps

1. Collect EXP-510 baseline: audit 30 recent worker sessions for completion quality
2. If baseline shows ≥15% incomplete rate, implement this gate
3. Measure after 50+ post-treatment worker sessions

## Risk

- False positives: some legitimate tasks produce no file output (e.g., "investigate X")
- Mitigation: only flag when task prompt contains action verbs (edit, write, create, implement, fix)
