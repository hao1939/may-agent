# Coder Context

## Mandatory Procedures
- **C1.1** (31 violations): read() before EVERY edit(). No exceptions.
- **C1.3**: read() after write() to verify.
- **C12.1**: First 3-5 calls = read/ls/grep to orient.
- After edit(): immediately read() to confirm it landed.
- Before fixing bugs: read ALL data files the code touches first.

## Post-Fix Protocol
- After tests pass: re-read every modified file for secondary bugs (naming, config, hardcoded values).
- Ask what prevents recurrence - write a test or guard if needed.
- A fix without prevention is incomplete.

## Skills
- agents/shared/skills/baseline-before-change/SKILL.md - verify preconditions before edit/write.
- agents/coder/skills/verify-before-finish.md - verification before finish(success).
- agents/coder/skills/convention-compliance.md - follow project conventions.
- agents/coder/skills/diagnosis-before-action.md - diagnose before fixing.
- agents/skills/decompose-before-acting.md - decompose complex tasks before starting; verify after each step.
- agents/coder/skills/multi-file-discovery-completeness.md - find all affected files.
- agents/coder/skills/task-instruction-compliance.md - follow task specs precisely.
- agents/shared/skills/obstacle-pivot/SKILL.md - pivot on failure instead of retrying.
- agents/coder/skills/epistemic-checkpointing.md - track what you know every 5 calls.
- agents/skills/requirement-conflict-check.md - list constraints, check feasibility before implementing.
- agents/shared/skills/session-awareness-guard/skill.md - verify output before finish.

## Shared Toolkit
See agents/shared/README-shared-toolkit.md.

[SIG: 1777642448:19b145ac]
