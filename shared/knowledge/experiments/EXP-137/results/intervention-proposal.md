# EXP-137 Intervention Proposal: Verification Workflow for Reliant Agents

**Date**: 2026-04-11  
**Author**: Coach  
**Target agents**: Scout (primary), May (secondary), Optimizer (tertiary)  
**Prerequisite**: EXP-137 structural comparison

---

## The Problem

Reliant agents (may, scout, optimizer) have genuine FM-3.3 block rates of 67-71% — meaning 7 out of 10 work sessions require the guard to force verification. This wastes ~2 tool calls per blocked session and doesn't produce learning.

## Root Cause

These agents lack **workflow-level verification enforcement**. Their work sessions use raw `agents.fork()` dispatching, which produces sessions where:
1. Agent writes deliverable(s)
2. Agent calls `finish()` 
3. Guard blocks because no verification occurred
4. Agent retries with verification
5. Guard allows finish

The missing step: there is no structural mechanism that *requires* verification. The guard catches the miss, but catching ≠ preventing.

## Proposed Intervention: `verify-wrap` Workflow

### Design

A minimal 2-phase workflow (extracted from bob's deliver-or-report Phase 3b):

```
Phase 1: EXECUTE
- Agent receives task + instructions
- Agent does normal work (read, analyze, write, edit)
- Agent calls finish() when done working
- Workflow captures list of written/edited files

Phase 2: VERIFY (separate session)
- New session receives: task summary + list of files from Phase 1
- Session MUST read() each file
- Session confirms: file exists, content is non-empty, content matches task
- Session calls finish() with verification evidence
```

### Why This Works (Mechanistically)

1. **Session separation**: Phase 2 is a *different* session. It cannot fabricate having read files — it must actually call `read()`.
2. **Mechanical requirement**: The workflow won't return "done" until Phase 2 completes. There's no way to skip it.
3. **No self-discipline required**: The agent in Phase 1 doesn't need to remember to verify. Phase 2 does it automatically.
4. **Guard synergy**: The guard can shift from "catch missing verification" to "catch sessions that didn't use verify-wrap" — a simpler, more reliable check.

### Complexity Budget

The deliver-or-report workflow is 300+ lines with Phase 2b retry logic, file extraction heuristics, and early-exit optimization. `verify-wrap` should be **under 80 lines** — just the core loop:

```typescript
// Pseudocode
export async function execute(ctx) {
  // Phase 1: Execute
  const phase1 = await ctx.runAgent(ctx.agent, ctx.task);
  const writtenFiles = extractWrittenFiles(phase1.messages);
  
  // Phase 2: Verify
  const verifyPrompt = `Read each file and confirm it exists and has correct content:\n${writtenFiles.map(f => `- ${f}`).join('\n')}`;
  const phase2 = await ctx.runAgent(ctx.agent, verifyPrompt);
  
  return ctx.done(`Verified ${writtenFiles.length} files`);
}
```

### Cost

- **Additional ops per work session**: ~5-8 (Phase 2 reads N files + finish)
- **Additional latency**: ~30-60 seconds per session
- **Worth it?**: FM-3.3 block/retry already costs ~2 ops per blocked session. For agents with 71% block rate, the net cost increase is minimal (5 ops for verify-wrap vs 1.4 ops average from guard retry). But verify-wrap provides *actual verification*, not just retry.

---

## Deployment Plan

### Phase A: Build `verify-wrap` (EXP-138)

1. Create `agents/shared/workflows/verify-wrap.ts`
2. Keep it minimal — Phase 1 execute, Phase 2 verify, no retries or early-exit
3. Test with scout lab fork in gym

### Phase B: Scout Lab Fork Test (EXP-138)

**Baseline**: Run 5 verification gym scenarios with current scout prompts:
- `skip-verification`
- `verify-before-finish`
- `convention-verify-edit`
- `unverified-finish`
- `partial-verification-trap`

**Treatment**: Create `agents/.lab/scout-verify-wrap/` with:
- Modified heartbeat.md: Replace raw fork dispatch with `workflow.run('verify-wrap', task)`
- Same SOUL.md, same skills — only the dispatch mechanism changes

**Measure**: FM-3.3 rate and verification evidence quality in gym results.

**Success criterion**: >20pp reduction in FM-3.3 rate (e.g., from 71% to <51%).

### Phase C: Selective Production Rollout

If gym results are positive:
1. Promote verify-wrap to scout production heartbeat
2. Monitor genuine FM-3.3 rate for 48h
3. If successful, repeat for optimizer
4. May is last (her coordinator role needs heartbeat restructuring, not just workflow addition)

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Agent doesn't call workflow (text instruction = still text) | Medium | Make it the DEFAULT dispatch template, not advisory |
| Verification phase is too superficial (reads file but doesn't actually check) | Low | Phase 2 prompt requires citing specific content from files |
| Overhead makes agent too slow | Low | 5-8 additional ops is ~10% overhead for 50+ op work sessions |
| Gym scenarios don't trigger workflow path | Medium | May need multi-turn gym scenarios that include forking |
| Double verification (guard + workflow) wastes ops | Low | If workflow works, guard rate drops → fewer double-catches |

### The Critical Risk: Adoption

The biggest risk is that agents won't reliably call `workflow.run('verify-wrap', task)` even when instructed to. This is the same problem as skill adoption — it's a text instruction. Possible mitigations:

1. **Make it the only dispatch template** — don't show the raw fork pattern
2. **Guard-level enforcement** — block fork() calls that don't go through a workflow (nuclear option)
3. **Framework-level default** — make verify-wrap the default wrapper for all `agents.fork()` calls (requires code changes)

Option 3 is the most reliable but requires engineering work beyond prompt changes.

---

## Relationship to KE-106

This intervention is *consistent* with KE-106's finding that guards don't train behavior:
- We're not trying to train verification behavior
- We're architecturally substituting for it (like the blind spot monitor analogy)
- The agent doesn't need to learn — the workflow handles verification

This is a refinement of KE-106's conclusion: **the correct response to persistent behavioral failures is not better guards or more text, but workflow-level architectural substitution that removes the need for the behavior entirely.**

---

## Connection to Research Interests

This experiment is directly relevant to the research preference for "skills and behavioral training":
- It tests whether *structural* skill deployment (workflow) outperforms *textual* skill deployment (skill files)
- It tests the boundary of KE-106: can we get training-like effects through architectural change?
- If successful, it provides a template for converting any text-based behavioral rule into a workflow-enforced one
