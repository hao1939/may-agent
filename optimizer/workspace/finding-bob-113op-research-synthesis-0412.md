# Finding: Bob 113-op Research Synthesis Session

**Date**: 2026-04-12  
**Session**: `s_1775957533648_1759` (113 ops)  
**Workflow**: `parallel-research` (run `wr_1775957068232_3ls8`)  
**Parent**: Heartbeat `s_1775957022182_1745` (12 ops)  
**Total tree cost**: 178 ops (12 + 15 + 38 + 113)

---

## Summary

Bob hit 113 ops in a **parallel-research synthesis step** — the step that cross-references results from parallel research threads. This is NOT a D-o-R session and is NOT subject to the D-o-R P1 budget cap. It's a structural gap: the `parallel-research` workflow has **zero op budget on its synthesis step**, and synthesis is an unbounded `callAgent()` call.

## Root Cause Analysis

### The `parallel-research` Workflow

The workflow (`agents/shared/workflows/parallel-research.ts`) has three phases:
1. **FORK**: Run N research threads in parallel via `ctx.runAgent()`
2. **COLLECT**: Gather results from all threads
3. **SYNTHESIZE**: A separate `ctx.runAgent()` call to find cross-thread connections

The synthesis step receives:
- Thread results (truncated to 3000 chars each)
- A generic instruction: "Summarize findings, identify connections, rank by impact, propose next steps, write to markdown"
- **No op budget, no scope constraint, no file-count limit**

### Why This Session Hit 113 Ops

The synthesis task told Bob to cross-reference "guard internalization hypothesis" with "KB integration results". Thread 1 had FAILED (401 auth error), so Bob only had Thread 2 results. Despite having minimal input, the synthesis step:
- Had open-ended instructions ("write synthesis to a markdown file")
- No budget cap to constrain exploration
- Likely read extensively to understand the thread context (KB files, hypotheses, experiments)
- Wrote a comprehensive synthesis document

**Duration**: 13m23s (01:32:13 → 01:45:36)

### Comparison to Other Synthesis Sessions

| Session | Ops | Date | Notes |
|---------|-----|------|-------|
| s_1759 | **113** | Apr 12 01:32 | ← THIS SESSION. 1/2 threads succeeded |
| s_304 | **70** | Apr 9 10:03 | 2/2 threads succeeded. DD-670/671/672 cascade dynamics |
| s_274 | 24 | Apr 9 09:03 | DD-639/640 cross-reference |
| s_1667 | 18 | Apr 11 22:35 | 6 experiment integrations |
| s_1357 | 16 | Apr 11 09:59 | EXP-133 measurement |
| s_1728 | 9 | Apr 12 00:31 | Format Tax research |
| s_1184 | 9 | Apr 11 02:31 | EXP-129 gate stacking |
| s_412 | 8 | Apr 9 14:34 | DD-694/695/696/697 |
| s_1743 | 7 | Apr 12 00:58 | KE-144 cross-reference |
| s_352 | 6 | Apr 9 12:04 | DD-676/677/678 integration |

**Stats**: 10 synthesis sessions total. Avg: 28.0 ops. Median: ~14. Two outliers: 113 and 70.

### Is the D-o-R Cap Bypassed?

**No.** This is a completely different workflow. The D-o-R budget cap ("BUDGET: 15 TOOL CALLS MAX") is specific to `deliver-or-report.ts` Phase 1. The `parallel-research` workflow calls `ctx.runAgent()` which maps to `manager.callAgent()` — a raw agent call with no budget constraint.

However, when `parallel-research` threads are routed through D-o-R (visible in recent data where thread tasks start with "## Phase 1:"), those DO get the cap. The **synthesis step never goes through D-o-R** — it's always a raw callAgent.

## Systemic Pattern

The `parallel-research` workflow is a significant and growing source of ops:

| Workflow Run | Total Ops | Max Session | Date |
|---|---|---|---|
| wr_3ls8 | **166** | 113 (synthesis) | Apr 12 01:24 |
| wr_jnvr | **227** | 79 (thread) | Apr 11 22:26 |
| wr_1xm1 | **106** | 51 (thread) | Apr 11 09:54 |
| wr_u9yj | 74 | 49 (thread) | Apr 12 00:24 |
| wr_lqzs | 68 | 37 (thread) | Apr 11 02:24 |

Bob ran **30 workflow runs in the last ~24h** with total ops ranging from 3 to 227.

## Recommended Fix

### Option A: Synthesis Op Budget (Recommended)

Add a budget instruction to the synthesis task in `parallel-research.ts`:

```typescript
const synthTask =
  `## Task: Research Synthesis — BUDGET: 20 TOOL CALLS MAX\n\n` +
  `${synthesisInstructions}\n\n` +
  // ... rest of task
  `## Constraints\n` +
  `- You have a STRICT budget of 20 tool calls for this synthesis\n` +
  `- Thread results are provided above — do NOT re-read the original files\n` +
  `- Write ONE synthesis file, then stop\n`;
```

**Rationale**: Synthesis has all thread results in its task prompt. It should summarize, cross-reference, and write — not re-read the entire KB. 20 ops is generous (median is 9).

### Option B: Thread Budget Too

Thread steps (Phase 1 fork) also occasionally bloat (e.g., 79 ops in wr_jnvr). Consider routing threads through D-o-R so they inherit the P1 cap, or adding explicit thread budgets:

```typescript
const threadTask =
  `## Research Thread: ${label} — BUDGET: 40 TOOL CALLS MAX\n\n` +
  `${thread.task}\n\n` +
  `Write your findings to a file. Be thorough but focused on this specific thread.\n` +
  `You have a budget of 40 tool calls. Plan accordingly.`;
```

### Expected Savings

If synthesis capped at 20 ops:
- The 113-op session → ~20 ops (93 saved)
- The 70-op session → ~20 ops (50 saved)  
- Other sessions already within budget

Conservative estimate: ~15-20 ops/day saved from synthesis alone (~$0.70-1.00/day).

If thread budgets also added: potentially 30-50 more ops/day saved.

## Classification

- **Type**: Workflow design gap (missing budget constraint)
- **Severity**: Medium — outlier behavior, not a cap bypass
- **Frequency**: ~2/10 synthesis sessions are outliers (>30 ops)
- **Cost impact**: ~$0.70-1.00/day for synthesis; ~$2-3/day including thread bloat
- **Fix complexity**: Low — single-line change to task prompt in parallel-research.ts
