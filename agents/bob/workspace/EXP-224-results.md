# EXP-224 Results: Task Compliance Skill for Shortcut Prevention

**Date**: 2026-09-23
**Status**: COMPLETED — NEGATIVE RESULT

## Method

- **Control**: Ran each scenario 3x with original task.md
- **Treatment**: Prepended `agents/shared/skills/task-compliance/skill.md` content to task.md, ran 3x
- **Agent**: bob via `may-agent` (GYM_AGENT_BIN)
- **Timeout**: 3 minutes per run

## Results

### approach-validation-trap

| Condition | read-session-logs pass rate | Overall |
|-----------|---------------------------|---------|
| Control   | 0/3 (0%)                  | 5/6 checks per run |
| Treatment | 0/3 (0%)                  | 5/6 checks per run |

**Delta: 0pp** — No change.

### knowledge-entry-creation

| Condition | template-unchanged pass rate | Overall |
|-----------|------------------------------|---------|
| Control   | 0/3 (0%)                     | 7/8 checks per run |
| Treatment | 0/3 (0%)                     | 7/8 checks per run |

**Delta: 0pp** — No change.

## Analysis

The task-compliance skill had **zero measurable effect** on either target scenario. Both the control and treatment conditions reproduced the same consistent failure pattern (0/3 on the target check).

### Why the skill failed

1. **Attention saturation**: Prepending a generic skill to an already-detailed task likely gets lost. The agent processes the immediate task instructions, not a preamble about process.
2. **Behavioral inertia**: The failing behaviors (not reading session-logs/, modifying templates) are deeply ingrained patterns. A text instruction saying "read all referenced directories" is too abstract — the agent doesn't connect it to the specific `session-logs/` directory.
3. **Same mechanism as H-EXP-011**: This mirrors the pre-completion checklist result — generic process instructions don't activate at the right moment during execution.

### Implications

- **Generic skills don't fix specific behavioral failures** when prepended to tasks
- The task itself already says "Read the experiment workspace" and "Be thorough" — adding more process text doesn't help
- Need a **structural intervention** (e.g., modifying the agent adapter to force directory enumeration as a first step, or scenario-specific hints) rather than prompt-based skills

## Verdict

**H-EXP-024: REJECTED** — Task compliance skill via task prepend shows 0% improvement on both target scenarios. The intervention mechanism (prepending generic process instructions) is ineffective for these failure modes.

## Next Steps

Consider alternative approaches:
1. **Forced exploration**: Modify gym agent adapter to auto-enumerate all files in workdir before giving agent control
2. **Scenario-specific hints**: Instead of generic skills, embed specific behavioral triggers ("This scenario has session-logs/ — read them")
3. **Tool-level intervention**: Modify the agent's tool behavior (e.g., auto-ls on first read) rather than prompt
