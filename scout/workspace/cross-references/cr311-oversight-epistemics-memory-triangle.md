# CR#311: The Oversight-Epistemics-Memory Triangle

**Date**: 2026-04-07
**Sources**: DD#622 (FileGram), DD#623 (Human Oversight), DD#624 (AI Aggregation)

## Pattern

Three papers from the same April 6-7 batch converge on a single architectural challenge: **how do multi-agent systems maintain reliable knowledge while governing agent behavior?**

The triangle:

```
       OVERSIGHT (DD#623)
      /              \
     /    Agent       \
    /    System        \
   /                    \
MEMORY (DD#622) ——— EPISTEMICS (DD#624)
```

1. **Memory ↔ Oversight**: FileGram's behavioral traces serve dual purpose — they personalize agent behavior AND provide oversight data. What agents remember determines what overseers can monitor. Oversight without behavioral memory is blind (DD#623's finding that event-driven monitoring requires knowing what events to watch for).

2. **Oversight ↔ Epistemics**: Oversight strategies themselves introduce aggregation bias (DD#624). A monitor that aggregates multiple agent outputs to detect anomalies will show the same majority amplification / minority suppression effects. The monitor may suppress genuine innovations as anomalies.

3. **Memory ↔ Epistemics**: Memory consolidation IS aggregation. Every time DD#559's buffer→episodic→semantic pipeline compresses memory, it's performing AI aggregation with all the epistemic risks DD#624 identifies. FileGram's behavioral traces may be more epistemically honest because they're raw observations rather than aggregated summaries.

## Synthesis

The current GUS architecture (through M48) treats memory, oversight, and epistemics as separate concerns. These three papers suggest they're tightly coupled:

- **Memory architecture choices determine oversight capability** (you can only monitor what you remember)
- **Oversight mechanisms distort knowledge** (monitoring introduces aggregation bias)
- **Epistemic quality constrains memory utility** (unreliable knowledge isn't worth remembering)

## Recommendations

1. **Unified behavioral trace layer**: Implement FileGram-style behavioral traces that serve both memory and oversight (M49 + M50 synthesis)
2. **Diversity-aware consolidation**: Memory consolidation should track epistemic diversity scores (M51), not just information density
3. **Oversight self-awareness**: Monitoring systems should account for their own aggregation biases — a meta-monitor that checks whether the monitor is suppressing minority signals

## Connects To
- CR#305 (Memory-Intelligence Convergence) — Three Laws need oversight and epistemic riders
- CR#299 (Agent Communication Stack) — L4 Semantics + L6 Governance interaction
- CR#303 (Trust Calibration) — trust as the interface between oversight and epistemics
- CR#310 — builds on knowledge integration themes
