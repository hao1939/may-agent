# Convention Proposal: Evidence-Required Fix Commits (C13.1)

**Proposed by**: May (on behalf of human, post INC-001)
**Date**: 2026-04-05
**Status**: PROPOSED
**Incident**: INC-001 — maxTurns misdiagnosis (agents/shared/knowledge/incidents/INC-001-maxturns-misdiagnosis.md)

## Problem

Agents see errors in the DB, assume the error is current, and commit fixes without verifying:
- Is the error still happening on the latest binary?
- Was the current behavior intentional?
- When did the erroring sessions start vs when was the relevant code deployed?

This led to INC-001: May re-added `maxTurns` passthrough that was intentionally removed, because turn limit errors in the DB were from old sessions.

## Convention

**C13.1 — Evidence-Required Fix Commits**

> Code changes to fix production issues MUST include evidence that the issue is still happening on the current binary. A single DB query showing the error on recent sessions (started after the latest deployment) is sufficient. No evidence, no commit.

### Requirements

1. **Before committing a fix for any production error**, the agent must:
   - Run a DB query or check logs to confirm the error is occurring on **sessions started after the latest deployment**
   - Check `git log --oneline -20` for recent intentional changes that might explain the current behavior
   - Verify that new sessions (not just old/restored ones) are affected

2. **The commit message must include**:
   - Evidence line: a summary of the DB query/log check that confirmed the issue is current
   - Example: `Verified: SELECT ... WHERE startedAt > <deploy_time> shows 5 sessions with error X`

3. **If evidence cannot be obtained** (e.g., the error is intermittent and hasn't recurred):
   - Do NOT commit a speculative fix
   - Instead, add monitoring/logging to capture the next occurrence
   - Document the investigation in workspace/

### Specific Diagnostic Commands

```sql
-- Check if error is on recent sessions (after latest deploy)
SELECT sessionId, startedAt, status, issues 
FROM session_meta 
WHERE startedAt > <latest_deploy_timestamp>
AND issues LIKE '%<error_pattern>%'
LIMIT 10;
```

```bash
# Check if a behavior was intentionally changed
git log --oneline --all --grep="<feature_name>" -10

# Check for recent reverts (indicates intentional changes)
git log --oneline -20 | grep -i "revert\|remove\|drop"
```

### Exceptions

- **Syntax errors / type errors / build failures**: These are self-evidently current. No DB query needed.
- **Test failures**: The test output is the evidence. Include it in the commit message.
- **This only applies to production error fixes**, not new features or refactors.

## Enforcement

- Code review (convention-check handler) should flag fix commits without evidence lines
- Evaluator should check for this pattern in session evaluations
- Agents should self-check: "Am I sure this is still happening?"

## Related Work

- Bob: designing diagnostic-before-fix skill (agents/bob/workspace/SKILL-diagnostic-before-fix.md)
- Optimizer: analyzing historical fix-without-verification rate
- Coach: designing experiment to measure protocol effectiveness
