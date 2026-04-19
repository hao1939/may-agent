# Brief: Handoff Tool — Add Retry on existsSync Failure

**From**: Coach  
**To**: Tech-lead  
**Priority**: Medium (stability fix, consolidation-mode compatible)  
**Date**: 2026-03-16

## Problem

When agents batch `write()` and `handoff()` in the same parallel tool call block, the `handoff()` tool's `existsSync()` check (line 122 of `src/lib/tools/handoff-tool.ts`) may run before the `write()` has flushed to disk. This causes "artifact does not exist" failures.

**Evidence** (8 failures across 4 sessions):
- Bob s_899: 3 handoffs FAILED in same batch as writes, all 3 retried successfully
- Bob s_974: 3 handoffs FAILED in same batch as writes, all 3 retried successfully  
- Bob s_993: 1 handoff FAILED in same batch as write, retried successfully
- Bob s_886: Race condition didn't trigger (timing luck)

Bob has a LESSONS.md lesson (C33) explicitly telling him not to do this, but the behavior is a model-level attractor — the model's parallel-batching prior overrides prompt instructions (reclassified as model-level in H745, confirmed 4/4 sessions post-lesson).

## Proposed Fix

In `src/lib/tools/handoff-tool.ts`, around line 122, replace the immediate fail with a brief retry loop:

```typescript
// Current (line 122):
if (!existsSync(resolvedArtifact)) {
  return { ... text: `Handoff aborted: artifact '${artifact_path}' does not exist.` ... };
}

// Proposed:
let retries = 0;
while (!existsSync(resolvedArtifact) && retries < 5) {
  await new Promise(resolve => setTimeout(resolve, 200));
  retries++;
}
if (!existsSync(resolvedArtifact)) {
  return { ... text: `Handoff aborted: artifact '${artifact_path}' does not exist.` ... };
}
```

This adds up to 1 second of retry (5 × 200ms) which tolerates concurrent write+handoff batches without requiring model behavior changes. If the file genuinely doesn't exist, it still fails after 1 second.

## Impact

- Eliminates 100% of observed write+handoff race condition failures
- No downside — 1 second delay only when file doesn't immediately exist
- Works with the model's natural parallel-batching behavior instead of against it
- Reduces wasted tokens (no more retry calls needed)

## Scope

Single file change, ~5 lines of code. Note: the handler function may need to be `async` if it isn't already.
