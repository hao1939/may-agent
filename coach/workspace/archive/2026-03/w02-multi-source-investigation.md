# Workflow Variation w02: Multi-Source Investigation

## Target Scenario
conflicting-evidence — coder doesn't cross-reference multiple config sources before making changes

## Mechanism
Add a mandatory investigation phase that forces reading ALL relevant files before any edits. The workflow splits "gather evidence" from "make changes" into separate phases with an explicit transition gate.

## Workflow File: workflows/investigate-then-fix.ts

```typescript
// investigate-then-fix.ts — Enforce multi-source investigation before editing
export const name = "investigate-then-fix";
export const description = "Gather evidence from all relevant sources before making any code changes.";

export const triggers = {
  // Activates on debugging/investigation tasks
  taskContains: ["fix", "debug", "investigate", "error", "config", "broken", "failing"]
};

export const phases = [
  {
    name: "investigation",
    prompt: `INVESTIGATION PHASE — DO NOT EDIT ANY FILES YET.

Your ONLY job in this phase is to gather evidence:
1. Read the error message/logs mentioned in the task.
2. Find ALL config files related to the issue (grep for config names, check common locations).
3. Read EACH config file completely.
4. Check for conflicts between config files (different values for same setting).
5. Read any error logs (ERROR_LOG.jsonl, stderr output, test failures).
6. List ALL evidence you found, with file paths and relevant content.

RULES:
- Do NOT call edit() or write() in this phase.
- Do NOT propose a fix yet.
- If you find conflicting values across files, note EACH conflict explicitly.

Output: A numbered list of all evidence gathered, with source file paths.`,
    max_turns: 15,
    forbidden_tools: ["edit", "write"]
  },
  {
    name: "diagnosis",
    prompt: `Based on your investigation, write a diagnosis:
1. What is the root cause?
2. Which files need to change and why?
3. Are there conflicting configs? If so, which one is authoritative?

Only after writing the diagnosis, proceed to fix.`,
    max_turns: 5
  },
  {
    name: "fix-and-verify",
    prompt: `Now implement the fix based on your diagnosis.
After each edit, verify the change is correct (read back, run test).
Before calling finish(), ensure ALL conflicting configs are resolved.`,
    max_turns: 20
  }
];
```

## Why This Should Work
Coder consistently gets 5/7 on conflicting-evidence — it partially investigates but misses 2 checks (likely reading error log + checking all config sources). The workflow mechanically prevents jumping to edits before investigation is complete. The `forbidden_tools` constraint in phase 1 ensures no premature fixes.

## Risk
The trigger keywords may not match all task phrasings. The investigation phase might time out on large codebases. Mitigated by generous 15-turn limit.
