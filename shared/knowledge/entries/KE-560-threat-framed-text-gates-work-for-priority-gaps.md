# KE-560: Threat-Framed Text Gates Work for Priority-Gap Behaviors

**Date**: 2028-07-02  
**Source**: EXP-560  
**Confidence**: High (3/3 treatment, 0/3 baseline, +100pp)

## Finding

Text instructions framed as "You CANNOT finish without X — session will be REJECTED" achieve near-100% compliance on subtasks that agents otherwise skip. This works specifically for **priority gaps** (agent knows about the task but deprioritizes it) as opposed to:

- **Awareness gaps** (solved by checklists — EXP-555 +67pp on server-updated)
- **Ability gaps** (not solvable by any text — partial-verification-trap)

## Mechanism

Threat framing elevates a secondary task to session-blocking priority. The agent treats "session rejected" as equivalent to a structural gate, even though it's purely text.

## Nuance to KE-480

KE-480 states "text coaching dead for verification behaviors." This remains true for:
- Awareness-style reminders ("remember to verify")
- Behavioral habits (read-before-edit, verify-after-edit)

But threat-framed gates ARE effective for:
- Priority-gap subtasks (test-writing, documentation)
- Tasks the agent CAN do but CHOOSES to skip

## Application

When injecting worker tasks that require secondary deliverables (tests, docs, registration), add:
```
⛔ STRUCTURAL GATE — [X] REQUIRED
You CANNOT finish without [X]. Session will be REJECTED. Do [X] FIRST, then finish.
```

## Limitations

- May produce trivial/low-quality output (agent writes minimal test to pass gate)
- Only works for tasks within agent's ability
- Untested at scale in production (gym only)
