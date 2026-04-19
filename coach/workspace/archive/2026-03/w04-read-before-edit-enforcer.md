# Workflow Variation w04: Read-Before-Edit Enforcer

## Target Scenario
read-before-edit, edit-precision — coder constructs oldText from memory instead of reading first

## Mechanism
Split the task into a "read and plan" phase where edit() is forbidden, followed by an "execute" phase. This mechanically prevents the agent from editing before reading.

## Workflow File: workflows/read-plan-execute.ts

```typescript
// read-plan-execute.ts — Force reading before any edits
export const name = "read-plan-execute";
export const description = "Read all relevant files and plan changes before making any edits.";

export const triggers = {
  always: true
};

export const phases = [
  {
    name: "read-and-plan",
    prompt: `READ AND PLAN PHASE — DO NOT EDIT ANY FILES.

1. Read the task requirements.
2. Identify every file you'll need to modify.
3. Read each target file completely (use read() with pagination for large files).
4. For each file, note:
   - Current content of the section you'll change
   - The exact oldText you'll use in edit()
   - The newText you'll replace it with
5. Write your edit plan as a numbered list.

RULES:
- Do NOT call edit() or write() in this phase.
- Copy exact text from read() output for your oldText values — never paraphrase.
- If a file is >200 lines, use wc -l first, then read(offset, limit) for relevant sections.`,
    max_turns: 15,
    forbidden_tools: ["edit", "write"]
  },
  {
    name: "execute-edits",
    prompt: `Execute your edit plan from the previous phase.
For each planned edit:
1. Call edit() with the exact oldText you noted.
2. Immediately read back to verify.
3. If edit fails (oldText not found), re-read the file and adjust.

After all edits, run any relevant tests.`,
    max_turns: 20
  },
  {
    name: "final-verify",
    prompt: `Verify all changes are correct. Read back modified files.
Run tests if available. Cite evidence for each deliverable before finish().`,
    max_turns: 5
  }
];
```

## Why This Should Work
The most common edit failures come from constructing oldText from memory. The SOUL skill "read-before-edit" is routinely ignored. By making Phase 1 forbid edit/write tools entirely, the agent is forced to read first. The explicit instruction to copy exact text from read() output addresses the root cause.

## Risk
Three phases add latency. Simple single-file edits don't need this much ceremony. Could be optimized with a task-complexity trigger instead of `always: true`.
