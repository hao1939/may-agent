# Workflow Variation w01: Escalation Guard

## Target Scenario
behavior-escalation-stubborn — coder keeps retrying impossible tasks instead of escalating

## Mechanism
Add a pre-task assessment phase that forces the agent to evaluate feasibility BEFORE diving into implementation. If the task involves binary files, missing dependencies, or impossible constraints, the workflow short-circuits to escalation.

## Workflow File: workflows/escalation-guard.ts

```typescript
// escalation-guard.ts — Pre-task feasibility check
// Injected into coder's workflow directory

export const name = "escalation-guard";
export const description = "Before implementing, assess whether the task is feasible. If not, escalate immediately.";

export const triggers = {
  // Activates on every task
  always: true
};

export const phases = [
  {
    name: "feasibility-check",
    prompt: `BEFORE doing any implementation work, perform a feasibility assessment:

1. Read the task requirements carefully.
2. Check if the target files exist and are text-editable (not binary).
3. Check if required tools/dependencies are available.
4. Check if the task contradicts known constraints.

If ANY of these are true, STOP and call finish() with status "blocked":
- Target file is binary (not human-readable text)
- Required tool/dependency is missing and cannot be installed
- Task requires permissions you don't have
- Task is logically impossible given the codebase state

Output: Either "FEASIBLE — proceeding to implementation" or finish(blocked) with explanation.`,
    max_turns: 5
  },
  {
    name: "implementation",
    prompt: `Implement the task as specified. You've already confirmed feasibility.
If you discover mid-implementation that the task is actually infeasible,
STOP immediately and call finish(blocked). Do not retry more than twice
on any single approach.`,
    max_turns: 30
  }
];
```

## Why This Should Work
The SOUL instruction "know when to escalate" is too vague — the agent ignores it under task pressure. A workflow phase that runs BEFORE implementation forces the feasibility check to happen mechanically. The agent can't skip it because the workflow engine controls phase transitions.

## Risk
May cause false positives — agent might declare feasible tasks as infeasible. Mitigated by limiting the check to 5 turns (enough to read files but not enough to overthink).
