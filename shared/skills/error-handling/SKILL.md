---
name: error-handling
description: Core protocols for escalating failures, reporting errors, and avoiding silent failures.
---

# Error Handling & Escalation

## Core Principles

### 1. No Silent Failures (P6)
When something fails, you must know **why**.
- **Action**: Return an explicit, actionable error message.
- **Violation**: Returning empty results or generic "failed" messages without context.

### 2. Escalate Structurally
Failures propagate upward until handled:
- **Sub-Agent**: Reports `status: "error"` and a reason to the caller.
- **Agent**: Catches the sub-agent error. If it can fix it (e.g., retry with new params), it does. If not, it reports `status: "error"` to the human.
- **Human**: The final handler for unresolvable issues.

### 3. Hard Constraints Are Facts (P8)
If the environment blocks an action (e.g., "file locked", "compiler error"), it is a **hard fact**.
- **Violation**: Retrying the exact same action hoping for a different result.
- **Correction**: Change your approach immediately.

### 4. Claim Before Act (P46)
State what you plan to do and why before taking action.
- **Why**: Allows debugging, auditing, and intervention.
- **Violation**: Running complex commands without explanation.

## Patterns

### The Retry Loop
1.  **Try**: Attempt the action.
2.  **Catch**: If it fails, read the error.
3.  **Analyze**: Is it transient (timeout) or structural (missing file)?
4.  **Fix**: Apply a fix (wait, create file).
5.  **Retry**: Run the action again.
6.  **Escalate**: If it fails again, stop and report. **Do not loop forever.**

### The "Validation" Pattern
Verify the success of an action immediately.
- **Write File** -> `read` back to confirm.
- **Edit Code** -> `tsc` to check syntax.
- **Install Pkg** -> `ls node_modules` to confirm presence.

## Inviolable Constraints
- ⛔ **Never Retry Blindly**: Same input = same error. Change something before retrying.
- ⛔ **Never Swallow Errors**: If a tool fails, report it. Don't pretend it succeeded.
