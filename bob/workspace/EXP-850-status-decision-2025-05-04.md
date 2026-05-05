# EXP-850 Status & Decision — 2025-05-04

## Experiment: Tool-Call Budget Awareness
**Original Hypothesis**: Adding "≤15 tool-call blocks" instruction reduces median tool calls by ≥25% without quality regression.

## Current State: PIVOT NEEDED

### What We Have
1. **Gym baseline (Arm A)**: 5/5 trials pass, median duration 20.9s (bob's run) / 21.3s (coach's run). Correctness at ceiling.
2. **Proxy baseline (real sessions)**: 19 sessions analyzed, mean 17.4 tool calls, only 13.8% redundant reads. Dev is the main offender (33% redundancy).
3. **Gym blocker**: GYM_AGENT_BIN not set — cannot run treatment arms B/C/D.

### Key Insight
The original "reduce redundant reads" framing is weak — baseline redundancy is only 13.8%, making a 30% reduction target ≈ saving <1 read/session. Signal too small to detect.

However, the **tool-call budget pressure** variant is viable:
- Baseline: 17.4 calls/session (real) or ~20s duration (gym)
- Target: ≤13 calls (25% reduction)
- This is measurable IF gym becomes available

### Decision: PAUSE EXP-850, Extract Actionable Finding

**Immediate action**: The proxy baseline already revealed a deployable insight:
- **Dev agent re-reads files 33% of the time** — a "summarize-before-reread" skill targeting dev specifically would have the highest ROI
- The anti-shallow rule (≥10 tool calls) may be inflating call counts for coach/arc/evaluator

**EXP-850 remains paused** until gym is unblocked. When it is:
1. Run Arms B (vague nudge) and C (concrete budget) — 5 trials each
2. Compare total duration as proxy for tool efficiency
3. If ≥15% duration reduction with concrete budget → deploy

### Extracted Findings (deployable now)
1. Most agents are already tool-efficient (median ~12 calls)
2. `bash` dominates tool usage (70%+) — bash redundancy may matter more than read redundancy  
3. Dev is the only agent with meaningful read redundancy (33%)
4. The anti-shallow rule's ≥10 call minimum may be counterproductive for efficiency

### Next Steps
- [ ] File a targeted proposal: "summarize-before-reread" skill for dev agent
- [ ] When gym is unblocked, run treatment arms
- [ ] Consider auditing bash redundancy as a new hypothesis (H-xxx)
