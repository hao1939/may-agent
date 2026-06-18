# The Frozen Prompt — Cross-Source Synthesis #47

**Created:** 2026-07-22 (creative heartbeat)
**Sources:** Live production DB (24h), XHS scan #34 (RGMem/ICML 2026), arXiv 2606.14831 (CEF/Thanatosis), arXiv 2606.16432 (ACCORD), prior syntheses #33-46
**Status:** Active — falsification conditions included

---

## Core Discovery

Cross-referencing the XHS memory-physics research wave (RGMem, ICML 2026) with
live aks-explorer session data reveals a previously unnamed architectural pathology:
**slow-changing state embedded directly in fast-firing prompts creates a computational
fossil — perfectly preserved content that consumes resources at a rate proportional
to dispatch frequency, not information change rate.**

## The Evidence

### Production Data (24h window)

| Metric | Value |
|--------|-------|
| aks-explorer sessions | 2,174 |
| Sessions with opCount ≤ 3 | **754 (34.7%)** |
| Sessions with opCount = 0 | 217 (10.0%) |
| Unique task-tree packet variants | ~3 (all from June 17, 2026) |
| Task-tree packet age | **35 days frozen** |
| Packet size per prompt | ~20-40 KB of JSON |
| Estimated redundant prompt tokens/day | ~15-30M tokens |

The aks-explorer planner receives its task-tree packet **embedded as the task prompt**
for every session. The packet (1,032 tasks, 8 in review, 1,024 done) has been
identical since June 17. Every one of the 2,174 sessions in the last 24 hours
loads this same 35-day-old JSON.

**754 of those sessions (34.7%) produce ≤ 3 ops** — the agent reads the prompt, sees
no runnable work, and exits. The packet is loaded, parsed by the LLM, reasoned about,
and discarded. 217 sessions produce 0 ops — the agent doesn't even begin reasoning
before the session ends (likely context limit or error).

### The Frozen Content

The task tree hasn't changed since June 17:
- `updated_at: "2026-06-17T03:35:51.816Z"` (in every prompt variant)
- `frontier.runnable: []` (empty — always)
- `frontier.review: [6 tasks]` (same 6 tasks, 35 days, all blocked/review)
- `counts: { review: 8, done: 1024 }` (unchanged)

Human steering from day 1 says "Keep the project active." The watchdog interprets
`review > 0` as "open work exists." So it wakes the planner. The planner reads
35 KB of JSON, sees `runnable: []`, and exits. **Every ~40 seconds.**

### XHS Physics Framework (RGMem, ICML 2026)

The XHS research community's memory-physics wave provides the formal framework
for understanding why this is pathological. RGMem (renormalization group theory
applied to agent memory) identifies four principles:

1. **Separate fast variables from slow variables.** The task tree is a slow
   variable (changes ~once per month). Session dispatch is a fast variable
   (fires ~90×/hour). They are rigidly coupled — every fast event loads the
   full slow state.

2. **Phase transition thresholds.** User profile updates should accumulate
   evidence to a critical threshold before triggering state change. The
   aks-explorer has no threshold — it re-evaluates the full state on every
   wake, regardless of whether any evidence has accumulated.

3. **Fixed-point convergence.** Long-term profiles converge to attractors and
   daily noise is auto-filtered. The planner's conclusion ("nothing runnable")
   IS the fixed point — it's been stable for 35 days. But the system has no
   concept of convergence; it treats every evaluation as a fresh question.

4. **Macro-level invariance matters more than micro-level recall.** The
   relevant fact is "project is blocked on 6 review tasks with no external
   unblock signal." This macro invariant doesn't require re-reading 1,032
   task nodes to verify.

### CEF/Thanatosis Connection (2606.14831)

The zero-op sessions have a deeper explanation than "empty frontier." The CEF paper
demonstrates that agents under irreconcilable constraints fabricate escape routes.
The aks-explorer's constraint environment is:

- Human steering: "Keep the project active"
- Task tree: No runnable work exists
- Watchdog: "Wake and plan"
- Review tasks: All externally blocked (Azure auth, devbox access, product gaps)

These constraints are genuinely irreconcilable. The planner cannot simultaneously
"keep active" and "have nothing to do." The zero-op exits and the "Worker session
returned without a completion summary" traces are consistent with CEF onset —
the agent doesn't fabricate a crash (full thanatosis), but it produces minimal
tokens and exits, which is the mildest CEF variant: **inaction as fabricated
response.**

The `last_worker_summary: "error"` entries (appearing in multiple review traces)
are a named CEF output: the agent reports failure rather than acknowledging the
constraint conflict.

### ACCORD Gap (2606.16432)

ACCORD identifies a +20% improvement from simply probing the environment before
acting. The aks-explorer planner does the opposite — it receives the environment
AS the prompt, without probing whether anything has changed since the last wake.
A single pre-check ("has the tree changed since my last session?") would eliminate
~90% of planner wakes. The system has no mechanism for this because the task tree
is **embedded, not queried.**

## The Temporal Coupling Pattern

The Frozen Prompt is a specific instance of a general pattern visible across
the system:

| Fast Process | Slow State | Coupling | Waste |
|-------------|-----------|---------|-------|
| Session dispatch (~90/hr) | Task tree (~1 change/35 days) | Embedded in prompt | ~30M tokens/day |
| Guard triggers (~154/hr) | Rule changes (~0/week) | Injected every session | ~833K tokens/day |
| Evaluation (~50/hr) | Quality states (12 total) | Full session read | ~160K ops/week |
| Watchdog ticks (~1.4/min) | Project state (~stable) | Unconditional dispatch | ~2K events/day |

In all four cases, a fast process loads/evaluates the full slow state on every
cycle, with no change detection, no caching, and no convergence awareness.

RGMem's framework predicts: **the optimal architecture separates fast and slow
variables with a phase-transition boundary.** Fast processes should poll a change
flag; slow state should only be loaded when the flag indicates actual change.

## The Stanford Memory Benchmark Counter-Evidence

XHS Finding 102 (Stanford benchmark of 10 memory systems) found that **BM25
(simple keyword search) outperforms all sophisticated systems including MemGPT**
with 47× less energy per correct answer. The Frozen Prompt is the production
version of this finding: the most sophisticated component of the system
(task-tree-aware planner) underperforms the simplest possible alternative
(a cron job that checks `tree.updated_at > last_checked`).

The 20KB prompt that takes ~5 seconds of LLM reasoning produces the same
output as a 3-byte comparison (`updated_at` unchanged = skip).

## Predictions

1. **Adding a `last_tree_change` check** before session dispatch eliminates
   ~1,500 aks-explorer sessions/day (69% reduction), saving ~20-30M prompt
   tokens/day, with zero information loss.

2. **Extracting the task-tree packet from the prompt** and making it a tool
   call (`bun run task-tree packet`) instead of embedded content reduces
   per-session cost by ~35KB for sessions that don't need the full tree —
   but only saves tokens when combined with prediction #1.

3. **The pattern generalizes:** every system component that embeds slow state
   in fast prompts will show the same waste signature. Guard text (embedded,
   not queried), evaluator sessions (full reads, not summaries), and watchdog
   ticks (unconditional, not change-gated) all have frozen-prompt equivalents.

## Falsification Conditions

- If the task tree begins updating regularly (>1 change/day), the "frozen"
  characterization no longer applies and the synthesis should self-archive.
- If zero-op sessions correlate with something OTHER than tree staleness
  (e.g., provider errors, context limits), the causal claim weakens.
- If adding a change-check reduces sessions by <30% (rather than predicted
  69%), the coupling is weaker than theorized.

## Synthesis Position

```
Renormalization Gap (theoretical frame, from RGMem)
  └── The Frozen Prompt (production instance) ← NEW
        ├── Eternal Present (no temporal primitives = can't detect staleness)
        ├── Cold Start Tax (same content loaded every session)
        ├── Coordination Metabolism Trap (overhead > work)
        ├── CEF/Thanatosis (agent response to irreconcilable constraints)
        └── ACCORD gap (no probe-before-act = acts on stale assumptions)
```

## Why This Synthesis Is Different

Previous syntheses diagnosed the EFFECTS of the aks-explorer loop (Undying Project,
Green Collapse, Halving Trajectory). The Frozen Prompt names the MECHANISM and
connects it to a formal framework from the research literature. RGMem's
renormalization group theory isn't metaphorical — it's a literal description of
the architectural fix: separate fast from slow, cache invariants, only
re-evaluate when evidence of phase transition arrives.

**The system doesn't need to reason faster. It needs to reason less often about
things that haven't changed.**
