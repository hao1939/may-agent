# EXP-199: Tool-Assisted Relational Bug Discovery

**Date**: 2026-06-22
**Status**: COMPLETED
**Predecessor**: EXP-195 (hint +30pp), EXP-198 (procedural skill, pending)
**Hypothesis**: H-181 (Relational Bug Blindness) — P-181b structural intervention

---

## Research Question

Can providing a pipeline-swap tool help agents discover relational bugs they cannot find through instructions alone?

## Background

H-181 evidence chain so far:
- **EXP-177**: Agents find value bugs 100%, ordering bugs 0%. Hints don't help. (N=80)
- **EXP-194**: Retrospective confirms relational bugs have systematically lower pass rates.
- **EXP-195**: Direct hint +30pp (10→40%). Generic skill 0%. Procedural skill 0%.
- **EXP-198**: Procedural discovery skill (DESIGNED, not yet run).

Key insight: The bottleneck is **discovery**, not fixing. Agents can fix ordering bugs once told where they are, but can't find them through reasoning or instructions. The next lever is **tool-assisted discovery** — give the agent a tool that automates the permutation search.

## Hypothesis

- **H-199a**: A `swap-pipeline-steps` tool that lets the agent swap two adjacent pipeline steps and run tests will raise cascading-fix-trap-v2 pass rate to **≥40%** (matching the direct-hint condition from EXP-195)
- **H-199b**: The tool + a brief usage instruction ("after fixing value bugs, try swapping adjacent pipeline steps") will reach **≥50%** (tool + procedural guidance > tool alone)
- **H-199-null**: Tool provides ≤15% (agents don't use the tool unprompted, or use it incorrectly)

## Design

### The Tool

A bash script `swap-steps.sh` placed in the scenario workspace:

```bash
#!/bin/bash
# Usage: ./swap-steps.sh <file> <step1_name> <step2_name>
# Swaps the order of two adjacent pipeline operations and reports test results.
# Example: ./swap-steps.sh src/pipeline.js applyPenalties normalize

FILE="$1"; STEP1="$2"; STEP2="$3"
# Implementation: sed-based swap of function call order in the pipeline
# Then run tests and report pass/fail delta
```

This externalizes the permutation procedure that agents fail to execute from instructions (EXP-195 Arm B 0%). The tool does the mechanical work; the agent only needs to decide which pairs to try.

### Arms

| Arm | Intervention | N | Notes |
|-----|-------------|---|-------|
| A | Baseline (no tool, no hint) | 10 | Re-use EXP-195 baseline if <60 days old |
| B | Tool available (swap-steps.sh in workspace, mentioned in file listing) | 10 | Tests implicit discovery |
| C | Tool + usage instruction in task.md | 10 | Tests tool + procedural nudge |
| D | Direct hint only (no tool, same as EXP-195 Arm D) | 10 | Calibration arm |

### Scenario

- Primary: `cascading-fix-trap-v2` (10% baseline, pipeline ordering bug)
- Transfer: If B or C work, test on `ghost-dependency-debug` (different relational structure)

### Metrics

- Primary: pass rate (all checks pass)
- Secondary: `pipeline-order-fixed` check pass rate (ordering bug specifically)
- Tertiary: tool invocation count (did agent discover and use the tool?)
- Quaternary: time-to-first-swap-attempt (measures exploration speed)

### Decision Rule

- **H-199a confirmed** if: Arm B ≥ 30% AND B > A (p < 0.20 Fisher's)
- **H-199b confirmed** if: Arm C ≥ 40% AND C > B
- **H-199-null supported** if: B ≤ 15% (tool not discovered/used)
- **Key comparison**: C vs D (tool+instruction vs direct hint). If C ≥ D, tool-assisted is as good as knowing the answer — major win for transferability.

## Implementation Notes

### swap-steps.sh design

The tool must be:
1. **Discoverable** — listed in workspace, has --help, named clearly
2. **Safe** — creates backup, reverts if tests don't improve
3. **Informative** — reports test delta clearly ("Before: 3/7 pass. After swap: 5/7 pass. +2 tests!")
4. **General** — works on any pipeline file, not just the specific bug

### Scenario variant creation

Create `cascading-fix-trap-v2-exp199-tool/` with:
- Same codebase as original
- `swap-steps.sh` added to workspace root (Arm B, C)
- task.md modified for Arm C only (add tool usage instruction)

## Cost Estimate

- 40 trials × ~$0.50 = ~$20
- Scenario setup: ~1 hour

## Blocked On

- Gym infrastructure fix (EXP-190) for `--lab` flag, OR
- Manual scenario variant creation (workaround — create separate scenario dirs)

## Why This Matters

If tool-assisted discovery works, it's a **deployable intervention** — we can ship swap-step tools (and generalized permutation-testing tools) with production tasks. This is the structural fix H-181 needs, unlike prompt-level interventions which have hit their ceiling at 40%.
