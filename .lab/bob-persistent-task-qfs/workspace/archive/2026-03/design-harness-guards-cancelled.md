# Design Brief: Harness-Level Guards (Batch 2)

**Status**: Draft
**Context**: Request 2de6c69f (Hao) — "Next 2-3 harness-level guards from gym failures"

## 1. Analysis of Failures

We analyzed `behavior-escalation-stubborn` and `conflicting-evidence` scenarios.

1.  **`behavior-escalation-stubborn` Failure**: Agent spins, trying to `edit` or `cat` a binary file (`binary.bin`) repeatedly.
    *   **Root Cause**: Model doesn't recognize "binary file" signal or ignores it.
    *   **Fix**: **`BinaryGuard`**. Physically prevent `read`/`edit` on binary files. Force `stat` or `ls -l` instead.

2.  **`conflicting-evidence` Failure**: Agent reads README, edits `.env` to match (wrongly), and declares success without running the app.
    *   **Root Cause**: "Edit-and-Pray". Agent trusts text over execution.
    *   **Fix**: **`WorkVerifyGuard`**. If files were edited, `finish()` is BLOCKED unless a `bash` command (test/verify) was executed *after* the last edit.

3.  **General Tool Hygiene**: `v01` experiment failed with "ERROR", likely due to output parsing issues or timeouts from `cat`ing large files.
    *   **Root Cause**: Using `bash("cat ...")` instead of `read()`.
    *   **Fix**: **`ToolSyntaxGuard`**. Block `cat`, `vim`, `nano` in `bash` calls. Force usage of structured tools.

## 2. Guard Specifications

These guards implement the `Guard` interface defined in `design-unified-guards.md`.

### A. `BinaryGuard`
*   **Target**: `read`, `edit`.
*   **Logic**:
    1.  Resolve target path.
    2.  Check file extension (common binaries: `.bin`, `.exe`, `.so`, `.dll`, `.pyc`, `.class`) OR inspect first 512 bytes for null characters (if file exists).
    3.  **IF Binary**:
        *   **BLOCK** the call.
        *   **Return**: `Error: GUARD_BLOCK. File '${path}' appears to be binary. You cannot read/edit it directly. Use 'ls -l' to check size/permissions, or specific tools (hexdump, strings) if absolutely necessary.`
*   **Outcome**: Stops the "spin" in `behavior-escalation-stubborn` instantly. Agent is forced to accept it can't edit, leading to escalation (Success).

### B. `WorkVerifyGuard` (The "Edit-and-Pray" Killer)
*   **Target**: `finish`.
*   **State**: Track `last_edit_timestamp` and `last_bash_timestamp`.
*   **Logic**:
    1.  On `edit()`/`write()`: Update `last_edit_timestamp`.
    2.  On `bash()`: Update `last_bash_timestamp`.
    3.  On `finish()`:
        *   IF `last_edit_timestamp > last_bash_timestamp`:
            *   **BLOCK** `finish()`.
            *   **Return**: `Error: GUARD_BLOCK. You edited files but haven't run any verification command (bash) since the last edit. You must verify your changes work (run tests, linter, or a check script) before finishing.`
*   **Outcome**: In `conflicting-evidence`, agent edits `.env`. Guard forces a run. Agent runs app -> "Connection Refused" -> Agent realizes fix failed -> Investigates more.

### C. `ToolSyntaxGuard`
*   **Target**: `bash`.
*   **Logic**:
    1.  Parse `command`.
    2.  IF command starts with `cat `, `head `, `tail `, `more `, `less `, `vi `, `vim `, `nano `:
        *   **BLOCK** the call.
        *   **Return**: `Error: GUARD_BLOCK. Do not use '${cmd}' in bash. Use the native 'read' tool for files, or 'edit' for modifications.`
    3.  Exception: Allow `cat` if part of a pipe or redirect (`cat > file`, `cat file | grep`). Only block "read-only cat".
*   **Outcome**: Enforces P2 (Tool Protocol). Prevents context flooding from accidental `cat large-log.txt`.

## 3. Implementation Steps

1.  **Tech-Lead**: Implement `src/lib/guards/binary-guard.ts`.
2.  **Tech-Lead**: Implement `src/lib/guards/work-verify-guard.ts`.
3.  **Tech-Lead**: Implement `src/lib/guards/tool-syntax-guard.ts`.
4.  **Tech-Lead**: Register them in `src/lib/guards/default-guards.ts`.

## 4. Verification Plan

*   **Gym**: Run `behavior-escalation-stubborn`. Expect: Agent tries `edit binary.bin` -> Blocked -> Escalates -> PASS.
*   **Gym**: Run `conflicting-evidence`. Expect: Agent edits -> Blocked from finish -> Runs app -> Sees error -> Fixes properly -> PASS.
