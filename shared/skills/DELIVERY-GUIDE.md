# Few-Shot Skill Delivery Guide

> How to deliver skill files so they actually change agent behavior.
> Based on 16 experiments (EXP-084 through EXP-096). See WKWA-006 for the full evidence.

## The One Rule

**Skills must be delivered in the task message, not the system prompt.**

Skills in the system prompt have 0% effect on judgment behaviors. The same skill
delivered in the task message achieves 100% effect. This is the most replicated
finding in our research sprint.

## How to Deliver Skills

### When Delegating via `agents.call()` or `message()`

Use the `context_files` parameter to attach relevant skill files:

```
agents.call("coder", {
  task: "Fix the API integration bug in weather.js",
  context_files: ["agents/coder/skills/investigate-and-fix.md"]
})
```

The `context_files` content is appended to the task message — exactly where
research shows it's most effective.

### When Composing Task Text Directly

Read the skill file and append it to your task description:

```
Your task: Fix the API integration bug in weather.js

---

## Reference Skill: Investigate and Fix
[contents of the skill file]
```

### In Gym Scenarios

Add `injected_context` to scenario.json pointing to a skill file:

```json
{
  "name": "my-scenario",
  "injected_context": "injected_context.md"
}
```

The runner prepends the file content to task.md automatically.

## Which Skills to Inject

### Skill Matching Guide

| Task Pattern | Skill to Inject | Why |
|-------------|----------------|-----|
| Fix a bug | `investigate-and-fix.md` | Prevents jumping to fix without understanding |
| Task might be impossible | `know-when-blocked.md` | Prevents timeout on impossible tasks |
| Contradictory requirements | `classify-then-act.md` | Prevents picking one side without flagging conflict |
| Modify existing code | `verify-after-edit.md` | Ensures changes are validated |
| Test results contradict code | `evidence-over-narrative.md` | Prevents modifying source to match wrong tests |

### Decision Tree

```
Is this task potentially impossible (binary files, missing credentials)?
  → YES: Inject know-when-blocked.md

Does the task involve ambiguous or conflicting requirements?
  → YES: Inject classify-then-act.md

Does the task involve debugging/fixing code?
  → YES: Inject investigate-and-fix.md

Does the task involve editing files?
  → YES: Inject verify-after-edit.md (but note: temporal discipline
         is a hard boundary — the skill teaches WHAT to verify,
         not the habit of verifying after every edit)
```

## Skill Writing Guidelines

From WKWA-006 Section 6:

1. **Domain match on hard scenarios** — If the target failure has 0% baseline,
   the example MUST be from the same domain
2. **Show the full reasoning chain** — Recognition → Analysis → Decision → Action
3. **One skill per example** — Don't bundle multiple skills (execution crowding risk)
4. **Include the anti-pattern** — Show what the agent would naturally do wrong,
   then the correct alternative
5. **~150-300 lines** — Too short lacks detail, too long crowds execution
6. **Use realistic artifacts** — Real tool outputs, not sanitized versions

## Hard Boundaries (Where Few-Shot Fails)

1. **Temporal discipline** (when to use tools): Use L5 workflow enforcement instead
2. **Cross-domain on hard tasks**: Write domain-specific variants, don't reuse
3. **Execution crowding**: Don't inject 3+ skills simultaneously — pick the most relevant one
4. **Discovery/exploration tasks**: Few-shot is ACTIVELY HARMFUL (-67pp, p=0.030).
   Template-following displaces the open exploration these tasks require.
   See KE-133. Do NOT inject few-shot skills for tasks requiring creative inference,
   knowledge integration, open-ended exploration, or discovery of novel patterns.

## File Locations

- Agent-specific skills: `agents/<name>/skills/`
- Shared skills: `shared/skills/<skill-name>/SKILL.md`
- Skill library index: `shared/skills/LIBRARY.md`
