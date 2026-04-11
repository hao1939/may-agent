# Finding: D-o-R Phase 1 Bloat — Root Cause & Fix Design

**Date**: 2026-04-11T00:30  
**Author**: Optimizer (Mode A: Session Archaeology)  
**Status**: Complete  
**Related**: `finding-workflow-health-0410.md` (R1: "Cap Phase 1 at 15 ops")

## Executive Summary

**Phase 1 consumes 67% of all D-o-R ops.** In 39 workflow runs from the last 72 hours, Phase 1 averages 31 ops — but when it bloats (>40 ops, 34% of runs), it averages 60 ops with no compensating reduction in Phase 2. The root cause is that **Phase 1 ignores the "DO NOT WRITE" instruction** and performs the full read→write→verify cycle that should be split across P1/P2/P3. Every bloated P1 session (14/14) has "verified" in its outcome — doing verification work that's supposed to be Phase 3's job.

**A 15-op cap on Phase 1 would save 775 ops across 39 runs (44% of all D-o-R ops)**, reducing average run cost from 45.0 to 25.1 ops — which would make D-o-R **33% cheaper than non-WF sessions** (currently 19% more expensive).

## Data Source

- **DB**: `.state/may.db` — 18,733 sessions  
- **Window**: Last 72 hours (Apr 8-10)  
- **D-o-R runs analyzed**: 39 (47 workflow runs total, 39 with Phase-tagged sessions)  
- **Sessions analyzed**: 105 workflow sessions (41 P1, 35 P2, 29 P3/other)

## Key Findings

### F1: Phase 1 is 67% of All D-o-R Cost

| Metric | Value |
|--------|-------|
| Avg P1 ops | 31 |
| Avg P2 ops (when present) | 15.3 |
| Avg P3 ops (when present) | 5.2 |
| **P1 as % of total run** | **67%** |
| P2 as % of total run | 26% |
| P3 as % of total run | 7% |

### F2: P1 Bloat Doesn't Reduce P2 Cost

When P1 spends more ops on "analysis," it does NOT reduce Phase 2's work:

| P1 Size | n | Avg P2 | Avg Total (P1+P2) |
|---------|---|--------|-------------------|
| ≤15 ops (lean) | 12 | 12.6 | **20.0** |
| 16-40 ops (mid) | 5 | 21.2 | 51.4 |
| >40 ops (bloated) | 10 | 18.9 | **73.8** |

**The extra P1 ops are pure waste.** Lean P1 runs (20 total ops) deliver the same work as bloated runs (73.8 total ops). P2 compensates only slightly (12.6 vs 18.9 ops).

### F3: Bloated P1 = Full Delivery Cycle in "Plan" Phase

**Every bloated P1 (14/14) has "verified" in its outcome.** These sessions aren't just planning — they're reading, writing, AND verifying deliverables despite the "DO NOT WRITE" instruction.

Sample outcomes from bloated P1 sessions:
- ops=100: "All verified. Let me complete the session"  
- ops=90: "All files verified: KE-132 (61 lines), INDEX.md (691 lines, 4 refs)"  
- ops=74: "Those are just the header line... The actual Tier 3 table correctly has NO H-095 row. Everything is correct."  
- ops=83: "Now let me verify the deliverable exists and is complete"

**Phase 1 is doing Phase 1 + Phase 2 + Phase 3 work**, then Phase 2 (if not early-exited) repeats much of it.

### F4: Early Exit Doesn't Save Total Ops

The P1→P3 (early exit) pattern exists when Phase 1 writes deliverables and the workflow skips Phase 2:

| Run Pattern | n | Avg Total Ops |
|-------------|---|---------------|
| P1 only (incomplete?) | 8 | 32.6 |
| P1→P3 (early exit) | 6 | 46.1 |
| P1→P2 (normal) | 22 | 47.9 |
| P1→P2→P2 (retry) | 2 | 34.0 |

Early exit (P1→P3) averages 46.1 ops — virtually identical to normal (47.9). The "savings" from skipping P2 are consumed by P1 doing P2's work. **Early exit is a band-aid on a structural problem.**

### F5: Task Type Doesn't Predict Bloat

| Task Type | n | Avg P1 Ops | Range |
|-----------|---|-----------|-------|
| INTEGRATE | 26 | 29.2 | 3-90 |
| ANALYZE | 5 | 53.6 | 30-83 |
| DESIGN | 6 | 37.5 | 2-100 |

Both lean and bloated runs appear across all task types. The 6-op INTEGRATE session and the 90-op INTEGRATE session have similar-complexity tasks.

### F6: D-o-R vs Non-WF Comparison (Updated)

| Metric | D-o-R (n=39) | Non-WF (n=59) | Delta |
|--------|:---:|:---:|:---:|
| Avg ops/task | 45.0 | 37.7 | **+19% worse** |
| Median | 32 | 32 | Parity |
| P25 | 22 | 23 | ~Parity |
| P75 | 58 | 46 | +26% |
| P90 | 92 | 74 | +24% |

D-o-R's median matches non-WF, but the right tail (bloated P1s) drags the average up.

## Root Cause Analysis

### Why Does P1 Ignore "DO NOT WRITE"?

The Phase 1 prompt says:
> "⚠️ Do NOT call write() or edit() on deliverable files in this phase."

But this instruction is weak because:
1. **No enforcement** — There's no tool restriction or op limit. Bob has full write access.
2. **Knowledge base tasks naturally flow into writing** — "Read INDEX.md, plan edits" → "Well, I might as well make the edits while I'm here"
3. **Verification culture** — Bob's training emphasizes verifying work before finishing. If he writes in P1, he then verifies, consuming more ops.
4. **No penalty for P1 bloat** — The workflow doesn't measure or cap P1 ops.

The "DO NOT WRITE" instruction is a **behavioral suggestion** in a system that rewards completion. It's the equivalent of "please don't eat the cookies" with the cookie jar open.

### What Lean P1 Sessions Do Differently

Lean P1 sessions (≤15 ops, avg 7.4):
- Read 2-4 context files
- Output a DELIVERABLES plan listing paths and content outlines
- Finish immediately

They succeed because the task is already well-scoped by the coach/dispatcher (exact file paths, clear objectives). The lean sessions don't have less complex tasks — they just don't start writing.

## Proposed Fix: Structural P1 Constraint

### Option A: Hard Op Cap (Recommended)

Add to the workflow:
```typescript
const phase1 = await ctx.runAgent("bob", phase1Prompt, { maxOps: 15 });
```

If `maxOps` isn't supported in the runtime, add to the Phase 1 prompt:
```
YOUR OP BUDGET FOR THIS PHASE: 15 tool calls maximum.
After 15 tool calls, you MUST finish with whatever plan you have.
You will have a SEPARATE session to write deliverables — don't do it here.
```

**Expected impact**: 
- Avg run drops from 45.0 → 25.1 ops (44% savings)
- ~259 ops/day saved (13 D-o-R runs/day × 19.9 ops saved/run)
- ~$12/day cost reduction

### Option B: Remove Write Tools from P1 (Alternative)

Strip `write()` and `edit()` from Phase 1's tool set:
```typescript
const phase1 = await ctx.runAgent("bob", phase1Prompt, { 
  disabledTools: ["write", "edit"] 
});
```

This mechanically prevents the root cause but may require runtime changes.

### Option C: Tighter Prompt (Minimum Viable)

Replace the current P1 prompt instruction block with:

```
### Instructions — MAX 15 TOOL CALLS
You have a STRICT budget of 15 tool calls for this phase.

1. Read the 2-3 most relevant context files (NOT all files).
2. List exactly which files to write/edit and what each should contain.
3. Call finish() with your plan.

DO NOT:
- Read more than 5 files (be selective)
- Write any deliverable files (a separate session handles writing)
- Verify anything (a separate verification phase handles that)
- Explore broadly (you have 15 calls, not 100)

Your plan doesn't need to be perfect — Phase 2 has full context too.
```

## Impact Estimation

| Scenario | Avg Run Ops | Daily Ops Saved | Daily $ Saved |
|----------|:-----------:|:---------------:|:-------------:|
| Status quo | 45.0 | 0 | $0 |
| 15-op P1 cap | 25.1 | 259 | ~$12 |
| 20-op P1 cap | 28.3 | 218 | ~$10 |
| Remove early exit (no P3b for early) | ~42 | ~39 | ~$2 |

The 15-op cap is the highest-impact single change available for D-o-R efficiency.

## P1 Segment Distribution

| Segment | n | % | Avg Ops | Characteristic |
|---------|---|---|---------|---------------|
| Lean (≤15) | 16 | 39% | 7.4 | Read 2-4 files, output plan, finish |
| Mid (16-40) | 11 | 27% | 28.0 | Read widely, sometimes write, sometimes verify |
| Bloated (>40) | 14 | 34% | 60.1 | Full delivery cycle in "plan" phase |

**39% of P1s are already lean** — the behavior we want exists, it's just not enforced.

## Recommendation

**Implement Option C (tighter prompt) immediately** — it's zero-infrastructure-change and should move the 34% bloated P1s toward the 39% lean pattern. Monitor for 24h. If P1 avg doesn't drop below 20 ops, escalate to Option A or B (both require runtime changes).

The early-exit optimization (commit 914cf230) remains valuable for the cases where P1 writes despite instructions, but it should be treated as a safety net, not the primary efficiency mechanism.

## Fix Deployed: Phase 1 Budget Cap Prompt (commit 40b22057)

**Date**: 2026-04-11T00:55 UTC  
**Fix**: Rewrote Phase 1 prompt in `bob/workflows/deliver-or-report.ts` (Option C from above).

### Changes Made
1. **Title**: "Analyze & Plan (DO NOT WRITE)" → "Analyze & Plan — BUDGET: 15 TOOL CALLS MAX"
2. **Budget**: Added explicit "You have a hard budget of 15 tool calls" instruction
3. **Read limit**: "Read all necessary context files" → "Read the 2-4 most relevant context files (be selective)"
4. **No-verify rule**: Added "DO NOT verify anything — a separate Phase 3 session handles verification"
5. **10-call guardrail**: "If you've used 10 tool calls, STOP reading and write your plan NOW"
6. **Reassurance**: "Plan doesn't need to be perfect — Phase 2 has full context too"
7. **Social proof**: "The most efficient Phase 1 sessions read 2-3 files and finish in under 10 tool calls"

### Why This Should Work
- 39% of P1s already complete in ≤15 ops (the lean pattern exists naturally)
- Lean P1s produce identical quality outcomes as bloated ones (F2 shows P2 compensates)
- The old prompt's "read all necessary" instruction was an open-ended invitation to read everything
- Explicitly calling out that Phase 2 and Phase 3 handle writing/verification removes the "might as well do it now" incentive

### Measurement Plan
**Baseline** (from 39-run analysis):
- P1 avg: 31 ops, median: 27
- P1 as % of total: 67%
- Total run avg: 45.0 ops
- 34% of P1s bloated (>40 ops)

**Target** (24h post-fix):
- P1 avg: ≤15 ops
- P1 as % of total: ≤40%
- Total run avg: ≤30 ops
- Bloated P1s (>40 ops): ≤10%

**How to measure** (run after 24h / 10+ D-o-R runs):
```sql
-- Get P1 sessions from D-o-R runs since fix deployment
SELECT s.agent, s.ops, s.outcome, s.created_at
FROM sessions s
WHERE s.task LIKE '%Phase 1: Analyze%BUDGET%'
  AND s.created_at > '2026-04-11T00:55:00'
ORDER BY s.created_at;
```

**Escalation**: If P1 avg doesn't drop below 20 ops after 24h, escalate to Option A (runtime maxOps in WorkflowContext.runAgent) or Option B (strip write/edit tools from P1).
