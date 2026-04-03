# EXP-017: Environmental Nudge for Materialization

**Status**: Designed
**Author**: Bob (Architect)
**Date**: 2026-04-03
**Hypothesis**: Intra-Phase Boundary Analysis (L4: Environmental Nudge)
**Scenario**: `materialize-intermediate-findings`

---

## Question

Does pre-creating a template file in the workspace nudge an agent to materialize intermediate findings more frequently, without any workflow enforcement?

## Background

EXP-016 showed that the `materialize-intermediate-findings` scenario regresses under workflow enforcement (-11%). The workflow approach (L2: Phase Boundary) fragments context between phases. But the underlying behavior — writing intermediate discoveries to a file — is valuable for long tasks.

The Intra-Phase Boundary Analysis (Apr 2) proposes L4 (Environmental Nudge) as an alternative: change the environment so the desired behavior is the path of least resistance. Instead of TELLING the agent to write findings, make writing EASY by pre-creating the file with a template.

## Mechanism

**Generation prior shift**: When the agent reads its workspace at the start of a task and sees `findings.md` with a template, this shifts the generation distribution. The agent is more likely to update an existing file (completing a pattern) than to create a new one (initiating a pattern). The template provides a "slot" that the agent's completion instinct wants to fill.

This is Zone 2 of the Harness Engineering framework (cross-ref-harness-engineering-intra-phase-boundary.md): influencing within-phase behavior through context, not structure.

## Design

### Control Group (5 runs)
- Standard `materialize-intermediate-findings` scenario
- No workspace modifications
- Measure: Does the agent create any findings/notes file and write to it during exploration?

### Treatment Group (5 runs)
- Same scenario
- Pre-create `workspace/findings.md` with template:

```markdown
# Investigation Findings

## Key Discoveries
<!-- Update this as you find relevant information -->

## Open Questions
<!-- Track what still needs investigation -->

## Evidence
<!-- Paste relevant code/output snippets here -->
```

- Measure: Does the agent write to `findings.md` during exploration?

### Metrics

| Metric | How Measured | Primary? |
|--------|-------------|----------|
| **Materialization rate** | % of runs where agent writes to any findings file | Yes |
| **Materialization frequency** | Number of writes to findings files per run | Yes |
| **Finding quality** | Does the findings file contain useful intermediate discoveries (not just final answer)? | Secondary |
| **Task completion quality** | Does the scenario still pass? (no regression from nudge) | Safety |

### Success Criteria
- **P1 (minimum)**: Treatment group materializes in >60% of runs (vs baseline expected ~20-30%)
- **P2 (strong)**: Treatment group materializes 2x more frequently than control
- **P3 (no regression)**: Task completion quality is not worse in treatment group

### Expected Effect Size
Small: +15-30% materialization rate. This is a nudge, not enforcement.

## Cost
~$1-2 (10 runs × ~$0.15/run)

## Analysis Plan

1. Count materialization events in each run (grep for writes to findings/notes files in the session transcript)
2. Compare treatment vs control using Fisher's exact test (small n, binary outcome)
3. If P1 passes, analyze the QUALITY of materialization (useful vs. trivial)
4. Check for regression on the actual task

## What We Learn

| Outcome | Implication |
|---------|-------------|
| **P1 passes** | L4 (Environmental Nudge) works for materialization. Zone 2 harness engineering is viable. |
| **P1 fails, same materialization rate** | Pre-created files don't shift generation prior. The agent ignores environmental defaults. |
| **P1 passes but P3 fails (regression)** | Nudge works but the materialization itself is costly. The agent wastes time updating the file instead of solving the task. |
| **P1 passes strongly (>80%)** | Environmental nudges may be as effective as L2 phase boundaries for soft behaviors. Major finding. |

## Connection to Theory

- **SYNTH-001**: This experiment tests whether Zone 2 mechanisms extend the harness engineering frontier beyond the Zone 1 ceiling
- **Intra-Phase Boundary Analysis**: Directly tests Mechanism 3 (Environmental Defaults)
- **H-043 (Knowledge Utilization)**: Tests U(environmental) for behavioral nudges (currently measured at ~0.5 for factual knowledge)
- **Harness Engineering cross-ref**: Tests the Zone 1 vs Zone 2 distinction empirically

## Sequence

EXP-017 → EXP-018 (Auto-Injection) → EXP-019 (Verify+Redo)

Run in sequence. If EXP-017 shows L4 nudges work, EXP-018 tests L5 (stronger mechanism). If EXP-017 fails, EXP-018 becomes more important (maybe stronger intervention needed).

---

*Designed by Bob (Architect) | 2026-04-03*
