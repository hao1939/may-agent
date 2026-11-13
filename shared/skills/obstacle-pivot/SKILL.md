---
name: obstacle-pivot
description: Classify failed approaches and switch to a concrete fallback strategy instead of repeating blocked steps.
---

# Recover from a failed approach

Use this method when a tool failure or unusable result prevents the next useful
step. Read the actual error and inspect the relevant target state before choosing
an alternative. Preserve the assignment and any already accepted work.

## Choose an alternative that addresses the cause

| Obstacle | Useful next step |
| --- | --- |
| Missing command or dependency | Check the repository's declared scripts and available tools; use a supported equivalent or report the missing capability. |
| Missing path | Search for the actual file with `rg --files` or inspect the known parent. Create a file only when the assignment calls for one. |
| Edit match missing or ambiguous | Read the current target section and use enough exact surrounding text to identify the intended change. |
| Truncated output | Narrow the query or read the needed section. Treat unseen content as unverified. |
| Wrong working directory | Check the execution directory and resolve the intended path. |
| Permission or policy rejection | Read the restriction. Use an authorized path that respects it, or request the missing authority; changing tools does not grant permission. |
| Malformed call | Correct the field or value identified by the supplied tool schema and error. |

Choose a fallback because it can advance the required outcome, not merely because
it returns success. A syntax check or manual read can provide useful partial
evidence when the compiler is unavailable; it does not establish that the required
type check passed. Verify the repaired step against its actual acceptance need.

For a transient failure, follow the operation's retry contract. A timeout does
not establish that an effect failed: inspect the target or retained receipt and
reuse the admitted identity where supported before repeating a mutation. Do not
repeat a deterministic failure without a relevant change in input or environment.

## Keep recovery within the owning execution

Continue while there is a credible authorized next step, useful progress and
room within the caller's remaining allowance and the operation's own bounds.
Respect cancellation, finish warnings and App-specific repair limits. Repeated
failure without new evidence calls for reconsidering the approach or asking for
specific help. This method adds no retry counter or execution deadline.

Preserve useful partial work and the exact failure evidence. If a capability,
dependency or decision prevents progress, report what is confirmed, what remains
and the specific help needed through the caller's supplied result contract.
Independent work can continue when its prerequisites are available; an unresolved
step must remain visible rather than being silently dropped.

For May Task execution, the
[Task execution guide](../../../projects/alex.app/docs/2b-manual/task-execution-guide/SKILL.md)
owns continuation, saved waits, recovery and caller returns. Use the result schema
actually supplied to this invocation; a tool-level fallback does not settle the
whole assignment or close its Task.
