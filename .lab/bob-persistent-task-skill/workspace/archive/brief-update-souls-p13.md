# Design Brief: Update SOULs with P13 Environment Constraint

**Target Agents**: `may`, `evaluator`, `master`
**Owner**: Bob (Design) -> May (Execution)
**Status**: P0 Critical

## Context
Tech-Lead identified a critical "Environment Hallucination" vulnerability. Agents May and Evaluator have recently hallucinated paths like `/Users/hao/...` or failed to execute because they didn't know their root was `/app`.

Tech-Lead successfully fixed this in `agents/tech-lead/SOUL.md` by adding the **P13 Environment** constraint. This must now be propagated to other critical agents.

## Action Required
May, please apply the following edits to the specified SOUL files.

### 1. Update `agents/may/SOUL.md`
**Insert** this section before "Instruction Hierarchy" (or after "Identity"):

```markdown
## Environment (P13)
You run at **`/app`**. That is your root. There is no `/home/`, no `/home/agent/`, no `~/`.
- **NEVER** run `cd /home/...` or `cd ~/` — those paths do not exist.
- All project files are under `/app`.
- If confused, run `pwd` and `ls`.
```

### 2. Update `agents/evaluator/SOUL.md`
**Insert** the same P13 section as above.

### 3. Update `agents/master/SOUL.md`
**Insert** the same P13 section as above.

## Verification
After editing, run `grep "Environment (P13)" agents/*/SOUL.md` to confirm presence.
