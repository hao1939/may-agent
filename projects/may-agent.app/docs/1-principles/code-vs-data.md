# Code vs Data Decision Guide

When you want to enforce a constraint on agent behavior, choose the right mechanism.

## Decision Tree

```
Is this constraint PERMANENT and UNIVERSAL (true in all environments, forever)?
  YES → Consider code (but still prefer workflow or observe/warn guard before hard blocking)
  NO  → Use context.md (data, not code)

Does the constraint depend on the current ENVIRONMENT?
  (paths, tools available, runtime, config locations)
  YES → context.md — environment changes, code doesn't adapt
  NO  → Keep reading

Is this about JUDGMENT (agent makes wrong decision)?
  YES → Workflow enforcement (two-phase, evidence-gate, etc.)
        NOT text rules (0/18 proven), NOT guards (brittle)
  NO  → Keep reading

Is this about a TOOL BUG (tool produces wrong output)?
  YES → Fix the tool code
  NO  → context.md
```

## Examples

| Constraint | Mechanism | Why |
|-----------|-----------|-----|
| "npx not available" | context.md | Environment fact, changes when we install npx |
| "Project root is /app" | context.md | Environment fact, changes if we remount |
| "Don't use /home/* paths" | context.md | We just mounted /home/hao for flexnodehelper |
| "finish(success) must match reality" | context.md | Behavioral reminder, not enforceable by regex |
| "Verify before finishing" | Workflow (two-phase) | Judgment task, structure beats instructions |
| "Evidence before design brief" | Workflow (evidence-gate) | Judgment task, gate enforces process |
| "tsc must pass before commit" | Code (npm run check) | Permanent, universal, mechanical check |

## Why NOT Blocking Guards

Blocking guards hardcode assumptions into regexes:
```typescript
// This WILL break:
const BAD_PATHS = /\/home\/\w+/;  // But /home/hao is now mounted
const BLOCKERS = /missing|not found/;  // But "was missing, I created it" is success
```

When the environment changes:
- **Blocking guard**: find the regex, edit code, rebuild image, redeploy pod — and you won't know it's broken until an agent gets incorrectly blocked
- **context.md**: edit one line, takes effect next session

Guards are still valuable as detectors, but they should not be the first tool
for uncertain behavior. Prefer metrics or evaluator review first. Promote to an
`observe` or `warn` guard only after the signal is repeated, useful, and needs
near-action visibility. A guard event can reveal agent weakness, missing
context, misleading prompt text, or workflow design gaps without interrupting
productive work.

## The Test

Before adding any blocking guard, ask:
1. Will this regex produce false positives when the environment changes?
2. Could a metric or evaluator review collect the signal first?
3. Could a context.md fact or workflow step achieve the same result?
4. Has an observe/warn guard already proven the detector is reliable?
5. Is there a gym scenario proving the blocking guard works better?

If you can't answer "no, no, no, yes, yes" — do not block. Use metrics,
evaluator review, context.md, workflow structure, or an observe/warn guard.
