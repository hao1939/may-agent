# Brief: Deploy Standard FM-3.3 Guard to Remaining Agents

## Context
FM-3.3 (Verification Gap) is the #1 behavioral failure mode. We have successfully deployed a structural guard to 8 agents (Bob, Coach, Coder, Optimizer, QA, Scout, Tech-Lead, Amy). However, 4 agents remain unprotected: Amy-Kimi, Evaluator, Master, May.

## Objective
Normalize the FM-3.3 guard across the entire fleet to ensure "Claim-as-Record" (C26) is universally enforced.

## Changes Required
Update `agents/amy-kimi/heartbeat.md`, `agents/evaluator/heartbeat.md`, `agents/master/heartbeat.md`, and `agents/may/heartbeat.md` with the standard FM-3.3 guard block.

### Standard Guard Text
```markdown
## ⛔ Verification Discipline (FM-3.3 Guard)
**Verification must be Structural, not Semantic.**
- **Bad**: `read(file)` → "Looks good." (This is "Eye-balling" — prone to FM-3.3 hallucinations).
- **Good**: `grep "pattern" file` → "Found match." (This is Structural — evidence-based).
- **Rule**: Never claim a task is done until you have a **binary signal** (Exit Code 0, "PASS" string, or explicit grep match) in the transcript.
- **Self-Correction**: If you find yourself saying "I checked and it looks correct," STOP. Run a command that *proves* it is correct.
```

## Implementation Plan
1. **Delegate**: Send this brief to **Tech-Lead** (or May) to apply the edits, as Bob cannot edit other agents' heartbeats directly.
2. **Verify**: Check `grep -L "FM-3.3" agents/*/heartbeat.md` returns 0 files.

## Deliverables
1. `agents/amy-kimi/heartbeat.md` updated
2. `agents/evaluator/heartbeat.md` updated
3. `agents/master/heartbeat.md` updated
4. `agents/may/heartbeat.md` updated
