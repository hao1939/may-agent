# Bob FM-3.1 Regression Analysis — 2026-04-09

**Status**: Root cause identified, fix recommendations ready  
**Scope**: 9 sessions from April 9 flagged with FM-3.1 (ghost deliverable) blocks  
**Root Cause**: False positives in `finish-guard.ts` GHOST_KEYWORDS regex + missing orchestration awareness

## Executive Summary

Bob's FM-3.1 spike is **not a Bob regression**. It's a **finish-guard infrastructure false positive** triggered by two factors:
1. The GHOST_KEYWORDS regex matches common English words that appear in analysis summaries
2. The finish-guard has no concept of workflow orchestration — parent sessions that delegate to child workflows have zero write evidence in their own transcripts

All 9 affected sessions ultimately completed successfully after Bob adapted his finish() calls. The wasted turns per session ranged from 1-3 extra finish() attempts.

## Session Details

### Cluster 1: Auto-Loop Workflow (5 sessions, 1 workflow run)

| Session | Task | Blocks | Recovery |
|---------|------|--------|----------|
| s_54 | Plan: token analysis | 0 | Clean |
| s_55 | Execute: token analysis | 0 | Clean |
| s_56 | **Evaluate: token analysis** | 2 (Gate1 + Gate0) | Rephrased summary |
| s_57 | Execute cycle 2 | 0 | Clean |
| s_58 | Evaluate cycle 2 | 1 (Gate1) | Removed deliverables |

**Pattern**: Evaluate sessions review work done in execute sessions. They have no write evidence but correctly summarize what was produced. Session 56's summary contained "created in previous session" → regex matched `created`.

### Cluster 2: Workflow Orchestrator Sessions (4 sessions)

| Session | Task | Blocks | Trigger Word |
|---------|------|--------|-------------|
| s_73 | Run auto-loop: git concurrency | 2 (Gate1 + Gate0) | "add flock()" |
| s_77 | Run auto-loop: session lifecycle | 1 (Gate1) | N/A (deliverables only) |
| s_81 | Run auto-loop: compaction analysis | 1 (Gate1) | N/A (deliverables only) |
| s_85 | Run auto-loop: heartbeat analysis | 2 (Gate1 + Gate0) | "Removed" |

**Pattern**: These are "outer" sessions that call `workflow run auto-loop`. The workflow's sub-sessions (plan/execute/evaluate) do the actual file writing. The parent session's transcript contains only `workflow` tool calls — zero write/edit/bash commands.

## Root Cause Analysis

### Root Cause 1: GHOST_KEYWORDS False Positives

The regex:
```
/\b(?:fix(?:ed)?|implement(?:ed)?|...|add(?:ed)?|creat(?:ed)?|...|remov(?:ed?)|...)\b/i
```

Matches these innocent uses:
- **`created`** in "file was **created** in previous session" (s_56)
- **`add`** in "recommendation: **add** flock()-based locking" (s_73) 
- **`Removed`** in "What Could Be Consolidated or **Removed**" (s_85)

These words appear in analytical descriptions of findings, not claims of having made changes. The guard correctly identifies that no writes occurred but incorrectly infers from the summary that the agent *claims* to have made writes.

### Root Cause 2: No Orchestration Awareness

The finish-guard checks for write evidence in `ctx.context.messages` — the current session's transcript. But orchestrator sessions delegate work to sub-sessions via the `workflow` tool. The child sessions have full write evidence; the parent session has none.

The guard already exempts `claude_code`, `codex_cli`, and `gemini_cli` (external coding agents whose writes don't appear in the transcript). The same logic applies to `workflow` and `agents.call` — they produce files via child sessions whose evidence isn't visible to the parent.

### Why This Looks Like a Spike

All 9 sessions occurred in the same ~45-minute window when May dispatched 5 auto-loop research tasks to Bob. Before this point, Bob rarely used auto-loop workflows (the feature was only committed at 00:26 UTC on April 9). The spike coincides exactly with the auto-loop feature rollout, not with any change in Bob's behavior.

## Fix Recommendations

### Fix 1: Add Orchestration Exemption (High Impact, Low Risk)

Add `workflow` and `agents_call`/`agents_fork` to the write-evidence exemption list, alongside the existing `claude_code` exemption:

```typescript
// Already exempt:
if (toolNames.has("claude_code") || toolNames.has("codex_cli") || toolNames.has("gemini_cli")) {
  hasWriteEvidence = true;
}
// NEW: orchestration tools produce files via child sessions
if (toolNames.has("workflow") || toolNames.has("agents")) {
  hasWriteEvidence = true;
}
```

This is the minimal correct fix. Orchestrator sessions that call `workflow` or `agents` tools can claim deliverables produced by child sessions.

### Fix 2: Refine GHOST_KEYWORDS (Medium Impact, Low Risk)

The current regex matches words that commonly appear in analytical summaries. Options:
- **Remove `add` and `remove`**: These are too generic. "Added tests" vs "recommend adding" are indistinguishable by regex.
- **Use bigrams**: Match "I fixed", "I created", "I added" rather than bare keywords.
- **Require verb + noun object**: Match "created file" or "fixed bug" rather than "was created" or "add locking".

A pragmatic fix: require the keyword to NOT be preceded by "recommend", "should", "could", "was", "were", "been":

```typescript
const GHOST_KEYWORDS = /(?<!\b(?:recommend|should|could|was|were|been|to)\s)\b(?:fix(?:ed)?|...)\b/i;
```

However, negative lookbehinds in JS regex are limited. A safer approach is to just remove the most problematic words (`add`, `created`, `removed`, `changed`) and keep only strong signal words (`fixed`, `implemented`, `deployed`, `refactored`).

### Fix 3: Add `completed_items` / `new_items` to the Deliverables Exemption (Low Impact)

The ghost keyword gate fires when `!hasDeliverables && !hasWriteEvidence && GHOST_KEYWORDS.test(summary)`. But some sessions legitimately complete work without file deliverables (evaluators, dispatchers, orchestrators). Consider also checking for `completed_items` as evidence of legitimate completion.

## Priority

**Fix 1 is the critical fix.** It addresses the structural gap (orchestration unawareness) and would have prevented all 7 of the 9 blocks in the affected cluster-2 sessions. Fix 2 addresses the remaining 2 false positives from cluster 1.

## Impact Assessment

- **Wasted Bob turns**: ~12-15 extra tool calls across 9 sessions (1-3 retries each × overhead)
- **Wasted tokens**: ~$0.50-1.00 per false positive retry cycle
- **False FM-3.1 count inflation**: If evaluator reviews these sessions, it would log 9+ false FM-3.1 entries
- **Behavioral tax on Bob**: RECALL warnings about these FM-3.1 failures are now embedded in Bob's future sessions, causing him to over-hedge on finish() calls

## Cross-References

- `src/lib/tools/finish-guard.ts` — the guard implementation
- EXP-096 — unrelated (attention dilution experiment), but was running concurrently
- `auto-loop` workflow — committed at 00:26 UTC April 9, the proximate trigger for the session pattern
