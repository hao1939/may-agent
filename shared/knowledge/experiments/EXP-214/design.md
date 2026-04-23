# EXP-214: Structural Enforcement for C7.1 (Forbidden Paths)

**Date**: 2026-07-30
**Status**: DESIGNED
**Coach**: coach
**Predecessors**: EXP-188 (text injection 0% vs finish-guard 100% for workflow adoption)

## Research Question

Can a structural bash-wrapper guard eliminate C7.1 violations (forbidden absolute paths) where extensive text instructions have failed?

## Background

**amy** has 53.4% C7.1 pass rate despite having explicit instructions in BOTH SOUL.md and context.md:
- SOUL.md: "NEVER run `cd /home/...` or `cd ~/` — those paths do not exist."
- context.md: "Project root is /app — do not use /home/*, /Users/*, /root/*, or ~/ paths"

This mirrors EXP-188's finding: text-based instructions have ~0% behavioral compliance for structural behaviors. The agent reads the instruction, does the work anyway, and calls finish(success).

**amy-kimi** likely has the same issue (C1.3 at 50% despite text instructions).

## Hypothesis

**H-214a**: A bash command pre-check that returns an error message when forbidden paths are detected will reduce C7.1 violations to <10%, matching EXP-188's structural enforcement pattern.

**H-214b**: The current text instructions could work if moved to a "checkpoint" position — a mandatory verification step the agent performs before each bash call (analogous to the read-before-edit checklist for C1.1).

**H-214-null**: C7.1 violations are caused by the underlying model defaulting to /home/ paths regardless of instructions, and only model-level changes can fix this.

## Design

### Phase 1: Gym Validation (3 arms × 5 trials = 15 runs)

**Scenario**: A task requiring amy to browse web content and save results — her typical workflow that triggers /home/ path usage.

| Arm | Intervention | N |
|-----|-------------|---|
| A | Baseline (current SOUL.md + context.md text) | 5 |
| B | Bash wrapper: intercepts commands containing forbidden prefixes, returns error + correction hint | 5 |
| C | Pre-flight checklist: insert "Before running bash: verify no /home/ or ~/ paths" as the first line of every bash command template | 5 |

### Measurement
- Primary: C7.1 pass rate per arm
- Secondary: Task completion rate (ensure guard doesn't break the task)
- Tertiary: Number of correction attempts (does the agent self-correct after error?)

### Success Criteria
- Arm B achieves >90% C7.1 compliance without reducing task completion
- Clear separation between structural (B) and text-based (A, C) arms

## Implementation Notes

The bash wrapper approach would work like:
```bash
# In the agent's bash environment, add a pre-check:
# If command contains /home/ or ~/ or /Users/ or /root/, return error
```

This could be implemented as a shell function wrapper or as a guard in the agent framework's bash execution layer.

## Next Steps
1. Create gym scenario for amy web-browsing task
2. Implement bash-wrapper guard (coordinate with tech-lead)
3. Run trials
4. Write results, promote or reject
