# Lens A: Guard Escalation Override — Tech-Lead Review

**Author:** Tech-Lead · **Date:** 2026-04-15 · **Status:** Review of Bob's design + implementation recommendation  
**Bob's design:** `agents/shared/designs/guard-escalation-override.md`

## Executive Summary

Bob's design is sound. Phase 1 (`finish()` never blocked) is the only part that matters immediately — it's a 5-line fix to `composeGuards()` that eliminates the trapped-agent bug. Phases 2-3 (override tool, guard categories) are premature with cost-limit-guard gone. **Implement Phase 1 now. Defer the rest.**

## Current Guard Architecture (Post cost-limit-guard Removal)

### Active Guards in `composeGuards()` (src/lib/manager.ts)

| # | Guard | What It Blocks | Can Block finish()? |
|---|-------|---------------|---------------------|
| 1 | empty-args-guard | Missing required params | No (args always present on finish) |
| 2 | tool-schema-guard | Cross-tool arg confusion | Yes (if finish args malformed) |
| 3 | path-hallucination-guard | Hallucinated fs paths | No (finish has no paths) |
| 4 | completeness-guard | Premature success (optimizer only) | Yes (blocks finish+success) |
| 5 | finish-guard | Unverified finish(success) | Yes (3 block points: no writes, no evidence, no file verification) |
| 6 | commit-guard | finish() with uncommitted changes | Yes (blocks all finish statuses) |
| 7 | verification-depth-guard | Shallow verification | Yes (conditional, per-agent calibration) |
| 8 | read-dedup-guard | Repeated file reads | No (finish isn't a read) |
| 9 | session-read-guard | Raw session.jsonl reads | No (finish isn't a read) |
| 10 | scrape-dedup-guard | Duplicate scrapes | No (finish isn't a scrape) |

### Inline Guards (not in composeGuards)

| Guard | Where | What It Blocks |
|-------|-------|---------------|
| cross-edit-guard | edit.ts, write.ts | Edits to other agents' SOUL.md/agent.json |

### Guards That Can Block finish()

**4 guards** can prevent `finish()`:
1. **finish-guard** — blocks finish(success) if no write evidence, no verification_evidence field, or no file verification in transcript
2. **commit-guard** — blocks ALL finish statuses if git diff shows uncommitted changes in agent's directory
3. **completeness-guard** — blocks finish(success) for optimizer if transcript lacks completeness signals
4. **verification-depth-guard** — blocks finish(success) if transcript lacks measurement verification (calibrated per-agent)

These are the "trapped agent" risk. If any of these fires AND the agent can't satisfy the guard's requirements, the agent loops until watchdog timeout (~60-90 min of wasted tokens).

## Review of Bob's Design

### Phase 1: finish() Never Blocked ✅ STRONG RECOMMENDATION

**Implement this immediately.** The fix is surgical:

```typescript
// In composeGuards(), before the guard loop:
if (context.toolCall.name === "finish") {
  return undefined; // Guards log warnings but never block finish()
}
```

**Why this is safe:**
- The finish-guard's purpose (verify evidence before claiming success) becomes a *steer warning* instead of a block. The agent still gets the message "you didn't verify" but can choose to finish anyway.
- The commit-guard's purpose (don't lose work) is handled by the fact that sessions are logged — uncommitted changes are recoverable from session transcripts.
- An agent that finishes(success) without evidence is better than an agent that burns 60 minutes of tokens trying to satisfy an impossible condition.

**Risk assessment:** LOW. The worst case is an agent claims success without verifying. We already have evaluator scoring that catches this — it just gives a lower quality score. That's a much cheaper feedback signal than wasted token burn.

### Phase 2: Guard Categorization ⚠️ DEFER

Bob's `overridable` field adds schema complexity for minimal gain with cost-limit-guard gone. The remaining guards fall into two clean categories:
- **input-validation guards** (empty-args, tool-schema, path-hallucination) — these never need overriding because they catch genuinely malformed calls
- **quality-gate guards** (finish, commit, completeness, verification-depth) — these only fire on finish(), which Phase 1 already exempts

With Phase 1 in place, no agent can get trapped. The categorization becomes documentation-only, not runtime-critical.

### Phase 3: `override_guard` Tool ⚠️ DEFER STRONGLY

Adding a new tool to the agent's toolset:
- Increases system prompt complexity
- Requires agents to learn override protocol
- Creates a new failure mode (agents overriding safety guards inappropriately)
- Adds logging infrastructure overhead

**The cost-benefit doesn't work** with only 10 guards, 4 of which only fire on finish(). Phase 1 eliminates the need.

## Implementation Recommendation

### Do Now (1 commit, ~10 LOC)

1. In `composeGuards()`: exempt `finish` tool from blocking guards (convert blocks to warnings)
2. Update guard doc comments to note the finish() exemption

### Do Later (only if new evidence of trapped agents emerges)

- Guard categorization (Phase 2)
- Override tool (Phase 3)

### Do NOT Do

- ~~Workflow-level cost-limit guard changes~~ — `agents/shared/guards/cost-limit.ts` blocks at 60 turns. This is flagged for Hao separately. It's in a different execution path (workflow guards vs tool call guards).

## Open Question for Hao

**The finish() exemption changes behavior for 4 guards.** Specifically:
- finish-guard currently blocks agents from claiming success without evidence. With the exemption, agents can claim success without evidence (they'll get a warning steer).
- commit-guard currently forces agents to commit before finishing. With the exemption, agents can finish with uncommitted changes.

Both are quality guardrails, not safety guardrails. The evaluator catches false success claims after the fact. But Hao should confirm: **is "wasted tokens from trapped agents" worse than "occasional false success claims"?** (My assessment: yes, substantially worse.)
