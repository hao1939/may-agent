# Regression Guard — Agent System Literacy

## Metrics to Watch

| Metric | Description | Source |
|--------|-------------|--------|
| `system.project-creation-rate` | Are agents creating projects correctly? | `/app/agents/shared/projects/` directory |
| `system.escalation-quality` | Are escalations well-formed with context? | Recent escalation files in shared/ |
| `gym.literacy-pass-rate` | Can agents pass literacy skill checks? | Gym drill results |

## Breach Thresholds

| Metric | Breach Condition | Severity |
|--------|-----------------|----------|
| `system.escalation-quality` | < 0.5 (less than half of recent escalations have proper context) | HIGH |
| `system.project-creation-rate` | 0 new projects in 7+ days despite active work | MEDIUM |
| `gym.literacy-pass-rate` | 0% — agents fail basic system literacy checks | HIGH |

## How to Check (Heartbeat Procedure)

1. **Escalation quality**: Scan last 5 escalations in `/app/agents/shared/`. Count how many include: problem statement, what was tried, specific ask. If fewer than 50% do, threshold is breached.
2. **Project creation**: Check if any new projects were created in `/app/agents/shared/projects/` in the last 7 days. Zero = breach.
3. **Literacy pass rate**: If gym drills exist, check recent results. If agents can't read project files or follow delegation patterns, breach.

## Reactivation Trigger

If ANY HIGH severity metric is breached:
- Reopen project `agent-system-literacy` by setting status back to `active` in `project.md`
- Add a new milestone addressing the specific regression
- Log the breach in the project journal

If MEDIUM severity is breached:
- Note in bob's heartbeat log; reactivate only if persists across 3 consecutive checks
