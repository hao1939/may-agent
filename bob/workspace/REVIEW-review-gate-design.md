# Design Review: Automated Review Gate — Code Merge Requires QA

**Reviewer:** Bob (Architect) · **Date:** 2026-04-15 · **File:** `shared/may-agent-docs/design/review-gate.md`

## Verdict: Approve with Notes

The three-mode structure (A: workflow guard, B: session subscriber, C: behavioral heartbeat) is architecturally sound. Mode C first is correct — behavioral before structural, consistent with our code-vs-data principle.

## What's Good

1. **Correct implementation order.** Mode C (behavioral/zero code) first is exactly right. This is the cheapest to deploy and test, and the feedback from it informs whether Modes A/B are even needed.

2. **Three modes are complementary, not redundant.** Preventive (A) + Detective (B) + Judgmental (C) covers different failure modes. This matches defense-in-depth thinking.

3. **Light touch on the subscriber.** The `createReviewGate` function is simple — check for branch, dispatch review if it exists. No complex state management.

## Concerns / Pushback

### 1. Mode B trigger should be `session_end`, not "cron scan" (naming confusion)
The table header says "Proactive Cron Scan" but the implementation is a `session_end` subscriber. These are different things:
- A **cron scan** runs on a timer regardless of sessions (catches stale branches, direct pushes)
- A **session_end subscriber** only fires when a session closes

The current code implements a subscriber, not a cron. The Coverage Analysis section claims Mode B catches "stale review branches" — it can't, because it only fires on session_end. Either:
- Rename to "Session-End Review Subscriber" and drop the stale-branch claim, OR
- Actually implement a cron scan (but that's more complex)

**Recommendation:** Rename it. A subscriber is simpler and catches the main failure mode (agents merging their own branches). A separate cron scan can be Phase 5 if stale branches become a real problem.

### 2. Review scope question (Open Question #1) — answer it in the design
Reviewing ALL review branches including workspace-only changes creates busywork that will train May to rubber-stamp reviews. This dilutes the gate's value.

**Recommendation:** Only trigger for branches touching `src/`, `agents/shared/protocols/`, `agents/shared/may-agent-docs/`, or any `.ts` files. Workspace-only branches (markdown in `agents/*/workspace/`) should pass through without review. State this in the design.

### 3. Missing: what does "system-scope" mean concretely?
The design says "If system-scope → flag for Hao approval" but doesn't define system-scope. Without a definition, Mode B devolves into May making arbitrary judgment calls about what's "system" vs "agent" scope — exactly the kind of fuzzy gate that gets bypassed.

**Recommendation:** Add a concrete definition:
- **System-scope** = changes to `src/` (runtime code), `agents/shared/protocols/` (cross-agent contracts), workflow definitions, guard logic, session management
- **Agent-scope** = changes to `agents/<name>/` (single agent's workspace, context, skills), knowledge entries, experiment results

### 4. Who merges? (Open Question #3) — take a position
"Can May merge autonomously for agent-scope changes?" — Yes, she should. The whole point of the gate is to prevent system-scope changes from slipping through. If every agent-scope merge also needs Hao, the gate becomes a bottleneck that incentivizes bypassing.

**Recommendation:** May merges agent-scope autonomously. System-scope requires Hao approval. State this as a decision, not an open question.

### 5. Mode A is underspecified
"Write the `gatekeeper` workflow guard" — what does this actually do? Which workflow steps does it intercept? The design gives detail for B and C but waves hands at A.

**Recommendation:** Either flesh out Mode A or explicitly defer it: "Mode A deferred until Mode B/C prove the concept and reveal which workflow steps need inline interception."

## Answers to the Open Questions

1. **Review scope:** Only `src/`, shared protocols, and `.ts` files. Workspace markdown doesn't need review. (See concern #2.)
2. **Who reviews?** May is fine. A dedicated QA agent is premature — we'd need evidence that May's reviews are bottlenecked or low quality first.
3. **Merge authority:** May merges agent-scope autonomously. System-scope needs Hao. (See concern #4.)

## Minor

- Line "5. **May's heartbeat update:** Bob — what should the exact heartbeat text say..." appears orphaned in the Design Decisions section. Looks like a leftover from collaborative editing. Clean it up.
- The Mode names in the table (A/B/C) don't match the section order (B then C then the vague mention of A). Reorder sections to match A→B→C.

## Bottom Line

Ship Mode C (behavioral heartbeat addition) now. Clean up the naming confusion between "cron scan" and "session subscriber" in Mode B, add the system-scope definition, and answer the open questions before implementing Mode B. Defer Mode A until B+C prove the concept.

---
*Review complete. Ready for May/Hao to proceed with Mode C deployment.*
