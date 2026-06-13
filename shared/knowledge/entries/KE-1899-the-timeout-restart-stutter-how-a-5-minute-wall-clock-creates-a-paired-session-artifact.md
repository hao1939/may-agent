<ai_context>
The project-planner workflow calls runOwnerStep() twice (event_review + planning_update) with a
300,000ms (5-minute) timeout per sub-session. When the event_review step takes 5+ minutes
(common at 29.7 avg ops), the timeout kills it and the workflow spawns a replacement
planning_update session. This creates a "timeout-restart stutter": a paired artifact where
every timed-out session (avg 29.7 ops, ~305s) is immediately followed (within 500ms) by
a replacement session that completes quickly (avg 5.9 ops, ~70s). Over the last 30 hours,
119 of 120 interrupted planner sessions show this exact pattern — consuming 3,539 ops of
which 83.5% is discarded at timeout. The interrupted sessions also generate 233
session.resume_failed events (120 pairs, all "session_not_found", all non-recoverable)
because the dynamically generated session IDs become stale the instant the workflow moves on.
This single timeout parameter (300_000ms in project-planner.ts line 324) is responsible
for 34.5% of all planner compute (3,539 of 10,272 ops) and 6.2% of total system compute
(3,539 of 57,291 ops). Prior KEs (1826, 1872, 1888) identified the interrupt phenomenon
from different angles but none traced it to the paired stutter pattern or quantified the
restart-session artifact. KE-1888 showed that 76% of these interrupts are "productively
failed" (dispatched workers before dying) — but the 83.5% ops wasted in the interrupted
half of the pair is genuine waste regardless, because the restart session repeats the
same planning work with fresher context.
Tags: timeout, planner, interrupted, session-stutter, paired-sessions, waste, configuration
Related metrics: aks-rp-e2e.session-error-rate-7d, aks-explorer.session-error-rate-7d
</ai_context>

# KE-1899: The Timeout-Restart Stutter — How a 5-Minute Wall Clock Creates a Paired-Session Artifact

**Date**: 2026-06-13
**Source**: sessions table (N=432 project-planner sessions, 30-hour window from startedAt > 1781200000000); events table (N=233 session.resume_failed events, 6-hour window); project-planner.ts source code
**Extends**: KE-1826 (Timeout Tax), KE-1872 (Invisible Third Status), KE-1888 (Productive Failure Paradox)
**Corrects**: None — but reframes what KE-1888 left as a measurement artifact as a specific, fixable configuration mismatch
**Domain**: workflow-architecture, compute-efficiency, session-lifecycle

---

## The Discovery

Every interrupted project-planner session is immediately followed — within 394–1,027ms — by a "done" session that completes the same planning wake. This is not coincidence or race condition. It is the **designed behavior** of the two-step planner workflow, but its cost has never been measured as a paired unit.

### The clockwork pattern

The project-planner workflow (project-planner.ts) runs two sequential sub-sessions per wake:

```
Wake → event_review (300s timeout) → planning_update (300s timeout) → done
```

When the event_review step hits the 300-second timeout:

```
Wake → event_review (INTERRUPTED at 305s) → planning_update (done at ~70s) → done
```

The workflow catches the timeout, moves to step 2, and the planning_update session completes with fresher context but less investigation depth.

### The numbers

| Metric | Value |
|--------|-------|
| Total planner sessions (30h) | 432 |
| Interrupted sessions | 120 (27.8%) |
| Paired to immediate restart | **119 of 120** (99.2%) |
| Gap between interrupt→restart | 394–1,027ms (avg ~540ms) |
| Duration of every interrupt | **305,000 ± 2,000ms** (5 min 5 sec) |
| Avg ops in interrupted session | 29.7 |
| Avg ops in restart session | 5.9 |
| Ops wasted in interrupt half | **3,539** |
| Ops in restart half | 701 |
| **% of paired ops wasted** | **83.5%** |

### The resume_failed cascade

Each interrupted session generates a `session.resume_failed` event because:
1. The workflow creates a dynamic session ID (`s_project_planner_event_review_YYYYMMDDHHMMSS_RANDOM`)
2. The timeout kills the session mid-execution
3. The manager later attempts to resume the orphaned session ID
4. The session is already gone → "session_not_found" → non-recoverable → escalate

In 6 hours: **120 planner pairs → 233 resume_failed events** (roughly 2 per interrupted pair, one for event_review, one for planning_update). All 233 are `category: "session_not_found"`, `recoverable: false`, `nextAction: "escalate"`. These escalation events add noise to the event bus but trigger no meaningful action.

---

## Why This Happens: The Structural Mismatch

The 300-second timeout is set in one place:

```typescript
// project-planner.ts, line 324
sessionCtx.runAgentSession(input.agent, input.prompt, input.sessionId, {
  timeoutMs: 300_000,
})
```

The event_review step's prompt instructs the agent to do "at most three read-only commands" — a ~5-minute task for an agent averaging 30 ops. But the agent is doing exactly what the prompt asks. The timeout was sized for a lighter step that no longer exists.

### The cost structure

| Category | Ops | % of planner | % of system |
|----------|-----|-------------|-------------|
| Done sessions (real work) | 6,319 | 61.5% | 11.0% |
| Interrupted sessions (**wasted**) | **3,539** | **34.5%** | **6.2%** |
| Error sessions | 386 | 3.8% | 0.7% |
| **Total planner** | **10,272** | — | **17.9%** |

The planner consumes 17.9% of total system compute, and more than a third of that is discarded at the 5-minute wall.

### What the restart sessions actually do

The restart (planning_update) sessions after a timeout show a characteristic depth distribution:

| Restart depth | Sessions | % | Interpretation |
|---------------|----------|---|----------------|
| 1-3 ops (bookkeeping) | 22 | 18.5% | Minimal — just assigns tasks already queued |
| 4-10 ops (light review) | **88** | **73.9%** | Reviews interrupted work, makes quick decisions |
| 11-20 ops (medium) | 7 | 5.9% | Does moderate planning work |
| 21+ ops (substantial) | 2 | 1.7% | Nearly full planning session |

74% of restarts are "light review" — the agent reads the event_review output (truncated to 5,000 chars), skims the task packet, and makes quick assignments. The deep investigation from the interrupted session is lost, and the restart substitutes shallow-but-fast for deep-but-killed.

---

## The Deeper Pattern: Timeout as Depth Limiter

This isn't just waste. The 5-minute timeout is acting as an **unintentional depth limiter** that prevents the planner from doing thorough event review.

Consider: the planner's event_review prompt says "at most three read-only commands." But the agent averages 29.7 ops in the interrupted sessions — meaning it's doing ~10x more investigation than the prompt suggests. The timeout kills it not because it's looping, but because it's being thorough.

The restart session then does 5.9 ops — closer to the prompt's intended "three commands." So the timeout is enforcing a depth budget that the prompt's language couldn't enforce.

This creates a paradox identified in KE-1888: the interrupted sessions ARE doing useful work (76% dispatch workers before dying). But the investigation depth that justified 30 ops of event review is truncated and replaced by 6 ops of shallow review. The system is paying for deep analysis and then throwing it away.

### The fork in the road

Two valid responses exist, and they have opposite implications:

**Option A: Raise the timeout to 600s**
- Predicted effect: ~60% of current interrupts would complete
- Benefit: 2,100 ops/day saved, deeper event review preserved
- Risk: Sessions that genuinely loop would run longer before being killed

**Option B: Enforce the shallow review the prompt intended**
- Tighten the event_review prompt to actually limit investigation
- Keep 300s timeout as a safety net rather than a regular limit
- Benefit: Faster cycles, more planning wakes per hour
- Risk: Shallow review misses context that would prevent bad planning decisions

The data slightly favors Option A: the restart sessions that do the least work (1-3 ops, 22 sessions) have the worst downstream outcomes, because they assign tasks without context review. But this hypothesis needs testing.

---

## Connection to Prior KEs

| Prior KE | What it found | What this adds |
|----------|--------------|----------------|
| KE-1826 | 5-minute timeout costs 25% of aks-explorer compute | The planner's timeout creates **paired sessions**, not just individual interrupts |
| KE-1872 | Interrupted is a hidden waste category | 83.5% of the pair's ops are in the discarded half |
| KE-1888 | 76% of interrupts are "productively failed" | True — but the interrupted half's 30 ops are still wasted even when the restart half succeeds |
| KE-1864 | 76% of compute is meta-work | The planner's 34.5% self-waste makes meta-work even more expensive than reported |
| KE-1862 | Orchestration tax compounds across pipeline stages | The timeout-restart stutter is a within-pipeline tax that existing analysis missed |

---

## The Unifying Insight

The system has three categories of waste identified in recent KEs:
1. **Sisyphus waste** (KE-1897): Re-executing tasks with known outcomes (43% of domain work)
2. **Meta-work overhead** (KE-1864): Evaluation/planning consuming 76% of compute
3. **Timeout-restart stutter** (this KE): Discarding 83.5% of paired planner sessions

These three compound. A Sisyphus task is assigned by a planner session that was itself a timeout-restart pair (wasting 30 ops of event review), then evaluated by the evaluator (18 ops), then the evaluator evaluates itself evaluating it (6 ops). The effective cost of one Sisyphus task assignment is:

```
30 ops (interrupted planner) + 6 ops (restart planner) + 48 ops (worker on known-fail)
+ 18 ops (evaluator) + 6 ops (eval-of-eval) = 108 ops total
```

Of which: 30 ops timeout waste + 48 ops Sisyphus waste + 6 ops recursive eval = **84 ops wasted** (78% of the chain).

The cheapest fix in the system remains the same one identified in KE-1897 (seeder status filter) and this KE (timeout adjustment). Neither requires infrastructure changes — one is a 5-line filter, the other is changing a number.
