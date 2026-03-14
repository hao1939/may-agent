# Design: Hard-Gated Coder (Reliability)

**Status:** Draft
**Owner:** Tech Lead
**Date:** 2026-03-10

## Context
We need a Coder workflow that *structurally disables* the ability to "finish" a task until a verification command (test/lint) returns exit code 0.
Currently, agents can *claim* they tested, but we rely on their honesty/diligence.
The `vet-skill` workflow (Experiment 1) successfully prototyped this: it's a dedicated workflow that runs a static analysis script and returns a structured PASS/FAIL result.

## The Goal
Create a generic `coder-gate` workflow that:
1.  Takes a task AND a verification command (e.g., `npm test`, `tsc`, `node script.js`).
2.  Runs the Coder agent in a loop.
3.  **Crucially**: The `finish` tool is *only* enabled if the verification command has passed in the current session.

## The Mechanism (Ralph Loop)

The "Ralph Loop" is a pattern where the environment enforces the "Test -> Code -> Test" cycle.

### Proposed Workflow: `hard-gated-coder`

**Inputs:**
- `task`: The coding task description.
- `files`: List of files to edit.
- `verifyCommand`: The shell command that MUST return exit code 0.

**State Machine:**
1.  **Start**: Coder spawned. `finish` tool is **DISABLED**.
2.  **Work**: Coder edits files.
3.  **Verify**: Coder runs `exec(verifyCommand)`.
    - If `exitCode === 0`: Enable `finish` tool.
    - If `exitCode !== 0`: `finish` remains disabled. Coder must fix.
4.  **Finish**: Coder calls `finish` (now enabled).

## Implementation Details

### 1. `src/workflow-defs.d.ts` update
We need a way to dynamically enable/disable tools or hook into the `finish` call.
*Current limitation*: Workflows coordinate *agents*, they don't easily modify the *agent's runtime toolset* dynamically.

### Alternative: Wrapper Verification
Instead of modifying the toolset (hard), we wrap the Coder in a supervisor loop.

**Loop:**
1.  **Coder runs**: "Here is the task. You must pass `${verifyCommand}`."
2.  **Coder finishes**: Returns "I'm done."
3.  **Supervisor runs**: Executes `${verifyCommand}`.
    - **Pass**: Workflow completes.
    - **Fail**: Supervisor sends task back to Coder: "Verification failed. Output: <logs>. Fix it."
    - **Max Retries**: Escalate if not fixed after N attempts.

This is simpler to implement with our current `workflow` engine. It doesn't physically disable the tool, but it *functionally* prevents the workflow from succeeding until the check passes.

## Plan: `verified-coder` Workflow

We will implement the **Wrapper Verification** pattern first.

**File:** `agents/tech-lead/workflows/verified-coder.ts`

**Steps:**
1.  **Input Parsing**: Extract `task` and `verifyCommand`.
2.  **Loop (Max 3 attempts)**:
    - **Run Coder**: Delegate task to Coder.
    - **Run Verify**: Execute `verifyCommand` in the shell.
    - **Check**:
        - `0`: Success! Return done.
        - `!= 0`: Capture stderr/stdout. Construct feedback: "Verification failed with code X. Logs: ...".
    - **Retry**: Call Coder again with feedback.
3.  **Escalate**: If loop exhausts, return `escalate("Verification failed after 3 attempts")`.

## Action Items
1.  **Create** `agents/tech-lead/workflows/verified-coder.ts`.
2.  **Register** in `agents/tech-lead/agent.json`.
3.  **Test** with a simple task (e.g., "Write a function that returns 42 and a test that checks it").
