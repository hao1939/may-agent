# Workflow Variation w05: Materialization Cadence

## Target Scenario
materialize-intermediate-findings — coder doesn't write intermediate findings to disk during long investigations

## Mechanism
Instead of a simple two-phase split (which failed in exp-094), use a recurring micro-checkpoint pattern: after every N tool calls in the investigation phase, force a materialization step where the agent writes findings to a workspace file.

## Workflow File: workflows/materialize-cadence.ts

```typescript
// materialize-cadence.ts — Force periodic materialization of findings
export const name = "materialize-cadence";
export const description = "During investigation tasks, periodically write findings to disk.";

export const triggers = {
  taskContains: ["investigate", "debug", "diagnose", "analyze", "find", "research"]
};

export const phases = [
  {
    name: "investigate-round-1",
    prompt: `Begin investigating the task. Read relevant files, run diagnostics.
After you've gathered initial findings (within 5 tool calls), STOP and write
your findings so far to a workspace file:
  write("workspace/findings.md", "# Investigation Findings\\n\\n## Round 1\\n<your findings>")

Include: what you've learned, what files you've read, what you suspect, what's left to check.
This file is your safety net — if the session crashes, your work survives.`,
    max_turns: 8
  },
  {
    name: "investigate-round-2",
    prompt: `Continue investigating. Read your previous findings from workspace/findings.md first.
Then pursue the remaining leads. After gathering more evidence, UPDATE the findings file:
  edit("workspace/findings.md", ...) to add a "## Round 2" section.

Include: new evidence, updated hypothesis, remaining unknowns.`,
    max_turns: 8
  },
  {
    name: "implement-and-verify",
    prompt: `Based on your materialized findings in workspace/findings.md:
1. Implement the fix.
2. Verify each change.
3. Update workspace/findings.md with a "## Resolution" section documenting what you did and why.
4. Before finish(), cite evidence from tool output for each deliverable.`,
    max_turns: 15
  }
];
```

## Why This Should Work
The previous attempt (exp-094) used a simple two-phase split that failed because the agent still didn't write during Phase 1. This variation uses THREE investigation phases with explicit materialization instructions at each boundary. The phase transitions mechanically interrupt the agent's flow and redirect to writing. The "rounds" framing makes materialization feel natural (progress reports) rather than bureaucratic.

## Risk
Three investigation phases may be excessive for simple bugs. The round structure is rigid — some tasks need 1 round, others need 5. But it's better to over-materialize than to lose findings to session crashes.
