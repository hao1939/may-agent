# EXP-008: Verify-After-Edit Skill Effectiveness

**Date**: 2026-04-02
**Hypothesis**: The `verify-after-edit` skill installed in coder/skills/ causes the agent to read files back after editing, improving pass rate on convention-verify-edit scenario's C2.3 check.

**Background**:
- Session context from 2026-04-01 noted that coder passes product checks (3/3) and C3 (JSON validation) but fails C2.3 (verify-after-edit — doesn't read file back after editing)
- The verify-after-edit skill was installed at some point
- A baseline run on 2026-04-02 showed 5/5 pass with the skill installed
- Need to confirm the skill is the cause by running without it

**Design**:
- **Control (no-skill)**: Run convention-verify-edit with `--lab coder-no-verify-skill` (coder without verify-after-edit.md)
- **Treatment (with-skill)**: Run convention-verify-edit with regular coder (has verify-after-edit.md installed)
- **Runs per arm**: 3
- **Primary metric**: C2.3 (verify-after-edit) pass rate
- **Secondary metrics**: Overall pass rate, C3 (validation-attempt) pass rate

**Control**: 
- Lab fork `coder-no-verify-skill` = copy of coder/ with skills/verify-after-edit.md removed
- All other skills (experience-replay.md) remain

**Key question**: Does removing the skill cause C2.3 to fail while C3 still passes?
