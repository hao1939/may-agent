# Lens B: Guard Composition Flow Complexity

**Date**: 2026-04-13  
**Scope**: `src/lib/tools/compose-guards.ts` (71 LOC), `src/lib/manager-receipts.ts` (406 LOC), 10 guard files (1,855 LOC)  
**Total guard system**: 2,261 LOC across 12 files  

## Summary

The guard system has a clean composition primitive (`composeGuards`) but significant complexity accumulates in the **execution wrapper** (`wrapToolsWithReceipts`) which handles guard results, receipts, pivot heuristics, cost signals, stuck detection, and finish-tool abort — all interleaved in a single 180-line `execute()` closure. The 10-guard chain itself is well-structured; the problem is at the integration boundary.

## End-to-End Flow (tool call → guard decision → result)

### Hop Count: 5 layers

```
1. Agent calls tool (e.g., finish())
2. wrapToolsWithReceipts.execute() intercepts
3. ctx.beforeToolCall(guardCtx) invoked
4. composeGuards() iterates 10 guards sequentially
5. First blocking guard wins → result bubbles back to wrapToolsWithReceipts
```

### Detailed Path

```
Tool Call
  └─ wrapToolsWithReceipts (manager-receipts.ts:164)
       ├─ Build BeforeToolCallContext from session state (L172-178)
       ├─ ctx.beforeToolCall(guardCtx, signal) (L180)
       │    └─ composeGuards (compose-guards.ts:47)
       │         ├─ Guard 1: emptyArgsGuard — blocks malformed args (92 LOC)
       │         ├─ Guard 2: toolSchemaGuard — validates args vs schema (200 LOC)
       │         ├─ Guard 3: pathHallucinationGuard — detects non-existent paths (202 LOC)
       │         ├─ Guard 4: completenessGuard — finish must list deliverables (193 LOC)
       │         ├─ Guard 5: finishGuard — 3 gates: ghost deliverable, write evidence, verification (284 LOC)
       │         ├─ Guard 6: commitGuard — commit policy enforcement (103 LOC)
       │         ├─ Guard 7: verificationDepthGuard — FM-3.3 deep check (422 LOC)
       │         ├─ Guard 8: readDedupGuard — blocks duplicate reads (82 LOC)
       │         ├─ Guard 9: sessionReadGuard — session access control (122 LOC)
       │         └─ Guard 10: scrapeDedupGuard — blocks duplicate scrapes (84 LOC)
       │
       ├─ If block=true:
       │    ├─ Sign blocked reason with HMAC (L185)
       │    ├─ Count blocked call (L189)
       │    ├─ If redirect: call session.agent.steer() with workflow guidance (L192-204)
       │    └─ Return error content wrapped in <tool_output> (L206-214)
       │
       ├─ If block=false (warning):
       │    ├─ If steer field: call session.agent.steer() with guidance (L217-226)
       │    └─ Store warning text for later injection (L228)
       │
       ├─ [Tool executes normally]
       │
       └─ Post-execution assembly (L230-330):
            ├─ Tool Pivot Heuristic check (L234-250)
            ├─ Execute original tool (L254)
            ├─ opCount increment for state-changing tools (L261-274)
            ├─ totalToolCalls increment (L278)
            ├─ HMAC signing (L283)
            ├─ Error tracking / pivot critique injection (L288-305)
            ├─ Receipt logging to JSONL (L310-320)
            ├─ Cost signal injection (L323-328)
            ├─ <tool_output> tag wrapping (L331-341)
            ├─ Guard warning injection (L344)
            ├─ Stuck detection warning injection (L347-352)
            └─ finish() abort scheduling (L355-360)
```

## Findings

### 1. Composition Primitive is Clean — Severity: None

`composeGuards()` is 25 LOC of logic. First-block-wins with fail-open semantics. Simple, correct, well-documented. No issues here.

### 2. wrapToolsWithReceipts is a God Function — Severity: High

The `execute()` closure in `wrapToolsWithReceipts` (L164-365, ~200 lines) handles **7 distinct responsibilities**:

1. Guard execution + redirect/steer handling
2. Tool Pivot Heuristic (duplicate failure detection)
3. Original tool execution
4. opCount tracking + persistence
5. HMAC signing + receipt logging
6. Error tracking + pivot critique injection
7. Output assembly (cost signals, stuck warnings, guard warnings, XML wrapping)

These are interleaved, not separated. Adding new post-execution behavior requires reading the entire function to find the right insertion point. Every new guard feature (like the redirect/steer additions) adds more conditional branches to this function.

### 3. Guard Overlap: finishGuard vs verificationDepthGuard — Severity: Medium

Both `finishGuard` (284 LOC, Gate 2 FM-3.3) and `verificationDepthGuard` (422 LOC) check for "writes without verification." They run in sequence (guards 5 and 7) on the same `finish(status: "success")` call. Key differences:

- **finishGuard**: checks if ANY read/test/type-check exists after last write. Simpler heuristic.
- **verificationDepthGuard**: checks verification *quality* — distinguishes shallow (exists-check) from deep (content/test) verification.

But the overlap means: (a) finishGuard may block before verificationDepthGuard ever runs, (b) if finishGuard passes but verificationDepthGuard blocks, the user gets a confusing second rejection on retry, (c) 706 combined LOC for verification checking.

The `exemptAgents: ["bob"]` config on verificationDepthGuard (L419-421 of manager.ts) adds per-agent policy directly in the composition call — this should arguably be in agent.json, not code.

### 4. Redirect/Steer Mechanism — Severity: Low (well-implemented)

The Phase 1 implementation (added to `BeforeToolCallResult`) is clean:

- **Blocking redirect** (manager-receipts.ts L192-204): Guard blocks → tool error returned → `agent.steer()` called with workflow suggestion. The steer arrives as a next-turn user message. Only `finishGuard` uses this today (FM-3.3 → verify-wrap redirect).
- **Non-blocking steer** (L217-226): Guard allows the call but injects guidance. Not currently used by any guard.

Risk: `steer()` is called from inside the tool execution wrapper. Per pi-agent-core docs, `steer()` queues a message for after the current assistant turn — so the timing is correct. But if the guard composition changes and multiple guards return `redirect`, only the first one fires (because `composeGuards` returns on first block). This is correct behavior.

### 5. Session Lookup Fragility — Severity: Low

The `getSession()` helper (L139-151) uses a cached lookup with null-fallback retry. The comment explains why: "session may not have been added to activeSessions yet." This is defensive but creates 6 separate `getSession()` calls throughout the execute closure (L175, L189, L196, L220, L237, L261), each stored in a different local variable (`session`, `blockedSession`, `redirectSession`, `steerSession`). Could be simplified to one session reference at the top.

### 6. Total Guard Code Mass — Severity: Informational

| Guard | LOC | Fires on |
|-------|-----|----------|
| emptyArgsGuard | 92 | Any tool with empty args |
| toolSchemaGuard | 200 | Any tool with invalid schema |
| pathHallucinationGuard | 202 | read/write/edit/bash with bad paths |
| completenessGuard | 193 | finish(success) without deliverables checklist |
| finishGuard | 284 | finish(success) — ghost deliverable, write evidence, FM-3.3 |
| commitGuard | 103 | bash with git commit on main |
| verificationDepthGuard | 422 | finish(success) — verification quality |
| readDedupGuard | 82 | Duplicate read() calls |
| sessionReadGuard | 122 | Unauthorized session reads |
| scrapeDedupGuard | 84 | Duplicate scrape() calls |
| **Total** | **1,784** | |

Plus compose-guards.ts (71), manager-receipts.ts execute closure (~200), cross-edit-guard.ts (136, **not in composition** — standalone). Total system: ~2,200 LOC.

## Recommendations

1. **Extract post-execution concerns from wrapToolsWithReceipts** into composable "after-tool" hooks, mirroring the `beforeToolCall` pattern. This would isolate pivot heuristics, cost signals, stuck detection, and receipt signing from each other.

2. **Merge or layer finishGuard and verificationDepthGuard** — either make verificationDepthGuard subsume finishGuard's FM-3.3 check (since it's strictly more sophisticated), or document the intentional layering so future maintainers understand why both exist.

3. **Move per-agent guard policy to agent.json** — the `exemptAgents: ["bob"]` in manager.ts is a code-level policy decision that should be data-driven.

4. **Consolidate session lookups** in the execute closure — one `const session = getSession()` at top, reuse everywhere.
