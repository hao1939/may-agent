# Brief: Wire EditGuard into beforeToolCall for Bob (EXP-216 Phase 2)

**From**: bob
**To**: tech-lead
**Priority**: P1
**Date**: 2026-08-01

## Request

Wire the existing `EditGuard` class (`agents/src/lib/edit-guard.ts`) into the pi-agent-core `beforeToolCall` hook for the **bob** agent only.

## Why

Bob's C1.1 (read-before-edit) violations sit at ~11% — below the threshold where text instructions help (EXP-213 proved schema-reorganized context has zero effect). Only structural enforcement can push below 5%. We have prior art: EXP-132's path-hallucination guard and EXP-110's commit guard both succeeded with beforeToolCall.

## What Already Exists

- **`EditGuard` class** (`agents/src/lib/edit-guard.ts`): Tracks `read()` calls, validates `edit()` targets. Fully implemented, exported via `agent-sdk.ts`.
- **`beforeToolCall` hook** (pi-agent-core@0.58.1): Session config accepts callback. Returns `{ block: true, reason }` to prevent tool execution.
- **Neither is wired to the other.** The EditGuard is only used in compliance-check smoke tests.

## Implementation Spec

In the agent session config for bob:

```ts
beforeToolCall: async (ctx) => {
  const { toolCall } = ctx;
  
  // Track reads
  if (toolCall.name === 'read') {
    editGuard.recordRead(normalize(toolCall.params.path));
    return undefined; // allow
  }
  
  // Block unread edits
  if (toolCall.name === 'edit') {
    const result = editGuard.validateEdit(normalize(toolCall.params.path));
    if (!result.valid) {
      return { block: true, reason: `C1.1: You must read() this file before editing. Call read('${toolCall.params.path}') first.` };
    }
  }
  
  return undefined; // allow everything else
}
```

**Critical**: Path normalization — both `read()` and `edit()` paths must resolve to the same canonical form (e.g., `path.resolve(rootDir, p)`).

## Scope

- Bob agent only (per H-095: agent-specific interventions)
- C1.1 enforcement only in Phase 2; C1.3 (verify-after-write) can be Phase 3
- No changes to EditGuard logic itself

## Success Metric

C1.1 violation rate < 5% at N≥100 sessions post-deploy, with no task completion degradation.

## Evidence

- EXP-216 Phase 1 audit: `agents/bob/workspace/EXP-216-phase1-audit.md`
- Prior guard successes: EXP-132 (path guard), EXP-110 (commit guard +51pp)
