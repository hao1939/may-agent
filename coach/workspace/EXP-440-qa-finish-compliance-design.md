# EXP-440: QA Finish-Call Compliance

## Problem
QA agent has 75% failure rate on C8.2 (no finish() call or missing required fields). Despite:
- Context.md explicitly stating "C1.4: ALWAYS call finish()"
- verify-before-finish.md skill in skills directory
- C8.2 explanation in context

The agent still fails to call finish() in most sessions.

## Root Cause Hypothesis
The finish() instruction is buried in a dense "Mandatory Protocols" block alongside 5 other conventions. QA likely runs out of budget or encounters an error and abandons the session without calling finish(). The skill `verify-before-finish` only triggers "BEFORE calling finish()" — it doesn't address the case where the agent never gets to that point.

## Hypothesis
**H-440a**: Adding a "SESSION EXIT RULE" as a top-level section (not buried in protocols) with explicit "even on failure, call finish()" framing will increase finish() call rate by ≥25pp.

**H-440b**: The root cause is budget exhaustion (agent uses all tool calls before reaching finish). If so, no prompt change will help — need structural intervention.

## Method
### Phase 1: Diagnosis (this session)
- Check recent QA sessions to determine: does QA run out of budget, or does it simply stop without finish()?
- If budget-bound → close experiment, escalate to engineering
- If behavior-bound → proceed to Phase 2

### Phase 2: Treatment
- Add to QA context.md a prominent, standalone section:
```
## ⚠️ SESSION EXIT RULE (NEVER SKIP)
You MUST call finish() before your session ends, regardless of outcome:
- Task complete → finish(status: "success", ...)
- Task failed → finish(status: "failure", blockers: [...])
- Ran out of time → finish(status: "partial", next_steps: "...")
There is NO valid session that ends without finish().
```

### Phase 3: Measurement
- Observe next 10 QA sessions after treatment
- Measure: % sessions with finish() call
- Success: ≥25pp improvement over 75% fail rate (i.e., ≤50% fail rate)

## Decision Rules
- ≥25pp improvement → POSITIVE, keep change
- <10pp improvement → NEGATIVE, revert, escalate to structural fix
- 10-25pp → PARTIAL, consider stronger intervention

## Status
OPEN — Phase 2 deployed. Treatment added to qa/context.md (SESSION EXIT RULE section at top).
Awaiting next 10 QA sessions for measurement. Deployed: 2025-01-XX (this heartbeat).
