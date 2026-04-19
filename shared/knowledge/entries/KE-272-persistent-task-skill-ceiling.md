# KE-272: TRIGGER/ACTION/EXAMPLE Skill Pattern Achieves 75% on Interruptive Behavior — Challenging H-162 Cell C Ceiling

**Date**: 2026-04-19
**Source**: EXP-186
**Confidence**: Medium (N=4 treatment, N=3 baseline — small sample)
**Connects**: H-162 (compliance topology), H-091 (skill delivery methods), KE-007 (structural enforcement), KE-021 (process skills)

## Core Finding

A TRIGGER/ACTION/EXAMPLE skill file + SOUL.md critical rule section achieved **75% (3/4)** compliance on persistent-task workflow adoption, against a **0% (0/3)** baseline. This is an interruptive behavior (requires the agent to pause its natural heartbeat flow and invoke a workflow), yet the result far exceeds H-162's Cell C prediction of 0-15% for behavioral signaling on interruptive behaviors.

## Evidence

- **Baseline**: 0/3 (0%) — coach agent on `use-persistent-task` gym scenario, no intervention
- **Treatment**: 3/4 (75%) — skill file with TRIGGER/ACTION/EXAMPLE pattern + SOUL.md critical behavioral rule, `struct-persistent-task-v2` lab fork
- **Prior context**: EXP-184 showed exact-command-in-task = 100% (N=?), EXP-185 showed generic procedural step = 0%
- **The skill combined two mechanisms**: structured pattern (TRIGGER condition → ACTION command → EXAMPLE usage) AND SOUL.md rule section reinforcement

## Mechanism / Why

The TRIGGER/ACTION/EXAMPLE pattern may partially bridge the gap between pure text rules (Cell C: ~0%) and structural enforcement (Cell D: ~100%) because it:
1. **Reduces inference steps** — the skill provides the exact workflow.run() call, not just "remember to do X." This is closer to EXP-184's exact-command approach than EXP-185's generic instruction.
2. **Uses task-adjacent delivery** — SOUL.md rules sit in system prompt but the TRIGGER pattern creates a conditional-execution frame that may get elevated attention vs passive rules.

However, 75% ≠ 100% — the remaining 25% failure rate is consistent with the fundamental fragility of text-based enforcement on interruptive behaviors. The skill works _most_ of the time but lacks the architectural guarantee of structural enforcement.

## Implications

### 1. H-162 Cell C ceiling may be higher than 15% with optimized skill patterns
The 0-15% prediction holds for generic text rules but structured TRIGGER/ACTION patterns with exact commands can reach ~75%. H-162 may need a refinement: Cell C splits into C1 (generic text rules: 0-15%) and C2 (structured skill with exact commands: 50-80%).

### 2. "Inference steps" is a key mediating variable
EXP-184 (exact command, 100%) > EXP-186 (skill with exact command, 75%) > EXP-185 (generic step, 0%). The gradient tracks the number of inference steps between instruction and action. This suggests a refinement axis for H-091's delivery position framework.

### 3. Programmatic injection still wins for production
75% is impressive for a text intervention but insufficient for critical workflows. The EXP-186 design.md's handler-level auto-detection approach (which would achieve ~100% like EXP-184) remains the correct production path.

## Actionable

- For non-critical interruptive behaviors where 75% is acceptable, TRIGGER/ACTION/EXAMPLE skills are a viable low-infrastructure option
- For critical interruptive behaviors (persistent-task adoption), invest in programmatic injection (handler code) per EXP-186 design
- Update H-162 with a Cell C refinement noting structured skills can exceed the 15% ceiling

## Open Questions

- Would the 75% hold with larger N? (4 trials is low — 95% CI is roughly 33-97%)
- Does the SOUL.md rule add value over the skill alone? (No ablation was run)
- Would this pattern generalize to other interruptive behaviors (e.g., forced verification, read-before-edit)?
