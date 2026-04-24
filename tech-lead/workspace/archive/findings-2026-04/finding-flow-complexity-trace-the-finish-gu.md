# Lens B — Finish() Guard Flow Trace

**Date:** 2026-04-17
**Scope:** `src/lib/tools/compose-guards.ts`, `src/lib/tools/finish-guard.ts`, `src/lib/tools/lifecycle.ts` (+ glance at `completeness-guard.ts`, `verification-depth-guard.ts`, `manager.ts`)
**Severity:** LOW — architecture is coherent; one minor confusion point worth documenting.

## 1. Call Graph

```
agent invokes finish(status, summary, deliverables, verification_evidence, …)
  │
  ▼
pi-agent-core dispatches beforeToolCall hook registered in manager.ts:380–400
  │
  ▼
composeGuards(…)                          [src/lib/tools/compose-guards.ts:48]
  ├─ createEmptyArgsGuard()                ── generic (all tools)
  ├─ createToolSchemaGuard()               ── generic (all tools)
  ├─ createPathHallucinationGuard()        ── generic (all tools)
  ├─ createCompletenessGuard(agentName)    ── finish-only; optimizer-scoped
  │     checks transcript for DELIVERABLES_CHECKLIST write   [completeness-guard.ts]
  ├─ createFinishGuard()                   ── finish(success) only
  │     ├─ Gate 0: Ghost-Deliverable (summary verb vs write evidence)
  │     └─ Gate 1: Write-evidence vs listed deliverables     [finish-guard.ts:185]
  │     (Gate 2 removed — deduplicated with verification-depth T2)
  ├─ createCommitGuard(agentName, root)    ── finish-only; src/ commit rules
  └─ createVerificationDepthGuard(agent)   ── finish(success); T1/T2/T3 depth tiers
  │
  ▼  (composeGuards: first `{block:true}` wins; blocked/failure never blocked)
  │
  ▼  (if no guard blocks)
finish tool execute()                     [src/lib/tools/lifecycle.ts:189]
  ├─ V1: status required
  ├─ V2: summary required
  ├─ V3: blockers required for blocked/failure
  ├─ V4: existsSync() every deliverable.path  (success only)
  ├─ V5: verification_evidence[] non-empty    (success only)
  └─ persist: updateRequest(), memory-stream.jsonl lessons, etc.
```

## 2. Layer Count

**3 layers that can block finish(success):**

| Layer | Location | What it checks | Blocking mechanism |
|---|---|---|---|
| L1: Compose harness | `compose-guards.ts:48` | iterates guards; downgrades block→warn for `finish(blocked\|failure)` | returns `{block:true,reason}` → pi-agent-core surfaces as tool error |
| L2: Guard chain | 4 finish-relevant guards (completeness, finish-guard, commit-guard, verification-depth) + 3 generic | transcript-based evidence: deliverables checklist, write evidence, ghost-keywords, commit safety, verification depth | same BeforeToolCallResult shape |
| L3: Tool execute | `lifecycle.ts:189–258` | param shape + disk-level `existsSync` + required `verification_evidence[]` field | returns error `content` instead of finish record |

Generic guards (empty-args, schema, path-hallucination) fire on *every* tool call — not finish-specific — so they're effectively background noise for this path.

## 3. Confusion Point (Documented, Not Actionable)

Agents see *two distinct* post-write verification demands for a single finish(success):

1. **L3/V5 (lifecycle.ts:247):** `verification_evidence` array field — *narrative* citations ("Step 5: read() showed…").
2. **L2/verification-depth-guard:** transcript scan for *actual* verification tool calls after the last write.

These are complementary (narrative vs evidence), but the error messages don't cross-reference each other. Multiple past failures in active recall (FM-3.3 guard friction) come from agents satisfying (1) by fabricating citations while (2) still blocks because no real verify tool call exists. The finish-guard.ts comment "Gate 2 removed — deduplicated" shows a prior merge attempt; the remaining split between lifecycle (narrative) and verification-depth-guard (transcript) is intentional but under-documented.

## 4. Verdict

**No simplification warranted.** The layer split is principled:
- L1 = orchestration (shouldn't contain policy)
- L2 = transcript-time behavioral guards (composable, per-agent tunable)
- L3 = param-shape + disk-truth validation (must run in tool, not guard — disk state is not in transcript)

Merging L2↔L3 would conflate transcript policy with disk policy; merging guards within L2 was already done (Gate 2 removal). The only low-cost win is documentation.

## 5. Follow-Up (for a separate session, not this one)

- **Doc-only:** add a one-line cross-reference in `lifecycle.ts` V5 error message pointing to verification-depth-guard's transcript requirement, so agents understand the narrative citation is NOT a substitute for real verify tool calls. Owner: docs/tech-lead. Effort: ~5 lines of string.
- No code restructuring recommended.
