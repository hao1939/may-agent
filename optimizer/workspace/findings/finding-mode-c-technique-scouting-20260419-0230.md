# Finding: Mode C Technique Scouting — Coach Session Efficiency Patterns (6h scan)
**Date**: 2026-04-19 ~02:30 UTC | **Window**: Last 6 hours | **Agent**: coach

## Summary
24 coach sessions in the last 6h. The 154-op session (persistent-task structural intervention) is a clear outlier — 3.2× the next-highest (48 ops). Both received quality=1.0 evaluations, so the difference is efficiency, not quality. Gym-batch adoption continues (93 total mentions, 3 in last 6h window, 92 gym runs).

## Data

| Session | Ops | Task | Quality | Verdict |
|---------|-----|------|---------|---------|
| s_..659 | 154 | Analyze persistent-task structural intervention | 1.0 | good |
| s_..605 | 48 | Design structural intervention for use-persistent-task | 1.0 | good |
| s_..804 | 36 | EXP-186: Auto-detection for persistent-task | - | - |
| s_..741 | 31 | EXP-185: Heartbeat auto-detection | 0.75 | good |
| s_..628 | 29 | Order-compliance gym scenario | 1.0 | good |
| Heartbeats | 3-14 | Various | 1.0 | good/parse_error |

## High-Op vs Efficient Patterns

### 154-op session (s_..659): What drove the cost?
- Task: "Analyze persistent-task structural intervention failure and design..." — analysis + design combo
- This is the pattern identified in previous Mode A finding: **multi-phase tasks** (analyze + design + build) accumulate ops because each phase requires its own context-gathering cycle
- Quality=1.0 means the work was legitimate, not waste

### 48-op session (s_..605): Why more efficient?
- Task: "Design and test structural intervention" — narrower scope (design + test, no analysis phase)
- Single-focus tasks complete faster because they skip the archaeological context-gathering phase

### Key differentiator: **Task scope, not technique**
The 154-op session isn't inefficient — it's doing 3× the work (analyze failure → design fix → implement). The 48-op session has a tighter mandate. This matches the prior Mode A finding (workspace/finding-coach-166op-archaeology-0410.md): high-op sessions correlate with task complexity, not execution quality.

## Reusable Techniques from Efficient Sessions (≤31 ops)

1. **Single-concern tasks** (29-31 ops): Sessions doing ONE thing (build scenario, run experiment) complete in ~30 ops. The 29-op order-compliance scenario build is a good template.
2. **Heartbeat dispatch discipline**: 11 heartbeats averaged 7.5 ops. Coach heartbeats are lean — no exploration bloat.
3. **Experiment-run pattern**: EXP-185 (31 ops) and EXP-186 (36 ops) show structured experiment execution is naturally bounded.

## Gym-Batch Adoption Status
- **93 total gym-batch mentions** across all coach sessions (up from 42+ at Apr 15 measurement)
- **92 gym runs in last 6h** — high experiment activity
- **3 gym-batch mentions in last 6h** — adoption holding steady
- Coach continues to use batch tooling when running experiments

## Recommendation
**NO_DISPATCH**. The 154-op session is legitimate multi-phase work, not a fixable inefficiency. The efficient sessions (29-48 ops) demonstrate that coach already executes tightly when given focused tasks. The remaining optimization lever is task decomposition at the dispatch level — breaking "analyze + design + build" into separate work sessions — but this is already happening naturally (the 48-op and 29-op sessions are decomposed versions).
