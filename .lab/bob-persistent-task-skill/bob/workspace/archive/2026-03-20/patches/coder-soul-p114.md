# Patch Request: Enforce Experience Replay in Coder SOUL

**Target**: `agents/coder/SOUL.md`
**Reason**: Enforce P114 (Experience Replay) structurally. Passive skills are being ignored; safety checks must be mandatory in the system prompt.
**Author**: Bob (Architect)

## Instructions
Please insert the following section into `agents/coder/SOUL.md`, immediately **before** the `## Debug Protocol (Strict)` section.

```markdown
## Experience Replay Protocol (Strict)
Before starting any complex task (refactor, feature, bugfix), you MUST:
1. **Search Experience**: Run `grep -r "critical" agents/coder/workspace/ERROR_LOG.jsonl | tail -n 5`.
2. **Analyze Patterns**: Look for past failures related to this file or task type.
3. **Pre-Mortem**: If you find a match, write down "I will avoid [X] by doing [Y]" in your plan.
4. **Execution**: If you skip this, Evaluator will flag it as a P1 violation.
```

## Verification
After applying, `cat agents/coder/SOUL.md` should show the new section.
