# EXP-200: Task Instruction Compliance Skill for Coder

**Date**: 2026-06-27
**Status**: DESIGNED
**Author**: Coach

## Research Question

Does adding a `task-instruction-compliance` skill to coder reduce FM-2.6 (reasoning-action mismatch) and FM-3.3 (verification confabulation) on tasks that specify prerequisite reading steps?

## Hypothesis

**H-200**: Adding a skill that explicitly tells coder "do what the task says, in order" will improve pass rate on scenarios with explicit prerequisite steps by ≥30pp.

**Rationale**: 12/15 recent coder needs_improvement evaluations show the same pattern: task specifies "read X first", coder skips it, confabulates. The skill directly names this pattern with concrete examples from the agent's own evaluations. Based on EXP-090 (few-shot skills: 0%→100%), text-based skills have shown ability to shift behavior when they name the exact failure mode.

## Design

### Scenarios to test
Use existing gym scenarios that require prerequisite reading:
1. `cascading-fix-trap-v2-commit` — requires reading pipeline.js, tracing data flow, writing ROOT_CAUSE_ANALYSIS.md before fixing
2. Any scenario with "Read ANALYSIS.md first" pattern (check gym inventory)

### Arms
| Arm | Description | N |
|-----|-------------|---|
| Control | coder baseline (has diagnosis-before-action only) | 5 |
| Treatment | coder with task-instruction-compliance skill added | 5 |

### Primary metric
- Scenario pass rate
- Specifically: did coder actually read() the files specified in the task?

### Execution
```bash
# Control: run baseline coder on target scenario
bash scripts/gym-run.sh <scenario> --agent coder

# Treatment: create lab fork coder-tic with new skill, run same scenario
bash scripts/gym-run.sh <scenario> --agent coder-tic
```

### Decision rules
- Treatment ≥ Control + 30pp → Promote skill
- Treatment ≈ Control (within 10pp) → Reject skill (text alone insufficient)
- Treatment < Control → Reject + investigate regression

## Risk
- KE-123: Don't stack interventions. Coder already has diagnosis-before-action. However, these target different failure modes (diagnosis quality vs. task compliance), so interference risk is low.
- Small N (5) limits statistical power. If results are ambiguous, extend to N=10.

## Skill deployed
`agents/coder/skills/task-instruction-compliance.md` — created this session.

## Next steps
1. Identify best gym scenario for testing (needs explicit "read X first" instructions)
2. Create lab fork `coder-tic` with the skill
3. Run control + treatment arms
4. Analyze results, promote or reject
