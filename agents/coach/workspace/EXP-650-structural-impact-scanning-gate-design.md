# EXP-650: Structural Impact-Scanning Gate — Design

## Date: 2029-07-27
## Status: DESIGNED — Ready for implementation when binary rebuild unblocks

## Problem Statement

Impact-radius-check skill shows +100pp in gym (EXP-445, EXP-570) but only 6% scanning rate in production (EXP-645). Agents fix target files but never check consumers/callers. This causes silent breakage in dependent modules.

## Root Cause (from EXP-645)

Cognitive skills fail to transfer from gym to production without structural enforcement. Same pattern as verify-after-edit (EXP-280→340→350→565). Extends KE-480.

## Hypothesis

A structural gate in `genericHeartbeat()` that checks whether the agent grep'd for consumers of modified symbols before finishing will increase scanning rate from 6% to ≥40%.

## Design

### Gate Logic (in heartbeat-data.ts, after artifact gate)

```typescript
// EXP-650: Impact-scanning gate
// After agent signals finish, check if they modified files but never grep'd
const hasEdits = messages.filter(m => 
  m.role === 'assistant' && m.tool_calls?.some(tc => 
    ['edit', 'write'].includes(tc.function.name)
  )
).length;

const hasGrep = messages.filter(m =>
  m.role === 'assistant' && m.tool_calls?.some(tc =>
    tc.function.name === 'bash' && 
    /\b(grep|rg|find.*-name)\b/.test(tc.function.arguments)
  )
).length;

if (hasEdits >= 2 && hasGrep === 0) {
  // Re-prompt: "You edited N files but never checked for consumers."
  return repromptWithImpactScan(editedFiles);
}
```

### Trigger Conditions
- Agent edited ≥2 files (single-file edits unlikely to have cross-file impact)
- Agent never ran grep/rg/find in the session
- NOT triggered if agent is in a "read-only" or "documentation" task context

### Re-prompt Message
```
⚠️ IMPACT CHECK REQUIRED: You modified {N} files but never checked for consumers or callers.
Before finishing, grep for the symbols/functions you changed to verify no downstream breakage.
What files import or call the code you modified?
```

### Logging
```typescript
appendFileSync('agents/shared/impact-gate-triggers.log', 
  `${Date.now()} | ${agentName} | edited=${hasEdits} | grep=${hasGrep}\n`
);
```

## Success Criteria
- Gate fires on ≥20% of multi-edit sessions
- Post-gate scanning rate increases from 6% to ≥40%
- Recovery rate (agent actually scans after re-prompt): ≥80%

## Measurement Plan
1. Deploy gate in heartbeat-data.ts (requires binary rebuild)
2. Wait for 50+ multi-edit sessions
3. Check `impact-gate-triggers.log` for fire rate
4. Audit post-fire sessions for actual scanning behavior
5. Compare downstream breakage rate (if measurable)

## Blocker
**Same as EXP-630/640**: Requires binary rebuild of `may-agent` to take effect. Design is ready; implementation awaits infrastructure unblock.

## Relationship to Other Experiments
- **EXP-445/570**: Proved the skill works in gym (+100pp)
- **EXP-645**: Proved it doesn't transfer to production (6%)
- **EXP-500**: Precedent — read-before-edit gate uses same pattern (auto-inject behavior)
- **EXP-630**: Same gate architecture, different behavior target
- **KE-480**: Predicted this outcome — text skills dead, structural only

## Risk
- False positives: Some sessions legitimately don't need scanning (doc edits, config changes)
- Mitigation: Only fire when ≥2 source files edited (not .md, not config)
- Can add file-extension filter: only `.ts`, `.js`, `.py` edits trigger the gate
