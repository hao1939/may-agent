# Cross-Reference: The Workflow Overhead Paradox — EXP-025, CORAL, and the Fixed Cost Hypothesis

**Date**: 2026-04-05
**Author**: Bob (Architect)
**Tags**: #synthesis #H-041 #H-070 #EXP-025 #workflow #overhead

## The Puzzle

EXP-025's prospective validation of H-041 produced a striking asymmetry:
- **HURTS accuracy**: 83% — R reliably predicts when workflow damages performance
- **HELPS accuracy**: 0% — R completely fails to predict when workflow helps

Meanwhile, EXP-026 production data shows R working perfectly: 8/8 directional predictions correct across 464 sessions. Same theory, same R estimates, opposite results.

## The Resolution: Three Converging Insights

### 1. Fixed Cost Threshold (H-070)

Workflow imposes a fixed overhead: planning, phase transitions, compliance checks. In gym scenarios (3-8 decisions), this overhead exceeds the benefit of eliminating any number of decisions. In production (15-50+ decisions), the benefit accumulates enough to exceed the overhead.

This explains the asymmetry: HURTS works because low-R tasks have few eliminable decisions — overhead dominates even MORE. HELPS fails because even high-R tasks in the gym don't have enough total decisions.

### 2. CORAL's Autonomy-Over-Structure Finding (DD#523)

CORAL replaces hard-coded evolutionary heuristics with agent autonomy — agents decide for themselves what to explore, what knowledge to preserve, when to pivot. Result: CORAL outperforms structured approaches (Omni-EPIC, IRIS, ELF) on all benchmarks.

**The relevant insight**: CORAL succeeds because agents have lower coordination overhead than structured alternatives. There's no orchestrator, no messaging protocol, no phase structure — just shared persistent memory and heartbeat reflections. The "fixed cost" is minimized by design.

This maps directly to H-070: CORAL's approach works because `C_fixed` (coordination overhead) is near-zero. All benefit from shared knowledge flows through, undiminished.

### 3. Karpathy's Compiled Knowledge as Overhead Reduction (DD#522)

The LLM Wiki pattern works because it amortizes synthesis cost across all future queries. Each source triggers integration into 10-15 wiki pages (high upfront cost), but every subsequent query benefits from the pre-compiled knowledge (near-zero retrieval cost).

**The relevant insight**: The wiki pattern succeeds by amortizing fixed costs over many uses. A workflow that's invoked once per session can't amortize its overhead. A workflow that's internalized as knowledge (like our handlerConfig skills) amortizes its design cost across all future invocations.

## The Unified Picture

```
Workflow benefit = (R × N_decisions × benefit_per_elimination) - C_fixed
```

Three ways to make this positive:
1. **Increase N_decisions** — tackle larger tasks (production > gym)
2. **Decrease C_fixed** — lighter workflow structure (CORAL's approach)
3. **Amortize C_fixed** — internalize workflow as skill (Karpathy's compilation)

The current implement-and-review workflow has high C_fixed (explicit planning/classification/QA phases). The gym scenarios have low N_decisions. The combination guarantees failure.

## Implications for Our System

1. **Workflow redesign**: Current workflows should have a "lightweight mode" for small tasks. Skip planning/classification when `estimated_N_decisions < 10`.

2. **Skill compilation path**: Workflows that prove beneficial should be compiled into handlerConfig skills (amortizing their design cost). This is H-059 (Cadence Skill Effectiveness) operating at the workflow level.

3. **R is still valid — but as a veto signal**: Use R < 0.25 to BLOCK workflow addition. Don't use R > 0.50 to MANDATE workflow addition. The asymmetric default (H-044, now merged into H-041) is strengthened.

4. **Gym scenario design**: Future gym scenarios should include multi-file, multi-step tasks to test workflow benefit at realistic scales.

## Connected Hypotheses
- **H-041**: Updated with EXP-025 results, P(H) adjusted to 0.72. Now a "veto model" not a "prescriptive model"
- **H-070**: New — formalizes the fixed cost threshold
- **H-059**: Cadence Skill Effectiveness — the mechanism by which C_fixed gets amortized
- **H-055**: Self-Improvement Paradox — workflow improvement requires understanding overhead, which requires the experiments that reveal it
