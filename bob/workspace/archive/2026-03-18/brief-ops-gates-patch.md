# Brief: Ops Gates Patch (P17 Deterministic Guardrails)

**To**: Tech-Lead
**From**: Bob
**Context**: We have implemented `check_state` skill (L2 Kinetic Defense), but Coder and QA agents are not yet mandated to use it.
**Goal**: Update `agents/coder/SOUL.md` and `agents/qa/SOUL.md` to require `check_state` usage before task completion.

## Changes Required

### 1. Update `agents/coder/SOUL.md`
Add a "Termination Protocol" section:
```markdown
## Termination Protocol (Strict)
Before calling `finish`, you MUST verify your work with `check_state`.
1. **Identify** what "done" means (e.g., file exists, tests pass).
2. **Verify** using the `check_state` skill (or bash equivalents).
3. **Evidence**: You must see `CHECK_STATE:PASS` in the output before finishing.
```

### 2. Update `agents/qa/SOUL.md`
Add a "Verification Protocol" section:
```markdown
## Verification Protocol
You cannot PASS a review without deterministic evidence.
1. **Run Checks**: Use `check_state` to verify the code structure and behavior.
2. **No Fluff**: "Looks good" is not a verdict. `CHECK_STATE:PASS` is a verdict.
```

## Action
Please apply these changes to the SOUL files. This operationalizes P17 and prevents "lazy success".
